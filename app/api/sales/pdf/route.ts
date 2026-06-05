import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import "@/lib/db/models/User"
import { generateSalesListPDF } from "@/lib/pdf/sales-list-generator"
import {
  formatKigaliDateInput,
  getKigaliDateParts,
  parseKigaliDateInput,
} from "@/lib/utils/time"

export const runtime = "nodejs"

type PopulatedUser = {
  name?: string
  email?: string
}

type SalesListSale = {
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
  items: Array<{
    name: string
    sku: string
    unit?: string
    quantity: number
    basePrice: number
    sellingPrice: number
    lineTotal: number
  }>
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getDateRange(request: NextRequest) {
  const now = new Date()
  const nowParts = getKigaliDateParts(now)
  const todayInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-${String(
    nowParts.day
  ).padStart(2, "0")}`
  const monthStartInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-01`
  const today = parseKigaliDateInput(todayInput) ?? now
  const monthStart = parseKigaliDateInput(monthStartInput) ?? today
  const parsedFrom =
    parseKigaliDateInput(request.nextUrl.searchParams.get("from") ?? undefined) ??
    monthStart
  const parsedTo =
    parseKigaliDateInput(request.nextUrl.searchParams.get("to") ?? undefined) ??
    today

  const from = parsedFrom <= parsedTo ? parsedFrom : parsedTo
  const to = parsedFrom <= parsedTo ? parsedTo : parsedFrom

  return { from, to, endExclusive: addDays(to, 1) }
}

export async function GET(request: NextRequest) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const range = getDateRange(request)
    const dateFilter = { $gte: range.from, $lt: range.endExclusive }

    await connectToDatabase()
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
      .lean<SalesListSale[]>()

    const pdf = await generateSalesListPDF(
      {
        from: range.from,
        to: range.to,
        generatedAt: new Date(),
        sales: sales.map((sale) => ({
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
        })),
      },
      {
        name: "Prime Trade Company Ltd",
        email: "primetrade155@gmail.com",
        phone: "Tel No: 0788746260",
      }
    )

    const filename = `sales-list-${formatKigaliDateInput(range.from)}-to-${formatKigaliDateInput(
      range.to
    )}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Sales List PDF Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate sales list PDF" },
      { status: 500 }
    )
  }
}
