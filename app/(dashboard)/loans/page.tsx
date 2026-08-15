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
  saleDate?: Date
  createdAt?: Date
  createdBy?: PopulatedSaleUser | { toString(): string }
  totalAmount: number
  amountPaid?: number
  remainingBalance?: number
  payments?: Array<{
    amount: number
    paymentMethod: "cash" | "mobile-money" | "bank"
    paidAt?: Date
    notes?: string
  }>
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: Date
  }
  items: LoanSaleItem[]
  deletedAt?: Date
  deletedBy?: PopulatedSaleUser | { toString(): string }
}

type PaymentDateStatus = "overdue" | "due" | "upcoming" | "unknown"

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

function getPaymentDateStatus(
  paymentDate: Date | undefined
): PaymentDateStatus {
  const paymentDay = getKigaliDateNumber(paymentDate)
  if (!paymentDay) return "unknown"

  const today = getKigaliDateNumber(new Date())
  if (!today) return "unknown"

  if (paymentDay < today) return "overdue"
  if (paymentDay === today) return "due"
  return "upcoming"
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getAmountPaid(sale: LoanSale) {
  if (typeof sale.amountPaid === "number") return roundMoney(sale.amountPaid)
  return roundMoney(
    (sale.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
  )
}

function getRemainingBalance(sale: LoanSale) {
  if (typeof sale.remainingBalance === "number") {
    return roundMoney(sale.remainingBalance)
  }

  return Math.max(0, roundMoney(sale.totalAmount - getAmountPaid(sale)))
}

function resolveUserName(value: LoanSale["createdBy"]) {
  return isPopulatedSaleUser(value)
    ? value.name ?? value.email ?? "Unknown User"
    : "Unknown User"
}

function serializeLoan(sale: LoanSale) {
  const effectiveDate = sale.saleDate ?? sale.createdAt

  return {
    _id: sale._id.toString(),
    createdAt: effectiveDate?.toISOString(),
    createdAtLabel: formatInKigali(effectiveDate, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }),
    customerName: sale.outstanding?.customerName ?? "Not recorded",
    customerPhone: sale.outstanding?.customerPhone ?? "Not recorded",
    paymentDate: sale.outstanding?.paymentDate?.toISOString(),
    paymentDateLabel: formatInKigali(sale.outstanding?.paymentDate, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }),
    paymentDateStatus: getPaymentDateStatus(sale.outstanding?.paymentDate),
    items: sale.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
    })),
    recordedBy: resolveUserName(sale.createdBy),
    totalAmount: sale.totalAmount,
    amountPaid: getAmountPaid(sale),
    remainingBalance: getRemainingBalance(sale),
    payments: (sale.payments ?? []).map((payment) => ({
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt?.toISOString(),
      notes: payment.notes ?? "",
    })),
  }
}

export default async function LoansPage() {
  const session = await requireServerSession()
  await connectToDatabase()

  const loanFilter: Record<string, unknown> = {
    ...approvedSaleFilter,
    paymentStatus: "unpaid",
  }

  if (!session.isAdmin) {
    loanFilter.createdBy = session.userId
  }

  const [loanSales, deletedLoanSales] = await Promise.all([
    Sale.find(loanFilter)
      .populate("createdBy", "name email")
      .sort({ saleDate: -1, createdAt: -1 })
      .lean<LoanSale[]>(),
    session.isAdmin
      ? Sale.find({
          paymentStatus: "unpaid",
          deletedAt: { $ne: null },
          $or: [
            { approvalStatus: "approved" },
            { approvalStatus: { $exists: false } },
          ],
        })
          .populate("createdBy", "name email")
          .populate("deletedBy", "name email")
          .sort({ deletedAt: -1 })
          .lean<LoanSale[]>()
      : Promise.resolve<LoanSale[]>([]),
  ])

  const serializedSales = loanSales.map(serializeLoan)
  const serializedDeletedSales = deletedLoanSales.map((sale) => ({
    ...serializeLoan(sale),
    deletedAtLabel: formatInKigali(sale.deletedAt, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }),
    deletedByName: resolveUserName(sale.deletedBy),
  }))

  return (
    <OutstandingManager
      initialSales={serializedSales}
      initialDeletedSales={serializedDeletedSales}
      isAdmin={session.isAdmin}
      canViewLoanTotals={session.isAdmin}
    />
  )
}
