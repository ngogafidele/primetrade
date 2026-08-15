import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { Sale } from "@/lib/db/models/Sale"
import "@/lib/db/models/User"
import { approvedSaleFilter } from "@/lib/db/sales-approval"
import { getKigaliDateParts } from "@/lib/utils/time"
import { generateOutstandingCustomerPDF } from "@/lib/pdf/outstanding-generator"

export const runtime = "nodejs"

type PopulatedUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type OutstandingSale = {
  _id: { toString(): string }
  saleDate?: Date
  createdAt?: Date
  totalAmount: number
  amountPaid?: number
  remainingBalance?: number
  payments?: Array<{
    amount: number
    paymentMethod: "cash" | "mobile-money" | "bank"
    paidAt?: Date
    notes?: string
  }>
  items: Array<{
    name: string
    unit?: string
    quantity: number
    sellingPrice: number
    lineTotal: number
  }>
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: Date
  }
  createdBy?: PopulatedUser | { toString(): string }
  notes?: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function resolveRecordedBy(value: PopulatedUser | { toString(): string } | undefined) {
  if (!value) return undefined
  if (typeof value === "object" && "_id" in value) {
    return value.name ?? value.email
  }
  return undefined
}

function buildStatementNumber(id: string | undefined) {
  const parts = getKigaliDateParts(new Date())
  const datePart = `${parts.year}${String(parts.month).padStart(2, "0")}${String(
    parts.day
  ).padStart(2, "0")}`
  const suffix = (id ?? "CUSTOMER").slice(-6).toUpperCase()
  return `LOAN-${datePart}-${suffix}`
}

function safeFilePart(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "customer"
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getAmountPaid(sale: OutstandingSale) {
  if (typeof sale.amountPaid === "number") return roundMoney(sale.amountPaid)
  return roundMoney(
    (sale.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
  )
}

function getRemainingBalance(sale: OutstandingSale) {
  if (typeof sale.remainingBalance === "number") {
    return roundMoney(sale.remainingBalance)
  }

  return Math.max(0, roundMoney(sale.totalAmount - getAmountPaid(sale)))
}

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const customerName = request.nextUrl.searchParams.get("customerName")?.trim()
    const customerPhone = request.nextUrl.searchParams.get("customerPhone")?.trim()

    if (!customerName) {
      return NextResponse.json(
        { success: false, error: "Customer name is required" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const query: Record<string, unknown> = {
      ...approvedSaleFilter,
      paymentStatus: "unpaid",
      "outstanding.customerName": {
        $regex: `^${escapeRegExp(customerName)}$`,
        $options: "i",
      },
    }

    if (!session.isAdmin) {
      query.createdBy = session.userId
    }

    if (customerPhone) {
      query["outstanding.customerPhone"] = customerPhone
    }

    const sales = await Sale.find(query)
      .populate("createdBy", "name email")
      .sort({ "outstanding.paymentDate": 1, createdAt: -1 })
      .lean<OutstandingSale[]>()

    if (sales.length === 0) {
      return NextResponse.json(
        { success: false, error: "No loan records found" },
        { status: 404 }
      )
    }

    const totalAmount = sales.reduce((sum, sale) => sum + sale.totalAmount, 0)
    const totalPaid = sales.reduce((sum, sale) => sum + getAmountPaid(sale), 0)
    const totalOutstanding = sales.reduce(
      (sum, sale) => sum + getRemainingBalance(sale),
      0
    )
    const statementNumber = buildStatementNumber(sales[0]?._id.toString())

    const pdf = await generateOutstandingCustomerPDF(
      {
        number: statementNumber,
        generatedAt: new Date(),
        customerName,
        customerPhone: customerPhone ?? sales[0]?.outstanding?.customerPhone ?? "",
        totalAmount,
        totalPaid,
        totalOutstanding,
        payments: sales.flatMap((sale) =>
          (sale.payments ?? []).map((payment) => ({
            paidAt: payment.paidAt,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            notes: payment.notes,
          }))
        ),
        sales: sales.map((sale) => ({
          saleDate: sale.saleDate ?? sale.createdAt,
          paymentDate: sale.outstanding?.paymentDate,
          items: sale.items.map((item) => ({
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            sellingPrice: item.sellingPrice,
            lineTotal: item.lineTotal,
          })),
          recordedBy: resolveRecordedBy(sale.createdBy as PopulatedUser),
          notes: sale.notes ?? "",
          totalAmount: sale.totalAmount,
        })),
      },
      {
        name: "Prime Trade Company Ltd",
        email: "Email: primetrade155@gmail.com",
        phone: "Tel No: 0788746260",
      }
    )

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${statementNumber}-${safeFilePart(
          customerName
        )}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Loan PDF Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate loan PDF" },
      { status: 500 }
    )
  }
}
