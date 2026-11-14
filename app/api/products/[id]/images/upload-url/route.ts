import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { CreateImageUploadSchema } from "@/lib/db/validators/product-website"
import { objectIdSchema } from "@/lib/db/validators/shared"
import { createUploadUrl, isStorageConfigured } from "@/lib/storage/r2"
import { WEBSITE_IMAGE_LIMITS } from "@/lib/website/categories"

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
}

/** Step 1 of an image upload: returns a short-lived signed URL for one file. */
export async function POST(
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

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { success: false, error: "Image storage is not set up yet" },
        { status: 503 }
      )
    }

    const { id } = await context.params
    if (!objectIdSchema.safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    const payload = CreateImageUploadSchema.parse(await request.json())

    await connectToDatabase()
    const product = await Product.findOne({ _id: id, ...activeRecordFilter })
      .select("website.images")
      .lean<{ website?: { images?: unknown[] } }>()

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      )
    }

    if ((product.website?.images?.length ?? 0) >= WEBSITE_IMAGE_LIMITS.maxImages) {
      return NextResponse.json(
        {
          success: false,
          error: `A product can have up to ${WEBSITE_IMAGE_LIMITS.maxImages} images`,
        },
        { status: 409 }
      )
    }

    // The server names the file; the uploaded filename is never used.
    const key = `products/${id}/${randomUUID()}.${EXTENSIONS[payload.contentType]}`
    const uploadUrl = await createUploadUrl(key, payload.contentType)

    return NextResponse.json({
      success: true,
      data: { key, uploadUrl, contentType: payload.contentType },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    console.error("[Product Image Upload URL Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to start the upload" },
      { status: 500 }
    )
  }
}
