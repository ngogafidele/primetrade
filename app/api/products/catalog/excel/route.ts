import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { generateProductsCatalogWorkbook } from "@/lib/excel/products-catalog-workbook"
import { xlsxContentType } from "@/lib/excel/workbook"
import { loadProductCatalog } from "@/lib/products/catalog"
import { formatKigaliDateInput } from "@/lib/utils/time"

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

    await connectToDatabase()
    const products = await loadProductCatalog()
    const workbook = await generateProductsCatalogWorkbook(products)
    const filename = `products-${formatKigaliDateInput(new Date())}.xlsx`

    return new NextResponse(workbook, {
      headers: {
        "Content-Type": xlsxContentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Products Excel Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate products Excel" },
      { status: 500 }
    )
  }
}
