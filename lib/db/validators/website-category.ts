import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"
import { WEBSITE_CATEGORY_LIMITS } from "@/lib/website/categories"

const name = z
  .string()
  .trim()
  .min(1, "Enter a category name")
  .max(WEBSITE_CATEGORY_LIMITS.nameLength, "Category name is too long")

const description = z
  .string()
  .trim()
  .max(WEBSITE_CATEGORY_LIMITS.descriptionLength, "Description is too long")

export const CreateWebsiteCategorySchema = z
  .object({ name, description: description.optional().default("") })
  .strict()

export const UpdateWebsiteCategorySchema = z.object({ name, description }).strict()

// Every category id, in the order they should appear on the website.
export const ReorderWebsiteCategoriesSchema = z
  .object({
    ids: z.array(objectIdSchema).min(1).max(WEBSITE_CATEGORY_LIMITS.maxCategories),
  })
  .strict()
