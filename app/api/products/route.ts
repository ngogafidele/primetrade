import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { CreateProductSchema } from "@/lib/db/validators/product"
import { syncLowStockAlert } from "@/lib/db/alerts"
import {
  duplicateKeyIncludes,
  isDuplicateKeyError,
  productNameExists,
} from "@/lib/db/products"
import { parseKigaliDateInput } from "@/lib/utils/time"
import { ZodError } from "zod"

function getSkuPrefix(name: string) {
  const letters = name.toUpperCase().replace(/[^A-Z]+/g, "")
  return (letters.slice(0, 3) || "PRD").padEnd(3, "X")
}

async function generateProductSku(name: string) {
  const prefix = getSkuPrefix(name)
  const skuPattern = `^${prefix}-\\d{4}$`
  const latestProduct = await Product.findOne({ sku: { $regex: skuPattern } })
    .sort({ sku: -1 })
    .select("sku")
    .lean<{ sku?: string }>()

  const latestSku = latestProduct?.sku
  const latestSequence = latestSku ? Number(latestSku.slice(-4)) : 0

  for (let sequence = latestSequence + 1; sequence <= 9999; sequence += 1) {
    const sku = `${prefix}-${String(sequence).padStart(4, "0")}`
    const existing = await Product.exists({ sku })
    if (!existing) return sku
  }

  throw new Error(`No available SKU sequence for prefix ${prefix}`)
}

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    await connectToDatabase()
    const products = await Product.find()

    return NextResponse.json({ success: true, data: products })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
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

    const payload = CreateProductSchema.parse(await request.json())
    const {
      categoryId: _categoryId,
      supplierName,
      suppliedAt: suppliedAtInput,
      ...productInput
    } = payload
    const suppliedAt = suppliedAtInput
      ? parseKigaliDateInput(suppliedAtInput) ?? new Date(suppliedAtInput)
      : new Date()

    if (Number.isNaN(suppliedAt.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid supplied date" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    if (await productNameExists(payload.name)) {
      return NextResponse.json(
        { success: false, error: "A product with this name already exists" },
        { status: 409 }
      )
    }

    const product = await Product.create({
      ...productInput,
      sku: await generateProductSku(payload.name),
    })

    const supply =
      product.quantity > 0
        ? await ProductSupply.create({
            productId: product._id,
            sku: product.sku,
            productName: product.name,
            supplierName,
            quantity: product.quantity,
            unitCost: product.costPrice,
            suppliedAt,
            recordedBy: session.userId,
          })
        : null

    await syncLowStockAlert({
      productId: product._id.toString(),
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
      threshold: product.lowStockThreshold ?? 0,
    })

    return NextResponse.json(
      { success: true, data: product, supply },
      { status: 201 }
    )
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
      { success: false, error: "Failed to create product" },
      { status: 400 }
    )
  }
}
