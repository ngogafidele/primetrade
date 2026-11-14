import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { objectIdSchema } from "@/lib/db/validators/shared"
import { deleteObject, isStorageConfigured } from "@/lib/storage/r2"

type ProductImagesLean = {
  website?: { images?: { _id: { toString(): string }; key: string }[] }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id, imageId } = await context.params
    if (
      !objectIdSchema.safeParse(id).success ||
      !objectIdSchema.safeParse(imageId).success
    ) {
      return NextResponse.json(
        { success: false, error: "Image not found" },
        { status: 404 }
      )
    }

    await connectToDatabase()

    // Returns the product as it was before the image was pulled, so the R2
    // key of the removed image is still available.
    const before = await Product.findOneAndUpdate(
      { _id: id, ...activeRecordFilter, "website.images._id": imageId },
      { $pull: { "website.images": { _id: imageId } } },
      { returnDocument: "before" }
    )
      .select("website.images")
      .lean<ProductImagesLean>()

    const removed = before?.website?.images?.find(
      (image) => image._id.toString() === imageId
    )

    if (!removed) {
      return NextResponse.json(
        { success: false, error: "Image not found" },
        { status: 404 }
      )
    }

    // The product no longer references the file. If deleting it from R2 fails
    // the file is only an orphan, so log and continue.
    if (isStorageConfigured()) {
      try {
        await deleteObject(removed.key)
      } catch (storageError) {
        console.error("[Product Image Delete Error]", storageError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Product Image Remove Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to remove the image" },
      { status: 500 }
    )
  }
}
