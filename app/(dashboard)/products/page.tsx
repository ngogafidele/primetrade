import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import { requireServerSession } from "@/lib/auth/server"
import { ProductsManager } from "@/components/products/products-manager"

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

type ProductsPageSupply = {
  _id: { toString(): string }
  productId: { toString(): string }
  sku: string
  productName: string
  supplierName: string
  quantity: number
  unitCost: number
  suppliedAt?: Date
  notes?: string
  createdAt?: Date
  updatedAt?: Date
}

export default async function ProductsPage() {
  const session = await requireServerSession()

  await connectToDatabase()
  const products = await Product.find()
    .sort({ name: 1 })
    .lean<ProductsPageProduct[]>()
  const supplies = session.isAdmin
    ? await ProductSupply.find()
        .sort({ suppliedAt: -1, createdAt: -1 })
        .limit(100)
        .lean<ProductsPageSupply[]>()
    : []

  const serializedProducts = products.map((product) => {
    return {
      ...product,
      _id: product._id.toString(),
      unit: product.unit ?? "pcs",
      lowStockThreshold: product.lowStockThreshold ?? 0,
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString(),
    }
  })

  const serializedSupplies = supplies.map((supply) => ({
    ...supply,
    _id: supply._id.toString(),
    productId: supply.productId.toString(),
    suppliedAt: supply.suppliedAt?.toISOString(),
    createdAt: supply.createdAt?.toISOString(),
    updatedAt: supply.updatedAt?.toISOString(),
  }))

  return (
    <ProductsManager
      initialProducts={serializedProducts}
      initialSupplies={serializedSupplies}
      isAdmin={session.isAdmin}
    />
  )
}
