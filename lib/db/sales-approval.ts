export const approvedSaleFilter = {
  deletedAt: null,
  $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
}

export function approvedSaleDateFilter(dateRange: Record<string, unknown>) {
  return {
    $and: [
      approvedSaleFilter,
      {
        $or: [
          { saleDate: dateRange },
          {
            saleDate: { $exists: false },
            approvedAt: dateRange,
          },
          {
            saleDate: null,
            approvedAt: dateRange,
          },
          {
            saleDate: { $exists: false },
            approvedAt: { $exists: false },
            createdAt: dateRange,
          },
          {
            saleDate: { $exists: false },
            approvedAt: null,
            createdAt: dateRange,
          },
          {
            saleDate: null,
            approvedAt: { $exists: false },
            createdAt: dateRange,
          },
          {
            saleDate: null,
            approvedAt: null,
            createdAt: dateRange,
          },
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
