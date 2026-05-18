import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import "@/lib/db/models/User"
import { requireServerSession } from "@/lib/auth/server"
import { formatInKigali } from "@/lib/utils/time"
import { OutstandingManager } from "@/components/outstanding/outstanding-manager"

type PopulatedSaleUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type OutstandingSaleItem = {
  name: string
  sku: string
  unit?: string
  quantity: number
}

type OutstandingSale = {
  _id: { toString(): string }
  createdAt?: Date
  createdBy?: PopulatedSaleUser | { toString(): string }
  totalAmount: number
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: Date
  }
  items: OutstandingSaleItem[]
}

function isPopulatedSaleUser(
  value: OutstandingSale["createdBy"]
): value is PopulatedSaleUser {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function OutstandingPage() {
  await requireServerSession()
  await connectToDatabase()

  const outstandingSales = await Sale.find({ paymentStatus: "unpaid" })
    .populate("createdBy", "name email")
    .sort({ "outstanding.paymentDate": 1, createdAt: -1 })
    .lean<OutstandingSale[]>()

  const serializedSales = outstandingSales.map((sale) => {
    const recordedBy = isPopulatedSaleUser(sale.createdBy)
      ? sale.createdBy.name ?? sale.createdBy.email ?? "Unknown User"
      : "Unknown User"
    const itemSummary = sale.items
      .map((item) => `${item.name} (${item.quantity} ${item.unit ?? "pcs"})`)
      .join(", ")

    return {
      _id: sale._id.toString(),
      createdAtLabel: formatInKigali(sale.createdAt, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      customerName: sale.outstanding?.customerName ?? "Not recorded",
      customerPhone: sale.outstanding?.customerPhone ?? "Not recorded",
      paymentDateLabel: formatInKigali(sale.outstanding?.paymentDate, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
      itemSummary: itemSummary || "No items",
      recordedBy,
      totalAmount: sale.totalAmount,
    }
  })

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Receivables
        </p>
        <h2 className="text-2xl font-semibold">Outstanding</h2>
        <p className="text-sm text-muted-foreground">
          Unpaid sales with customer details and expected payment dates.
        </p>
      </div>

      <OutstandingManager initialSales={serializedSales} />
    </div>
  )
}
