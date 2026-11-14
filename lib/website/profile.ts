import { getPublicImageUrl } from "@/lib/storage/r2"

/**
 * Website profile helpers.
 *
 * `serializeWebsiteProfile` feeds the admin "Website" dialog.
 * `toPublicProduct` builds what the public website receives. It copies fields
 * one by one from an allow-list and must never spread a product document:
 * cost price, selling price, stock quantity, supplier and deletion data stay
 * inside this app.
 */
type StoredImage = {
  _id: unknown
  key: string
  width?: number
  height?: number
  alt?: string
}

type StoredSpec = { label?: string; value?: string }

export type StoredWebsiteProfile = {
  isHidden?: boolean
  category?: string
  brand?: string
  description?: string
  specs?: StoredSpec[]
  images?: StoredImage[]
}

export type WebsiteProductSource = {
  name: string
  sku: string
  unit?: string
  website?: StoredWebsiteProfile | null
}

function serializeImages(images: StoredImage[] | undefined) {
  return (images ?? []).map((image) => ({
    id: image._id?.toString() ?? "",
    url: getPublicImageUrl(image.key) ?? "",
    width: image.width ?? 0,
    height: image.height ?? 0,
    alt: image.alt ?? "",
  }))
}

export function serializeWebsiteProfile(website: StoredWebsiteProfile | null | undefined) {
  return {
    // Shown unless an admin hid it; products without a website profile are shown.
    isPublished: !website?.isHidden,
    category: website?.category ?? "",
    brand: website?.brand ?? "",
    description: website?.description ?? "",
    specs: (website?.specs ?? []).map((spec) => ({
      label: spec.label ?? "",
      value: spec.value ?? "",
    })),
    images: serializeImages(website?.images),
  }
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** First sentence of the description, capped for use on product cards. */
function summarize(description: string) {
  const firstSentence = description.split(/(?<=[.!?])\s/)[0]?.trim() ?? ""
  return firstSentence.length > 140
    ? `${firstSentence.slice(0, 137).trimEnd()}...`
    : firstSentence
}

export function toPublicProduct(product: WebsiteProductSource) {
  const website = product.website ?? {}
  const description = website.description?.trim() ?? ""
  const specs = (website.specs ?? [])
    .map((spec) => ({ label: spec.label?.trim() ?? "", value: spec.value?.trim() ?? "" }))
    .filter((spec) => spec.label && spec.value)

  return {
    id: product.sku,
    slug: [slugify(product.name), slugify(product.sku)].filter(Boolean).join("-"),
    name: product.name,
    categorySlug: website.category ?? "",
    brand: website.brand?.trim() || undefined,
    summary: summarize(description),
    description,
    specs,
    unit: product.unit ?? "pcs",
    images: serializeImages(website.images)
      .filter((image) => image.url)
      .map((image) => ({
        src: image.url,
        alt: image.alt || product.name,
        width: image.width,
        height: image.height,
      })),
  }
}
