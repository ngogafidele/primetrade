import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import "@/lib/db/models/User"
import { requireServerSession } from "@/lib/auth/server"
import { approvedSaleFilter } from "@/lib/db/sales-approval"
import { formatInKigali, getKigaliDateParts } from "@/lib/utils/time"
import { OutstandingManager } from "@/components/outstanding/outstanding-manager"

type PopulatedSaleUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type LoanSaleItem = {
  name: string
  sku: string
  unit?: string
  quantity: number
}

type LoanSale = {
  _id: { toString(): string }
  createdAt?: Date
  createdBy?: PopulatedSaleUser | { toString(): string }
  totalAmount: number
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: Date
  }
  items: LoanSaleItem[]
}

function isPopulatedSaleUser(
  value: LoanSale["createdBy"]
): value is PopulatedSaleUser {
  return typeof value === "object" && value !== null && "_id" in value
}

function getKigaliDateNumber(dateInput: Date | undefined) {
  if (!dateInput) return null

  const parts = getKigaliDateParts(dateInput)
  return parts.year * 10000 + parts.month * 100 + parts.day
}

function getPaymentDateStatus(paymentDate: Date | undefined) {
  const paymentDay = getKigaliDateNumber(paymentDate)
  if (!paymentDay) return "unknown"

  const today = getKigaliDateNumber(new Date())
  if (!today) return "unknown"

  if (paymentDay < today) return "overdue"
  if (paymentDay === today) return "due"
  return "upcoming"
}

export default async function LoansPage() {
  await requireServerSession()
  await connectToDatabase()

  const loanSales = await Sale.find({
    ...approvedSaleFilter,
    paymentStatus: "unpaid",
  })
    .populate("createdBy", "name email")
    .sort({ "outstanding.paymentDate": 1, createdAt: -1 })
    .lean<LoanSale[]>()

  const serializedSales = loanSales.map((sale) => {
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
      }),
      customerName: sale.outstanding?.customerName ?? "Not recorded",
      customerPhone: sale.outstanding?.customerPhone ?? "Not recorded",
      paymentDateLabel: formatInKigali(sale.outstanding?.paymentDate, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
      paymentDateStatus: getPaymentDateStatus(sale.outstanding?.paymentDate),
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
        <h2 className="text-2xl font-semibold">Loans</h2>
        <p className="text-sm text-muted-foreground">
          Unpaid sales with customer details and expected payment dates.
        </p>
      </div>

      <OutstandingManager initialSales={serializedSales} />
    </div>
  )
}
