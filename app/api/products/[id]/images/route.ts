import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { ConfirmImageUploadSchema } from "@/lib/db/validators/product-website"
import { objectIdSchema } from "@/lib/db/validators/shared"
import {
  deleteObject,
  getObjectInfo,
  isStorageConfigured,
} from "@/lib/storage/r2"
import { WEBSITE_IMAGE_LIMITS } from "@/lib/website/categories"
import { serializeWebsiteProfile } from "@/lib/website/profile"

async function discardUpload(key: string) {
  try {
    await deleteObject(key)
  } catch (error) {
    console.error("[Product Image Cleanup Error]", error)
  }
}

/**
 * Step 2 of an image upload: after the browser has sent the file to R2, this
 * checks the stored object and records it on the product.
 */
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

    const payload = ConfirmImageUploadSchema.parse(await request.json())

    // Only keys this app issued for this product are accepted.
    const keyPattern = new RegExp(
      `^products/${id}/[0-9a-f-]{36}\\.(webp|jpg|png)$`
    )
    if (!keyPattern.test(payload.key)) {
      return NextResponse.json(
        { success: false, error: "Invalid image" },
        { status: 400 }
      )
    }

    const stored = await getObjectInfo(payload.key)
    if (!stored) {
      return NextResponse.json(
        { success: false, error: "The upload did not finish. Try again." },
        { status: 400 }
      )
    }

    const allowedTypes: readonly string[] = WEBSITE_IMAGE_LIMITS.contentTypes
    if (
      stored.size <= 0 ||
      stored.size > WEBSITE_IMAGE_LIMITS.maxBytes ||
      !allowedTypes.includes(stored.contentType)
    ) {
      await discardUpload(payload.key)
      return NextResponse.json(
        { success: false, error: "Images must be WebP, JPEG or PNG, 5 MB or smaller" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    // The size condition makes the image limit hold under concurrent uploads.
    const product = await Product.findOneAndUpdate(
      {
        _id: id,
        ...activeRecordFilter,
        "website.images.key": { $ne: payload.key },
        [`website.images.${WEBSITE_IMAGE_LIMITS.maxImages - 1}`]: { $exists: false },
      },
      {
        $push: {
          "website.images": {
            key: payload.key,
            width: payload.width,
            height: payload.height,
            alt: payload.alt,
          },
        },
      },
      { returnDocument: "after", runValidators: true }
    )

    if (!product) {
      await discardUpload(payload.key)
      return NextResponse.json(
        {
          success: false,
          error: `The image was not added. A product can have up to ${WEBSITE_IMAGE_LIMITS.maxImages} images.`,
        },
        { status: 409 }
      )
    }

    const profile = serializeWebsiteProfile(product.toObject().website)

    return NextResponse.json(
      { success: true, data: { image: profile.images[profile.images.length - 1] } },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    console.error("[Product Image Confirm Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to save the image" },
      { status: 500 }
    )
  }
}
