import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { Proforma } from "@/lib/db/models/Proforma"
import { generateProformaPDF } from "@/lib/pdf/invoice-generator"

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
    const proforma = await Proforma.findById(id)

    if (!proforma) {
      return NextResponse.json(
        { success: false, error: "Proforma not found" },
        { status: 404 }
      )
    }

    const pdf = await generateProformaPDF(
      {
        number: proforma.proformaNumber,
        date: proforma.issuedAt,
        customerName: proforma.customerName,
        customerEmail: proforma.customerEmail ?? "",
        customerPhone: proforma.customerPhone ?? "",
        totalAmount: proforma.totalAmount,
        items: (proforma.items ?? []).map((item) => ({
          description: item.description,
          unit: item.unit ?? "pcs",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      },
      { name: "Prime Trade Company Ltd", address: "Kigali" }
    )

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${proforma.proformaNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error("[Proforma PDF Error]", error)
    const detail =
      process.env.NODE_ENV !== "production" && error instanceof Error
        ? `: ${error.message}`
        : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate proforma PDF${detail}` },
      { status: 500 }
    )
  }
}
