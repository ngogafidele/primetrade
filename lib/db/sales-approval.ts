export const approvedSaleFilter = {
  $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
}

export function approvedSaleDateFilter(dateRange: Record<string, unknown>) {
  return {
    $and: [
      approvedSaleFilter,
      {
        $or: [
          { approvedAt: dateRange },
          { approvedAt: { $exists: false }, createdAt: dateRange },
          { approvedAt: null, createdAt: dateRange },
        ],
      },
    ],
  }
}

export function withApprovedSalesFilter<T extends Record<string, unknown>>(
  filter: T = {} as T
) {
  return {
    ...filter,
    ...approvedSaleFilter,
  }
}
