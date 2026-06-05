export const activeRecordFilter = {
  deletedAt: null,
} as const

export function withActiveRecords<T extends Record<string, unknown>>(
  filter: T = {} as T
) {
  return {
    ...filter,
    ...activeRecordFilter,
  }
}
