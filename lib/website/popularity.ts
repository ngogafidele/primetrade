import type { Types } from "mongoose"
import { Sale } from "@/lib/db/models/Sale"
import { approvedSaleDateFilter } from "@/lib/db/sales-approval"

/**
 * Popularity ranking for the public website.
 *
 * A product's popularity is the number of approved sales it appears in during
 * the last `POPULARITY_WINDOW_MONTHS` months. Quantities are ignored on
 * purpose: units differ (metres of cable against single breakers), so adding
 * them up would not compare products fairly.
 *
 * Only the resulting rank (1 = most sold) is sent to the website. Sale counts,
 * quantities and amounts stay inside this app.
 */
export const POPULARITY_WINDOW_MONTHS = 12

type ProductSaleCount = { _id: Types.ObjectId; sales: number }

/** Number of approved sales each product appeared in since `since`, keyed by product id. */
export async function countProductSales(since: Date): Promise<Map<string, number>> {
  const rows = await Sale.aggregate<ProductSaleCount>([
    { $match: approvedSaleDateFilter({ $gte: since }) },
    // A product listed on two lines of one sale still counts as one sale.
    { $project: { productIds: { $setUnion: ["$items.productId", []] } } },
    { $unwind: "$productIds" },
    { $group: { _id: "$productIds", sales: { $sum: 1 } } },
  ])

  return new Map(rows.map((row) => [row._id.toString(), row.sales]))
}

export function popularityWindowStart(now = new Date()) {
  const start = new Date(now)
  start.setMonth(start.getMonth() - POPULARITY_WINDOW_MONTHS)
  return start
}

/**
 * Ranks the given products by sale count: 1 for the most sold, then 2, 3...
 * Ties are broken by name so the order is stable between requests. Products
 * with no sales in the window get no rank.
 */
export function rankByPopularity(
  products: { id: string; name: string }[],
  saleCounts: Map<string, number>
): Map<string, number> {
  const sold = products
    .filter((product) => (saleCounts.get(product.id) ?? 0) > 0)
    .sort(
      (a, b) =>
        (saleCounts.get(b.id) ?? 0) - (saleCounts.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name)
    )

  return new Map(sold.map((product, index) => [product.id, index + 1]))
}
