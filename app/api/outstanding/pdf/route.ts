import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { Sale } from "@/lib/db/models/Sale"
import "@/lib/db/models/User"
import { approvedSaleFilter } from "@/lib/db/sales-approval"
import { getKigaliDateParts } from "@/lib/utils/time"
import { formatCurrency } from "@/lib/utils/format"
import { generateOutstandingCustomerPDF } from "@/lib/pdf/outstanding-generator"

export const runtime = "nodejs"

type PopulatedUser = {
  _id: { toString(): string }
  name?: string
  email?: string
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

    if (customerPhone) {
      query["outstanding.customerPhone"] = customerPhone
    }

    const sales = await Sale.find(query)
      .populate("createdBy", "name email")
      .sort({ "outstanding.paymentDate": 1, createdAt: -1 })

    if (sales.length === 0) {
      return NextResponse.json(
        { success: false, error: "No loan records found" },
        { status: 404 }
      )
    }

    const totalAmount = sales.reduce((sum, sale) => sum + sale.totalAmount, 0)
    const statementNumber = buildStatementNumber(sales[0]?._id.toString())

    const pdf = await generateOutstandingCustomerPDF(
      {
        number: statementNumber,
        generatedAt: new Date(),
        customerName,
        customerPhone: customerPhone ?? sales[0]?.outstanding?.customerPhone ?? "",
        totalAmount,
        sales: sales.map((sale) => ({
          saleDate: sale.createdAt,
          paymentDate: sale.outstanding?.paymentDate,
          items:
            sale.items
              .map((item) => `${item.name} (${item.quantity} ${item.unit ?? "pcs"})`)
              .join(", ") || "No items",
          unitPrices:
            sale.items
              .map((item) => `${item.name}: ${formatCurrency(item.sellingPrice)}`)
              .join(", ") || "-",
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
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate loan PDF${detail}` },
      { status: 500 }
    )
  }
}
