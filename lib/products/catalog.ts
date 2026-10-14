import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import { activeRecordFilter } from "@/lib/db/soft-delete"

type CatalogProductRecord = {
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

export type CatalogProduct = {
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice?: number
  price: number
  supplierName?: string
  lastRestockAt?: Date
  createdAt?: Date
}

// Admin-only: includes cost price. Callers must check requireAdmin().
export async function loadProductCatalog(): Promise<CatalogProduct[]> {
  const [products, latestSupplies] = await Promise.all([
    Product.find(activeRecordFilter)
      .sort({ name: 1 })
      .lean<CatalogProductRecord[]>(),
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

  return products.map((product) => {
    const latestSupply = latestSupplyByProductId.get(product._id.toString())

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
  })
}
