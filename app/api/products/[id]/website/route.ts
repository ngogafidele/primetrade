import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { UpdateProductWebsiteSchema } from "@/lib/db/validators/product-website"
import { objectIdSchema } from "@/lib/db/validators/shared"
import { isStorageConfigured } from "@/lib/storage/r2"
import { WEBSITE_IMAGE_LIMITS } from "@/lib/website/categories"
import { listWebsiteCategories } from "@/lib/website/category-store"
import {
  serializeWebsiteProfile,
  type StoredWebsiteProfile,
} from "@/lib/website/profile"

type ProductWebsiteLean = {
  _id: { toString(): string }
  name: string
  sku: string
  website?: StoredWebsiteProfile
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    if (!objectIdSchema.safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    await connectToDatabase()
    const product = await Product.findOne({ _id: id, ...activeRecordFilter })
      .select("name sku website")
      .lean<ProductWebsiteLean>()

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        profile: serializeWebsiteProfile(product.website),
        categories: (await listWebsiteCategories()).map(({ slug, name }) => ({
          slug,
          name,
        })),
        limits: WEBSITE_IMAGE_LIMITS,
        storageConfigured: isStorageConfigured(),
      },
    })
  } catch (error) {
    console.error("[Product Website Fetch Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to load website details" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    if (!objectIdSchema.safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    const payload = UpdateProductWebsiteSchema.parse(await request.json())

    await connectToDatabase()

    if (payload.category) {
      const categories = await listWebsiteCategories()
      if (!categories.some((category) => category.slug === payload.category)) {
        return NextResponse.json(
          {
            success: false,
            error: "That category no longer exists. Choose another one.",
          },
          { status: 400 }
        )
      }
    }

    const product = await Product.findOne({ _id: id, ...activeRecordFilter })

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    // The payload lists the images to keep, in order. It must match what is
    // stored: images are only added or removed through the image routes.
    const storedImages = product.website?.images ?? []
    const storedById = new Map(
      storedImages.map((image) => [image._id.toString(), image])
    )
    const sameImages =
      payload.images.length === storedImages.length &&
      new Set(payload.images.map((image) => image.id)).size === storedImages.length &&
      payload.images.every((image) => storedById.has(image.id))

    if (!sameImages) {
      return NextResponse.json(
        {
          success: false,
          error: "The images changed while you were editing. Close and reopen this product.",
        },
        { status: 409 }
      )
    }

    product.set("website.isHidden", !payload.isPublished)
    product.set("website.category", payload.category)
    product.set("website.brand", payload.brand)
    product.set("website.description", payload.description)
    product.set("website.specs", payload.specs)
    product.set(
      "website.images",
      payload.images.map((image) => {
        const stored = storedById.get(image.id)!
        return {
          _id: stored._id,
          key: stored.key,
          width: stored.width,
          height: stored.height,
          alt: image.alt,
        }
      })
    )
    await product.save()

    return NextResponse.json({
      success: true,
      data: { profile: serializeWebsiteProfile(product.toObject().website) },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    console.error("[Product Website Update Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to save website details" },
      { status: 500 }
    )
  }
}
