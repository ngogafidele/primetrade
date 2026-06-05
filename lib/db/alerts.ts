import { Alert } from "@/lib/db/models/Alert"

export const LOW_STOCK_THRESHOLD = 0

export async function syncLowStockAlert(params: {
  productId: string
  name: string
  sku: string
  quantity: number
  threshold: number
}) {
  const { productId, name, sku, quantity, threshold } = params

  if (quantity <= threshold) {
    const severity = quantity <= Math.max(1, Math.floor(threshold * 0.3)) ? "high" : "medium"
    const message = `Low stock: ${name} (${sku}) has ${quantity} left (threshold: ${threshold})`

    await Alert.findOneAndUpdate(
      { productId, type: "low-stock", isResolved: false },
      { message, severity, isResolved: false },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    )
    return
  }

  await Alert.updateMany(
    { productId, type: "low-stock", isResolved: false },
    { isResolved: true, resolvedAt: new Date() }
  )
}

export async function resolveLowStockAlerts(productId: string) {
  await Alert.updateMany(
    { productId, type: "low-stock", isResolved: false },
    { isResolved: true, resolvedAt: new Date() }
  )
}
