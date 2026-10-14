import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import {
  getSalesListFilename,
  getSalesListRange,
  loadSalesList,
} from "@/lib/db/sales-list"
import { generateSalesListPDF } from "@/lib/pdf/sales-list-generator"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const range = getSalesListRange(request.nextUrl.searchParams)

    await connectToDatabase()
    const sales = await loadSalesList(range)

    const pdf = await generateSalesListPDF(
      {
        from: range.from,
        to: range.to,
        generatedAt: new Date(),
        sales,
      },
      {
        name: "Prime Trade Company Ltd",
        email: "primetrade155@gmail.com",
        phone: "Tel No: 0788746260",
      }
    )

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${getSalesListFilename(
          range,
          "pdf"
        )}"`,
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
