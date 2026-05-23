export const approvedExpenseFilter = {
  $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
}

export function approvedExpenseDateFilter(dateFilter: Record<string, unknown>) {
  return {
    ...approvedExpenseFilter,
    $and: [
      {
        $or: [
          { incurredAt: dateFilter },
          { incurredAt: { $exists: false }, createdAt: dateFilter },
          { incurredAt: null, createdAt: dateFilter },
        ],
      },
    ],
  }
}
