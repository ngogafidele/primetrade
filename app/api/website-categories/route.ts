import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { WebsiteCategory } from "@/lib/db/models/WebsiteCategory"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import {
  CreateWebsiteCategorySchema,
  ReorderWebsiteCategoriesSchema,
} from "@/lib/db/validators/website-category"
import { WEBSITE_CATEGORY_LIMITS } from "@/lib/website/categories"
import {
  ensureWebsiteCategories,
  listWebsiteCategories,
  uniqueCategorySlug,
} from "@/lib/website/category-store"

const adminOnly = () =>
  NextResponse.json({ success: false, error: "Admin only" }, { status: 403 })

/** Categories in website order, each with the number of products shown under it. */
async function loadCategoriesWithCounts() {
  const categories = await listWebsiteCategories()
  const counts = await Product.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        ...activeRecordFilter,
        "website.isHidden": { $ne: true },
        "website.category": { $in: categories.map((category) => category.slug) },
      },
    },
    { $group: { _id: "$website.category", count: { $sum: 1 } } },
  ])
  const countBySlug = new Map(counts.map((entry) => [entry._id, entry.count]))

  return categories.map((category) => ({
    ...category,
    productCount: countBySlug.get(category.slug) ?? 0,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) return adminOnly()

    await connectToDatabase()
    await ensureWebsiteCategories()

    return NextResponse.json({
      success: true,
      data: {
        categories: await loadCategoriesWithCounts(),
        limits: WEBSITE_CATEGORY_LIMITS,
      },
    })
  } catch (error) {
    console.error("[Website Categories Fetch Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to load website categories" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) return adminOnly()

    const payload = CreateWebsiteCategorySchema.parse(await request.json())

    await connectToDatabase()
    await ensureWebsiteCategories()
    const existing = await listWebsiteCategories()

    if (existing.length >= WEBSITE_CATEGORY_LIMITS.maxCategories) {
      return NextResponse.json(
        {
          success: false,
          error: `The website can have up to ${WEBSITE_CATEGORY_LIMITS.maxCategories} categories`,
        },
        { status: 409 }
      )
    }

    const wanted = payload.name.toLowerCase()
    if (existing.some((category) => category.name.toLowerCase() === wanted)) {
      return NextResponse.json(
        { success: false, error: "A category with that name already exists" },
        { status: 409 }
      )
    }

    const last = await WebsiteCategory.findOne()
      .sort({ order: -1 })
      .select("order")
      .lean<{ order: number }>()

    await WebsiteCategory.create({
      slug: uniqueCategorySlug(
        payload.name,
        existing.map((category) => category.slug)
      ),
      name: payload.name,
      description: payload.description,
      order: (last?.order ?? -1) + 1,
    })

    return NextResponse.json(
      { success: true, data: { categories: await loadCategoriesWithCounts() } },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    console.error("[Website Category Create Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to add the category" },
      { status: 500 }
    )
  }
}

/** Saves the order the categories appear in on the website. */
export async function PUT(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) return adminOnly()

    const payload = ReorderWebsiteCategoriesSchema.parse(await request.json())

    await connectToDatabase()
    await ensureWebsiteCategories()
    const existing = await listWebsiteCategories()

    const sameSet =
      payload.ids.length === existing.length &&
      new Set(payload.ids).size === existing.length &&
      existing.every((category) => payload.ids.includes(category.id))

    if (!sameSet) {
      return NextResponse.json(
        {
          success: false,
          error: "The categories changed while you were editing. Close and reopen this window.",
        },
        { status: 409 }
      )
    }

    await WebsiteCategory.bulkWrite(
      payload.ids.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      }))
    )

    return NextResponse.json({
      success: true,
      data: { categories: await loadCategoriesWithCounts() },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    console.error("[Website Categories Reorder Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to save the category order" },
      { status: 500 }
    )
  }
}
