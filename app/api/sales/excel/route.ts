import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import {
  getSalesListFilename,
  getSalesListRange,
  loadSalesList,
} from "@/lib/db/sales-list"
import { generateSalesListWorkbook } from "@/lib/excel/sales-list-workbook"
import { xlsxContentType } from "@/lib/excel/workbook"

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

    const workbook = await generateSalesListWorkbook({
      from: range.from,
      to: range.to,
      generatedAt: new Date(),
      sales,
    })

    return new NextResponse(workbook, {
      headers: {
        "Content-Type": xlsxContentType,
        "Content-Disposition": `attachment; filename="${getSalesListFilename(
          range,
          "xlsx"
        )}"`,
      },
    })
  } catch (error) {
    console.error("[Sales List Excel Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate sales list Excel" },
      { status: 500 }
    )
  }
}
