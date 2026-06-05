import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { generateProductsCatalogPDF } from "@/lib/pdf/products-catalog-generator"

type CatalogProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice?: number
  price: number
  createdAt?: Date
}

type LatestProductSupply = {
  _id: { toString(): string }
  supplierName: string
  suppliedAt?: Date
}

export async function GET(request: NextRequest) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    await connectToDatabase()
    const [products, latestSupplies] = await Promise.all([
      Product.find(activeRecordFilter).sort({ name: 1 }).lean<CatalogProduct[]>(),
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
    const pdf = await generateProductsCatalogPDF(
      {
        generatedAt: new Date(),
        products: products.map((product) => {
          const latestSupply = latestSupplyByProductId.get(
            product._id.toString()
          )

          return {
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity: product.quantity,
            lowStockThreshold: product.lowStockThreshold,
            costPrice: product.costPrice,
            price: product.price,
            supplierName: latestSupply?.supplierName,
            lastRestockAt: latestSupply?.suppliedAt,
            createdAt: product.createdAt,
          }
        }),
      },
      {
        name: "Prime Trade Company Ltd",
        email: "primetrade155@gmail.com",
        phone: "Tel No: 0788746260",
      }
    )

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="products-catalog.pdf"',
      },
    })
  } catch (error) {
    console.error("[Products Catalog PDF Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate products catalog PDF" },
      { status: 500 }
    )
  }
}
