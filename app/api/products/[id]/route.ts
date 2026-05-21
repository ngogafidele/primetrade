import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { UpdateProductSchema } from "@/lib/db/validators/product"
import { syncLowStockAlert } from "@/lib/db/alerts"
import {
  duplicateKeyIncludes,
  isDuplicateKeyError,
  productNameExists,
} from "@/lib/db/products"
import { serializeProduct } from "@/lib/products/serialization"
import { ZodError } from "zod"

async function getLatestProductSupply(productId: string) {
  return ProductSupply.findOne({ productId })
    .sort({ suppliedAt: -1, createdAt: -1 })
    .select("supplierName suppliedAt")
    .lean<{ supplierName?: string; suppliedAt?: Date }>()
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const product = await Product.findById(id)

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    const latestSupply = await getLatestProductSupply(id)

    return NextResponse.json({
      success: true,
      data: serializeProduct({
        ...product.toObject(),
        supplierName: latestSupply?.supplierName,
        lastRestockAt: latestSupply?.suppliedAt,
      }),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch product" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params

    const payload = UpdateProductSchema.parse(await request.json())
    const { categoryId: _categoryId, ...updateInput } = payload

    await connectToDatabase()

    if (payload.name && (await productNameExists(payload.name, id))) {
      return NextResponse.json(
        { success: false, error: "A product with this name already exists" },
        { status: 409 }
      )
    }

    const product = await Product.findOneAndUpdate(
      { _id: id },
      updateInput,
      { returnDocument: "after", runValidators: true }
    )

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    await syncLowStockAlert({
      productId: product._id.toString(),
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
      threshold: product.lowStockThreshold ?? 0,
    })

    const latestSupply = await getLatestProductSupply(id)

    return NextResponse.json({
      success: true,
      data: serializeProduct({
        ...product.toObject(),
        supplierName: latestSupply?.supplierName,
        lastRestockAt: latestSupply?.suppliedAt,
      }),
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    if (isDuplicateKeyError(error)) {
      const message = duplicateKeyIncludes(error, "name")
        ? "A product with this name already exists"
        : "A product with this SKU already exists. Please try again."

      return NextResponse.json(
        { success: false, error: message },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { success: false, error: "Failed to update product" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    await connectToDatabase()
    const product = await Product.findOneAndDelete({ _id: id })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete product" },
      { status: 400 }
    )
  }
}
