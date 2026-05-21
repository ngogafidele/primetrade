import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import { requireServerSession } from "@/lib/auth/server"
import { ProductsManager } from "@/components/products/products-manager"
import { serializeProduct } from "@/lib/products/serialization"

type ProductsPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice: number
  price: number
  createdAt?: Date
  updatedAt?: Date
}

type LatestProductSupply = {
  _id: { toString(): string }
  supplierName: string
  suppliedAt?: Date
}

export default async function ProductsPage() {
  const session = await requireServerSession()

  await connectToDatabase()
  const [products, latestSupplies] = await Promise.all([
    Product.find().sort({ name: 1 }).lean<ProductsPageProduct[]>(),
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

  const serializedProducts = products.map((product) => {
    const latestSupply = latestSupplyByProductId.get(product._id.toString())
    return serializeProduct({
      ...product,
      supplierName: latestSupply?.supplierName,
      lastRestockAt: latestSupply?.suppliedAt,
    })
  })

  return (
    <ProductsManager
      initialProducts={serializedProducts}
      isAdmin={session.isAdmin}
    />
  )
}
