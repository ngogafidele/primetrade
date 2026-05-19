import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { ReturnTransaction } from "@/lib/db/models/Return"
import "@/lib/db/models/User"
import { getKigaliDateParts } from "@/lib/utils/time"
import { generateReturnReceiptPDF } from "@/lib/pdf/return-receipt-generator"

export const runtime = "nodejs"

type PopulatedUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

function buildReceiptNumber(id: string, createdAt: Date | undefined) {
  const parts = getKigaliDateParts(createdAt ?? new Date())
  const datePart = `${parts.year}${String(parts.month).padStart(2, "0")}${String(
    parts.day
  ).padStart(2, "0")}`
  const suffix = id.slice(-6).toUpperCase()
  return `RET-${datePart}-${suffix}`
}

function resolveProcessedBy(value: PopulatedUser | { toString(): string } | undefined) {
  if (!value) return undefined
  if (typeof value === "object" && "_id" in value) {
    return value.name ?? value.email
  }
  return undefined
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const returnRecord = await ReturnTransaction.findById(id).populate(
      "createdBy",
      "name email"
    )

    if (!returnRecord) {
      return NextResponse.json(
        { success: false, error: "Return not found" },
        { status: 404 }
      )
    }

    const receiptNumber = buildReceiptNumber(
      returnRecord._id.toString(),
      returnRecord.createdAt
    )

    const pdf = await generateReturnReceiptPDF(
      {
        receiptNumber,
        date: returnRecord.createdAt,
        processedBy: resolveProcessedBy(returnRecord.createdBy as PopulatedUser),
        notes: returnRecord.notes ?? "",
        returnItems: returnRecord.returnItems.map((item) => ({
          description: item.name,
          sku: item.sku,
          unit: item.unit ?? "pcs",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        totalReturnAmount: returnRecord.totalReturnAmount,
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
        "Content-Disposition": `attachment; filename="${receiptNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Return Receipt PDF Error]", error)
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate return receipt PDF${detail}` },
      { status: 500 }
    )
  }
}
