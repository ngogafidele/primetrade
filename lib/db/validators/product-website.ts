import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"
import { WEBSITE_IMAGE_LIMITS } from "@/lib/website/categories"

export const UpdateProductWebsiteSchema = z
  .object({
    isPublished: z.boolean(),
    // A website category slug, or "" for none. The route checks it exists.
    category: z.union([
      z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Unknown category").max(80),
      z.literal(""),
    ]),
    brand: z.string().trim().max(80, "Brand is too long"),
    description: z.string().trim().max(2000, "Description is too long"),
    specs: z
      .array(
        z
          .object({
            label: z.string().trim().min(1, "Every specification needs a label").max(60),
            value: z.string().trim().min(1, "Every specification needs a value").max(120),
          })
          .strict()
      )
      .max(20, "A product can have up to 20 specifications"),
    // The images to keep, in display order, with their alt text.
    images: z
      .array(
        z
          .object({
            id: objectIdSchema,
            alt: z.string().trim().max(160, "Image description is too long"),
          })
          .strict()
      )
      .max(WEBSITE_IMAGE_LIMITS.maxImages),
  })
  .strict()

export const CreateImageUploadSchema = z
  .object({
    contentType: z.enum(WEBSITE_IMAGE_LIMITS.contentTypes, {
      message: "Images must be WebP, JPEG or PNG",
    }),
    size: z
      .number()
      .int()
      .positive()
      .max(WEBSITE_IMAGE_LIMITS.maxBytes, "Images must be 5 MB or smaller"),
  })
  .strict()

export const ConfirmImageUploadSchema = z
  .object({
    key: z.string().min(1).max(200),
    width: z.number().int().positive().max(10000),
    height: z.number().int().positive().max(10000),
    alt: z.string().trim().max(160).optional().default(""),
  })
  .strict()
