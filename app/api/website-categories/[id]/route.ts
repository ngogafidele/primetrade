import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { WebsiteCategory } from "@/lib/db/models/WebsiteCategory"
import { objectIdSchema } from "@/lib/db/validators/shared"
import { UpdateWebsiteCategorySchema } from "@/lib/db/validators/website-category"
import { ensureWebsiteCategories, listWebsiteCategories } from "@/lib/website/category-store"

const adminOnly = () =>
  NextResponse.json({ success: false, error: "Admin only" }, { status: 403 })

const notFound = () =>
  NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })

/** Renames a category or changes its description. Its web address (slug) stays the same. */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) return adminOnly()

    const { id } = await context.params
    if (!objectIdSchema.safeParse(id).success) return notFound()

    const payload = UpdateWebsiteCategorySchema.parse(await request.json())

    await connectToDatabase()
    await ensureWebsiteCategories()
    const existing = await listWebsiteCategories()

    if (!existing.some((category) => category.id === id)) return notFound()

    const wanted = payload.name.toLowerCase()
    if (
      existing.some(
        (category) => category.id !== id && category.name.toLowerCase() === wanted
      )
    ) {
      return NextResponse.json(
        { success: false, error: "A category with that name already exists" },
        { status: 409 }
      )
    }

    await WebsiteCategory.updateOne(
      { _id: id },
      { $set: { name: payload.name, description: payload.description } }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    console.error("[Website Category Update Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to save the category" },
      { status: 500 }
    )
  }
}

/**
 * Deletes a category. Its products stay on the website without a category.
 * Only the website category is touched: stock, prices and sales are not.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) return adminOnly()

    const { id } = await context.params
    if (!objectIdSchema.safeParse(id).success) return notFound()

    await connectToDatabase()
    await ensureWebsiteCategories()
    const existing = await listWebsiteCategories()
    const category = existing.find((candidate) => candidate.id === id)

    if (!category) return notFound()

    // An empty collection falls back to the default list, so one must remain.
    if (existing.length === 1) {
      return NextResponse.json(
        { success: false, error: "Keep at least one category. Rename this one instead." },
        { status: 409 }
      )
    }

    await WebsiteCategory.deleteOne({ _id: id })

    // If this fails the products keep an unknown slug, which the public
    // catalog already sends out as "no category".
    try {
      await Product.updateMany(
        { "website.category": category.slug },
        { $set: { "website.category": "" } }
      )
    } catch (clearError) {
      console.error("[Website Category Product Clear Error]", clearError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Website Category Delete Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete the category" },
      { status: 500 }
    )
  }
}
