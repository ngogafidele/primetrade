import { WebsiteCategory } from "@/lib/db/models/WebsiteCategory"
import { DEFAULT_WEBSITE_CATEGORIES } from "@/lib/website/categories"

/**
 * Website categories as stored in the database.
 *
 * Reads never write: while the collection is empty they return the default
 * list. The admin category routes call `ensureWebsiteCategories` first, which
 * copies the defaults into the database once so they can be edited. Call
 * `connectToDatabase()` before using anything here.
 */
export type WebsiteCategoryRecord = {
  /** Empty while the defaults have not been saved to the database yet. */
  id: string
  slug: string
  name: string
  description: string
}

type WebsiteCategoryLean = {
  _id: { toString(): string }
  slug: string
  name: string
  description?: string
}

export async function listWebsiteCategories(): Promise<WebsiteCategoryRecord[]> {
  const stored = await WebsiteCategory.find()
    .sort({ order: 1, name: 1 })
    .lean<WebsiteCategoryLean[]>()

  if (stored.length === 0) {
    return DEFAULT_WEBSITE_CATEGORIES.map((category) => ({ id: "", ...category }))
  }

  return stored.map((category) => ({
    id: category._id.toString(),
    slug: category.slug,
    name: category.name,
    description: category.description ?? "",
  }))
}

/** Copies the default categories into the database the first time they are managed. */
export async function ensureWebsiteCategories() {
  if ((await WebsiteCategory.estimatedDocumentCount()) > 0) return

  try {
    await WebsiteCategory.insertMany(
      DEFAULT_WEBSITE_CATEGORIES.map((category, index) => ({ ...category, order: index })),
      { ordered: false }
    )
  } catch (error) {
    // Two admins opening the manager at once: the unique slug index keeps one copy.
    const duplicate =
      typeof error === "object" && error !== null && "code" in error && error.code === 11000
    if (!duplicate) throw error
  }
}

/** "Solar & Backup" -> "solar-backup". Matches the slug format the website accepts. */
export function slugifyCategoryName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
}

/** A slug for a new category that no existing category uses. */
export function uniqueCategorySlug(name: string, taken: Iterable<string>) {
  const used = new Set(taken)
  const base = slugifyCategoryName(name) || "category"
  let slug = base
  for (let suffix = 2; used.has(slug); suffix += 1) slug = `${base}-${suffix}`
  return slug
}
