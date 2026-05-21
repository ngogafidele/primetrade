import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { Invoice } from "@/lib/db/models/Invoice"
import "@/lib/db/models/User"
import { Sale } from "@/lib/db/models/Sale"
import { generateSalesInvoicePDF } from "@/lib/pdf/invoice-generator"

export const runtime = "nodejs"

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
    const invoice = mongoose.isValidObjectId(id)
      ? await Invoice.findOne({
          $or: [{ _id: id }, { saleId: id }],
        }).populate("createdBy", "name email")
      : null

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found for this sale" },
        { status: 404 }
      )
    }

    let items = (invoice.items ?? []).map((item) => ({
      description: item.description,
      sku: item.sku ?? "",
      unit: item.unit ?? "pcs",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }))

    if (items.length === 0 && invoice.saleId) {
      const sale = await Sale.findById(invoice.saleId)
      items =
        sale?.items.map((item) => ({
          description: item.name,
          sku: item.sku,
          unit: item.unit ?? "pcs",
          quantity: item.quantity,
          unitPrice: item.sellingPrice,
          lineTotal: item.lineTotal,
        })) ?? []
    }

    const processedBy =
      typeof invoice.createdBy === "object" && invoice.createdBy !== null
        ? invoice.createdBy.name ?? invoice.createdBy.email
        : undefined

    const pdf = await generateSalesInvoicePDF(
      {
        number: invoice.invoiceNumber,
        date: invoice.issuedAt,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail ?? "",
        customerPhone: invoice.customerPhone ?? "",
        status: invoice.status,
        processedBy,
        notes: invoice.notes ?? "",
        totalAmount: invoice.totalAmount,
        items,
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
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Sales Invoice PDF Error]", error)
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate invoice PDF${detail}` },
      { status: 500 }
    )
  }
}
