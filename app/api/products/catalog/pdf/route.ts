import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { generateProductsCatalogPDF } from "@/lib/pdf/products-catalog-generator"
import { loadProductCatalog } from "@/lib/products/catalog"

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

    const pdf = await generateProductsCatalogPDF(
      {
        generatedAt: new Date(),
        products,
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
        "Content-Disposition": 'attachment; filename="products-catalog.pdf"',
      },
    })
  } catch (error) {
    console.error("[Products Catalog PDF Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate products catalog PDF" },
      { status: 500 }
    )
  }
}
