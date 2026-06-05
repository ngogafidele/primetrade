import { connectToDatabase } from "@/lib/db/connection"
import { ReturnTransaction } from "@/lib/db/models/Return"
import { Product } from "@/lib/db/models/Product"
import "@/lib/db/models/User"
import { requireServerSession } from "@/lib/auth/server"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { ReturnsManager } from "@/components/returns/returns-manager"
import { formatInKigali } from "@/lib/utils/time"

type PopulatedReturnUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type ReturnPageItem = {
  productId: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type ReturnPageEntry = {
  _id: { toString(): string }
  createdAt?: Date
  updatedAt?: Date
  createdBy?: PopulatedReturnUser | { toString(): string }
  totalReturnAmount: number
  notes: string
  returnItems: ReturnPageItem[]
}

type ReturnPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  price: number
}

function isPopulatedReturnUser(
  value: ReturnPageEntry["createdBy"]
): value is PopulatedReturnUser {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function ReturnsPage() {
  const session = await requireServerSession()

  await connectToDatabase()
  const returns = await ReturnTransaction.find()
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean<ReturnPageEntry[]>()
  const products = await Product.find(activeRecordFilter)
    .sort({ name: 1 })
    .lean<ReturnPageProduct[]>()

  const serializedReturns = returns.map((entry) => {
    const createdBy = isPopulatedReturnUser(entry.createdBy)
      ? entry.createdBy._id.toString()
      : entry.createdBy?.toString()

    return {
      _id: entry._id.toString(),
      createdAt: entry.createdAt?.toISOString(),
      createdAtLabel: entry.createdAt
        ? formatInKigali(entry.createdAt, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
        : "-",
      updatedAt: entry.updatedAt?.toISOString(),
      createdBy,
      createdByName: isPopulatedReturnUser(entry.createdBy)
        ? entry.createdBy.name ?? entry.createdBy.email ?? "Unknown User"
        : "Unknown User",
      totalReturnAmount: entry.totalReturnAmount,
      notes: entry.notes,
      returnItems: entry.returnItems.map((item) => ({
        productId: item.productId.toString(),
        name: item.name,
        sku: item.sku,
        unit: item.unit ?? "pcs",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    }
  })

  const serializedProducts = products.map((product) => ({
    _id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    unit: product.unit ?? "pcs",
    quantity: product.quantity,
    price: product.price,
  }))

  return (
    <ReturnsManager
      initialReturns={serializedReturns}
      products={serializedProducts}
      currentUserLabel={session.email}
    />
  )
}
