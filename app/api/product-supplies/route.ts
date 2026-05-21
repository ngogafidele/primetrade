import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import { requireAdmin } from "@/lib/auth/middleware"
import { CreateProductSupplySchema } from "@/lib/db/validators/product-supply"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { parseKigaliDateInput } from "@/lib/utils/time"

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get("productId")

    await connectToDatabase()
    const query = productId ? { productId } : {}
    const supplies = await ProductSupply.find(query)
      .sort({ suppliedAt: -1, createdAt: -1 })
      .limit(100)

    return NextResponse.json({ success: true, data: supplies })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch product supplies" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const payload = CreateProductSupplySchema.parse(await request.json())
    const suppliedAt = payload.suppliedAt
      ? parseKigaliDateInput(payload.suppliedAt) ?? new Date(payload.suppliedAt)
      : new Date()

    if (Number.isNaN(suppliedAt.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid supplied date" },
        { status: 400 }
      )
    }

    await connectToDatabase()
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: payload.productId },
      {
        $inc: { quantity: payload.quantity },
        $set: { costPrice: payload.unitCost },
      },
      { returnDocument: "after", runValidators: true }
    )

    if (!updatedProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    const supply = await ProductSupply.create({
      productId: updatedProduct._id,
      sku: updatedProduct.sku,
      productName: updatedProduct.name,
      supplierName: payload.supplierName,
      quantity: payload.quantity,
      unitCost: payload.unitCost,
      suppliedAt,
      recordedBy: session.userId,
      notes: payload.notes ?? "",
    })

    await syncLowStockAlert({
      productId: updatedProduct._id.toString(),
      name: updatedProduct.name,
      sku: updatedProduct.sku,
      quantity: updatedProduct.quantity,
      threshold: updatedProduct.lowStockThreshold ?? 0,
    })

    return NextResponse.json(
      { success: true, data: { supply, product: updatedProduct } },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to record product supply" },
      { status: 400 }
    )
  }
}
