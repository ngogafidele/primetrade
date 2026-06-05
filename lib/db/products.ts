import { Product } from "@/lib/db/models/Product"
import { activeRecordFilter } from "@/lib/db/soft-delete"

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  )
}

export function duplicateKeyIncludes(error: unknown, field: string) {
  if (!isDuplicateKeyError(error)) return false
  if (!("keyPattern" in error) || typeof error.keyPattern !== "object") {
    return false
  }

  return Boolean(error.keyPattern && field in error.keyPattern)
}

export async function productNameExists(name: string, exceptProductId?: string) {
  const normalizedName = name.trim()
  const query = {
    name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: "i" },
    ...activeRecordFilter,
    ...(exceptProductId ? { _id: { $ne: exceptProductId } } : {}),
  }

  return Product.exists(query)
}
