import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import { Alert } from "@/lib/db/models/Alert"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import {
  CreateProductSchema,
  CreateProductsSchema,
} from "@/lib/db/validators/product"
import { syncLowStockAlert } from "@/lib/db/alerts"
import {
  duplicateKeyIncludes,
  isDuplicateKeyError,
  productNameExists,
} from "@/lib/db/products"
import { parseKigaliDateInput } from "@/lib/utils/time"
import {
  serializeProduct,
  serializeProductSupply,
} from "@/lib/products/serialization"
import { ZodError } from "zod"

type LatestProductSupply = {
  _id: { toString(): string }
  supplierName: string
  suppliedAt?: Date
}

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
    const [products, latestSupplies] = await Promise.all([
      Product.find().lean(),
      ProductSupply.aggregate<LatestProductSupply>([
        { $sort: { suppliedAt: -1, createdAt: -1 } },
        {
          $group: {
            _id: "$productId",
            supplierName: { $first: "$supplierName" },
            suppliedAt: { $first: "$suppliedAt" },
          },
        },
      ]),
    ])
    const latestSupplyByProductId = new Map(
      latestSupplies.map((supply) => [supply._id.toString(), supply])
    )

    return NextResponse.json({
      success: true,
      data: products.map((product) => {
        const latestSupply = latestSupplyByProductId.get(product._id.toString())
        return serializeProduct({
          ...product,
          supplierName: latestSupply?.supplierName,
          lastRestockAt: latestSupply?.suppliedAt,
        })
      }),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const createdProductIds: string[] = []

  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const isBatchRequest =
      typeof body === "object" && body !== null && "products" in body
    const payloads = isBatchRequest
      ? CreateProductsSchema.parse(body).products
      : [CreateProductSchema.parse(body)]
    const normalizedNames = payloads.map((payload) =>
      payload.name.trim().toLowerCase()
    )

    if (new Set(normalizedNames).size !== normalizedNames.length) {
      return NextResponse.json(
        { success: false, error: "Product names must be unique" },
        { status: 409 }
      )
    }

    await connectToDatabase()

    const duplicateNames = await Promise.all(
      payloads.map((payload) => productNameExists(payload.name))
    )
    if (duplicateNames.some(Boolean)) {
      return NextResponse.json(
        { success: false, error: "A product with this name already exists" },
        { status: 409 }
      )
    }

    const results = []
    for (const payload of payloads) {
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
        throw new Error("Invalid supplied date")
      }

      const product = await Product.create({
        ...productInput,
        sku: await generateProductSku(payload.name),
      })
      createdProductIds.push(product._id.toString())

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

      results.push({
        product: serializeProduct({
          ...product.toObject(),
          supplierName: supply?.supplierName,
          lastRestockAt: supply?.suppliedAt,
        }),
        supply: supply ? serializeProductSupply(supply) : null,
      })
    }

    return NextResponse.json(
      isBatchRequest
        ? {
            success: true,
            data: results.map((result) => result.product),
            supplies: results.map((result) => result.supply),
          }
        : {
            success: true,
            data: results[0].product,
            supply: results[0].supply,
          },
      { status: 201 }
    )
  } catch (error) {
    if (createdProductIds.length > 0) {
      await Promise.all([
        Product.deleteMany({ _id: { $in: createdProductIds } }),
        ProductSupply.deleteMany({ productId: { $in: createdProductIds } }),
        Alert.deleteMany({ productId: { $in: createdProductIds } }),
      ])
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === "Invalid supplied date") {
      return NextResponse.json(
        { success: false, error: error.message },
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
