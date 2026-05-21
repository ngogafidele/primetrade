type DateLike = Date | string | undefined

export type ProductSerializable = {
  _id: unknown
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice: number
  price: number
  supplierName?: string
  lastRestockAt?: DateLike
  createdAt?: DateLike
  updatedAt?: DateLike
}

export type ProductSupplySerializable = {
  _id: unknown
  productId: unknown
  sku: string
  productName: string
  supplierName: string
  quantity: number
  unitCost: number
  suppliedAt?: DateLike
  notes?: string
  createdAt?: DateLike
  updatedAt?: DateLike
}

function serializeDate(value: DateLike) {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : value
}

function serializeId(value: unknown) {
  return value?.toString() ?? ""
}

export function serializeProduct(product: ProductSerializable) {
  return {
    _id: serializeId(product._id),
    name: product.name,
    sku: product.sku,
    unit: product.unit ?? "pcs",
    quantity: product.quantity,
    lowStockThreshold: product.lowStockThreshold ?? 0,
    costPrice: product.costPrice,
    price: product.price,
    supplierName: product.supplierName ?? "",
    lastRestockAt: serializeDate(product.lastRestockAt),
    createdAt: serializeDate(product.createdAt),
    updatedAt: serializeDate(product.updatedAt),
  }
}

export function serializeProductSupply(supply: ProductSupplySerializable) {
  return {
    _id: serializeId(supply._id),
    productId: serializeId(supply.productId),
    sku: supply.sku,
    productName: supply.productName,
    supplierName: supply.supplierName,
    quantity: supply.quantity,
    unitCost: supply.unitCost,
    suppliedAt: serializeDate(supply.suppliedAt),
    notes: supply.notes ?? "",
    createdAt: serializeDate(supply.createdAt),
    updatedAt: serializeDate(supply.updatedAt),
  }
}
