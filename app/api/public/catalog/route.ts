import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { listWebsiteCategories } from "@/lib/website/category-store"
import { toPublicProduct, type WebsiteProductSource } from "@/lib/website/profile"

/**
 * Read-only catalog for the public website (primepublic).
 *
 * This is the only route that serves data without a staff session. It is
 * called server to server with a shared secret, returns every active product
 * except those an admin has hidden from the website, and sends only the fields
 * built by `toPublicProduct`.
 * Prices, cost, stock and supplier data are never selected from the database.
 */
function isAuthorized(request: NextRequest) {
  const expected = process.env.PUBLIC_CATALOG_TOKEN
  if (!expected) return false

  const header = request.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : ""
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)

  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  )
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.PUBLIC_CATALOG_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Public catalog is not set up" },
        { status: 503 }
      )
    }

    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    await connectToDatabase()
    const products = await Product.find({
      ...activeRecordFilter,
      // Products are on the website by default; only an explicit hide removes one.
      "website.isHidden": { $ne: true },
    })
      .select("name sku unit website")
      .sort({ name: 1 })
      .lean<WebsiteProductSource[]>()

    const categories = (await listWebsiteCategories()).map(
      ({ slug, name, description }) => ({ slug, name, description })
    )
    const categorySlugs = new Set(categories.map((category) => category.slug))

    return NextResponse.json(
      {
        success: true,
        data: {
          categories,
          // A product may be published without a category, or keep a slug
          // that was later removed from the list; both go out uncategorised.
          products: products.map(toPublicProduct).map((product) => ({
            ...product,
            categorySlug: categorySlugs.has(product.categorySlug)
              ? product.categorySlug
              : "",
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("[Public Catalog Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to load the catalog" },
      { status: 500 }
    )
  }
}
