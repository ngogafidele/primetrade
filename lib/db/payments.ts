import { Sale } from "@/lib/db/models/Sale"
import { approvedSaleDateFilter, approvedSaleFilter } from "@/lib/db/sales-approval"

export type PaymentMethodTotals = {
  cash: number
  "mobile-money": number
  bank: number
}

type MethodBucket = {
  _id: "cash" | "mobile-money" | "bank" | null
  total: number
}

export async function getPaymentMethodTotals(
  dateFilter: Record<string, Date>
): Promise<PaymentMethodTotals> {
  const [result] = await Sale.aggregate<{
    pointOfSale: MethodBucket[]
    installments: MethodBucket[]
  }>([
    { $match: approvedSaleFilter },
    {
      $facet: {
        pointOfSale: [
          {
            $match: {
              ...approvedSaleDateFilter(dateFilter),
              paymentStatus: "paid",
              paymentMethod: { $in: ["cash", "mobile-money", "bank"] },
              $expr: {
                $eq: [{ $size: { $ifNull: ["$payments", []] } }, 0],
              },
            },
          },
          {
            $group: { _id: "$paymentMethod", total: { $sum: "$totalAmount" } },
          },
        ],
        installments: [
          { $unwind: "$payments" },
          { $match: { "payments.paidAt": dateFilter } },
          {
            $group: {
              _id: "$payments.paymentMethod",
              total: { $sum: "$payments.amount" },
            },
          },
        ],
      },
    },
  ])

  const totals: PaymentMethodTotals = {
    cash: 0,
    "mobile-money": 0,
    bank: 0,
  }
  const add = (buckets: MethodBucket[] | undefined) => {
    ;(buckets ?? []).forEach((bucket) => {
      if (
        bucket._id === "cash" ||
        bucket._id === "mobile-money" ||
        bucket._id === "bank"
      ) {
        totals[bucket._id] += bucket.total
      }
    })
  }

  add(result?.pointOfSale)
  add(result?.installments)

  return totals
}
