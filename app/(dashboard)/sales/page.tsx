import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { Product } from "@/lib/db/models/Product"
import "@/lib/db/models/User"
import { requireServerSession } from "@/lib/auth/server"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { SalesManager } from "@/components/sales/sales-manager"
import { formatInKigali } from "@/lib/utils/time"

type PopulatedSaleUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type SalesPageSaleItem = {
  productId: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  basePrice?: number
  sellingPrice: number
  lineTotal: number
}

type SalesPageSale = {
  _id: { toString(): string }
  saleDate?: Date
  createdAt?: Date
  updatedAt?: Date
  createdBy?: PopulatedSaleUser | { toString(): string }
  deletedAt?: Date
  deletedBy?: PopulatedSaleUser | { toString(): string }
  deletedReason?: string
  totalAmount: number
  approvalStatus?: "pending" | "approved"
  paymentStatus: "paid" | "unpaid"
  paymentMethod?: "cash" | "mobile-money" | "bank"
  notes: string
  customer?: {
    customerName?: string
    customerPhone?: string
  }
  outstanding?: {
    customerName: string
    customerPhone: string
    paymentDate?: Date
  }
  items: SalesPageSaleItem[]
}

type SalesPageProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  costPrice?: number
  price: number
}

function isPopulatedSaleUser(
  value: SalesPageSale["createdBy"]
): value is PopulatedSaleUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "_id" in value
  )
}

export default async function SalesPage() {
  const session = await requireServerSession()

  await connectToDatabase()
  const [sales, deletedSales] = await Promise.all([
    Sale.find(activeRecordFilter)
      .populate("createdBy", "name email")
      .sort({ saleDate: -1, createdAt: -1 })
      .lean<SalesPageSale[]>(),
    Sale.find({ deletedAt: { $type: "date" } })
      .populate("createdBy", "name email")
      .populate("deletedBy", "name email")
      .sort({ deletedAt: -1 })
      .lean<SalesPageSale[]>(),
  ])
  const products = await Product.find(activeRecordFilter)
    .sort({ name: 1 })
    .lean<SalesPageProduct[]>()

  const serializeSale = (sale: SalesPageSale) => {
    const displayDate = sale.saleDate ?? sale.createdAt

    return {
      _id: sale._id.toString(),
      items: sale.items.map((item) => ({
        productId: item.productId.toString(),
        name: item.name,
        sku: item.sku,
        unit: item.unit ?? "pcs",
        quantity: item.quantity,
        ...(session.isAdmin ? { basePrice: item.basePrice } : {}),
        sellingPrice: item.sellingPrice,
        lineTotal: item.lineTotal,
      })),
      totalAmount: sale.totalAmount,
      approvalStatus: sale.approvalStatus ?? "approved",
      paymentStatus: sale.paymentStatus,
      paymentMethod: sale.paymentMethod,
      notes: sale.notes,
      saleDate: sale.saleDate?.toISOString(),
      saleDateLabel: displayDate
        ? formatInKigali(displayDate, {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
        : "-",
      createdAt: sale.createdAt?.toISOString(),
      createdAtLabel: sale.createdAt
        ? formatInKigali(sale.createdAt, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
        : "-",
      updatedAt: sale.updatedAt?.toISOString(),
      deletedAt: sale.deletedAt?.toISOString(),
      deletedAtLabel: sale.deletedAt
        ? formatInKigali(sale.deletedAt, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
      deletedReason: sale.deletedReason ?? "",
      deletedByName: isPopulatedSaleUser(sale.deletedBy)
        ? sale.deletedBy.name ?? sale.deletedBy.email ?? "Unknown User"
        : undefined,
      customer: sale.customer
        ? {
            customerName: sale.customer.customerName ?? "",
            customerPhone: sale.customer.customerPhone ?? "",
          }
        : undefined,
      outstanding: sale.outstanding
        ? {
            customerName: sale.outstanding.customerName,
            customerPhone: sale.outstanding.customerPhone,
            paymentDate: sale.outstanding.paymentDate?.toISOString(),
          }
        : undefined,
      createdBy: isPopulatedSaleUser(sale.createdBy)
        ? sale.createdBy._id.toString()
        : sale.createdBy?.toString(),
      createdByName: isPopulatedSaleUser(sale.createdBy)
        ? sale.createdBy.name ?? sale.createdBy.email ?? "Unknown User"
        : "Unknown User",
    }
  }

  const serializedSales = sales.map(serializeSale)
  const serializedDeletedSales = deletedSales.map(serializeSale)

  const serializedProducts = products.map((product) => ({
    _id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    unit: product.unit ?? "pcs",
    quantity: product.quantity,
    ...(session.isAdmin ? { costPrice: product.costPrice } : {}),
    price: product.price,
  }))

  return (
    <SalesManager
      initialSales={serializedSales}
      initialDeletedSales={serializedDeletedSales}
      products={serializedProducts}
      currentUserLabel={session.email}
      canApproveSales={session.isAdmin}
    />
  )
}
