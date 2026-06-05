import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ProductSupply } from "@/lib/db/models/ProductSupply"
import "@/lib/db/models/User"
import { requireServerSession } from "@/lib/auth/server"
import { ProductsManager } from "@/components/products/products-manager"
import { serializeProduct } from "@/lib/products/serialization"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { formatInKigali } from "@/lib/utils/time"

type PopulatedProductUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type ProductsPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice: number
  price: number
  deletedAt?: Date
  deletedBy?: PopulatedProductUser | { toString(): string }
  deletedReason?: string
  createdAt?: Date
  updatedAt?: Date
}

type LatestProductSupply = {
  _id: { toString(): string }
  supplierName: string
  suppliedAt?: Date
}

function isPopulatedProductUser(
  value: ProductsPageProduct["deletedBy"]
): value is PopulatedProductUser {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function ProductsPage() {
  const session = await requireServerSession()

  await connectToDatabase()
  const [products, deletedProducts, latestSupplies] = await Promise.all([
    Product.find(activeRecordFilter)
      .sort({ name: 1 })
      .lean<ProductsPageProduct[]>(),
    session.isAdmin
      ? Product.find({ deletedAt: { $type: "date" } })
          .populate("deletedBy", "name email")
          .sort({ deletedAt: -1 })
          .lean<ProductsPageProduct[]>()
      : Promise.resolve([]),
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
    }, { includeCostPrice: session.isAdmin })
  })

  const serializedDeletedProducts = deletedProducts.map((product) => {
    const latestSupply = latestSupplyByProductId.get(product._id.toString())
    return {
      ...serializeProduct(
        {
          ...product,
          supplierName: latestSupply?.supplierName,
          lastRestockAt: latestSupply?.suppliedAt,
        },
        { includeCostPrice: session.isAdmin }
      ),
      deletedAt: product.deletedAt?.toISOString(),
      deletedAtLabel: product.deletedAt
        ? formatInKigali(product.deletedAt, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
      deletedReason: product.deletedReason ?? "",
      deletedByName: isPopulatedProductUser(product.deletedBy)
        ? product.deletedBy.name ?? product.deletedBy.email ?? "Unknown User"
        : undefined,
    }
  })

  return (
    <ProductsManager
      initialProducts={serializedProducts}
      initialDeletedProducts={serializedDeletedProducts}
      currentUserLabel={session.email}
      isAdmin={session.isAdmin}
    />
  )
}
