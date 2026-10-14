import { Sale } from "@/lib/db/models/Sale"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import "@/lib/db/models/User"
import {
  formatKigaliDateInput,
  getKigaliDateParts,
  parseKigaliDateInput,
} from "@/lib/utils/time"

type PopulatedUser = {
  name?: string
  email?: string
}

type SalesListRecord = {
  saleDate?: Date
  createdAt?: Date
  totalAmount: number
  paymentStatus: "paid" | "unpaid"
  paymentMethod?: "cash" | "mobile-money" | "bank"
  approvalStatus?: "pending" | "approved"
  createdBy?: PopulatedUser
  customer?: {
    customerName?: string
  }
  outstanding?: {
    customerName?: string
  }
  items: SalesListItem[]
}

export type SalesListItem = {
  name: string
  sku: string
  unit?: string
  quantity: number
  basePrice: number
  sellingPrice: number
  lineTotal: number
}

export type SalesListSale = {
  date?: Date | string
  totalAmount: number
  paymentStatus: "paid" | "unpaid"
  paymentMethod?: "cash" | "mobile-money" | "bank"
  approvalStatus: "pending" | "approved"
  customerName?: string
  createdByName?: string
  items: SalesListItem[]
}

export type SalesListRange = {
  from: Date
  to: Date
  endExclusive: Date
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

// Defaults to month-to-today in Kigali; swaps from/to when given backwards.
export function getSalesListRange(searchParams: URLSearchParams): SalesListRange {
  const now = new Date()
  const nowParts = getKigaliDateParts(now)
  const todayInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-${String(
    nowParts.day
  ).padStart(2, "0")}`
  const monthStartInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-01`
  const today = parseKigaliDateInput(todayInput) ?? now
  const monthStart = parseKigaliDateInput(monthStartInput) ?? today
  const parsedFrom =
    parseKigaliDateInput(searchParams.get("from") ?? undefined) ?? monthStart
  const parsedTo =
    parseKigaliDateInput(searchParams.get("to") ?? undefined) ?? today

  const from = parsedFrom <= parsedTo ? parsedFrom : parsedTo
  const to = parsedFrom <= parsedTo ? parsedTo : parsedFrom

  return { from, to, endExclusive: addDays(to, 1) }
}

export function getSalesListFilename(range: SalesListRange, extension: string) {
  return `sales-list-${formatKigaliDateInput(range.from)}-to-${formatKigaliDateInput(
    range.to
  )}.${extension}`
}

export async function loadSalesList(
  range: SalesListRange
): Promise<SalesListSale[]> {
  const dateFilter = { $gte: range.from, $lt: range.endExclusive }

  const sales = await Sale.find({
    ...activeRecordFilter,
    $or: [
      { saleDate: dateFilter },
      { saleDate: { $exists: false }, createdAt: dateFilter },
      { saleDate: null, createdAt: dateFilter },
    ],
  })
    .populate("createdBy", "name email")
    .sort({ saleDate: -1, createdAt: -1 })
    .lean<SalesListRecord[]>()

  return sales.map((sale) => ({
    date: sale.saleDate ?? sale.createdAt,
    totalAmount: sale.totalAmount,
    paymentStatus: sale.paymentStatus,
    paymentMethod: sale.paymentMethod,
    approvalStatus: sale.approvalStatus ?? "approved",
    customerName:
      sale.paymentStatus === "unpaid"
        ? sale.outstanding?.customerName
        : sale.customer?.customerName,
    createdByName:
      sale.createdBy?.name ?? sale.createdBy?.email ?? "Unknown User",
    items: sale.items,
  }))
}
