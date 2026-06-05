type SaleLike = {
  toObject?: () => Record<string, unknown>
  items?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export function serializeSaleForSession<T extends SaleLike>(
  sale: T,
  includeCostPrice: boolean
) {
  const data =
    typeof sale.toObject === "function" ? sale.toObject() : { ...sale }

  if (includeCostPrice || !Array.isArray(data.items)) {
    return data
  }

  return {
    ...data,
    items: data.items.map((item) => {
      const { basePrice: _basePrice, ...safeItem } = item
      return safeItem
    }),
  }
}

export function serializeSalesForSession<T extends SaleLike>(
  sales: T[],
  includeCostPrice: boolean
) {
  return sales.map((sale) => serializeSaleForSession(sale, includeCostPrice))
}
