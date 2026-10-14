import type { CatalogProduct } from "@/lib/products/catalog"
import {
  createWorkbook,
  currencyFormat,
  dateFormat,
  fillRow,
  styleHeaderRow,
  toExcelDate,
  warningFill,
  workbookToBytes,
} from "@/lib/excel/workbook"

// Admin-only export: includes cost price and stock value.
export async function generateProductsCatalogWorkbook(
  products: CatalogProduct[]
) {
  const workbook = createWorkbook()
  const sheet = workbook.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Product", key: "name", width: 34 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "Quantity", key: "quantity", width: 11 },
    { header: "Low Stock Threshold", key: "lowStockThreshold", width: 12 },
    { header: "Cost Price", key: "costPrice", width: 15, style: { numFmt: currencyFormat } },
    { header: "Selling Price", key: "price", width: 15, style: { numFmt: currencyFormat } },
    { header: "Stock Value (Cost)", key: "stockValue", width: 18, style: { numFmt: currencyFormat } },
    { header: "Last Supplier", key: "supplierName", width: 24 },
    { header: "Last Restock", key: "lastRestockAt", width: 14, style: { numFmt: dateFormat } },
    { header: "Added On", key: "createdAt", width: 14, style: { numFmt: dateFormat } },
    { header: "Status", key: "status", width: 14 },
  ]
  styleHeaderRow(sheet, 1)

  products.forEach((product, index) => {
    const costPrice = product.costPrice ?? 0
    // Same rule as syncLowStockAlert.
    const isLowStock = product.quantity <= (product.lowStockThreshold ?? 0)
    const isBelowCost = product.price < costPrice

    const row = sheet.addRow({
      no: index + 1,
      name: product.name,
      sku: product.sku,
      unit: product.unit ?? "pcs",
      quantity: product.quantity,
      lowStockThreshold: product.lowStockThreshold ?? 0,
      costPrice,
      price: product.price,
      stockValue: costPrice * product.quantity,
      supplierName: product.supplierName ?? "",
      lastRestockAt: toExcelDate(product.lastRestockAt),
      createdAt: toExcelDate(product.createdAt),
      status: isBelowCost ? "Below cost" : isLowStock ? "Low stock" : "",
    })

    if (isBelowCost || isLowStock) fillRow(row, warningFill)
  })

  const totalRow = sheet.addRow({
    name: "Total",
    quantity: products.reduce((sum, product) => sum + product.quantity, 0),
    stockValue: products.reduce(
      (sum, product) => sum + (product.costPrice ?? 0) * product.quantity,
      0
    ),
  })
  totalRow.font = { bold: true }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } }

  return workbookToBytes(workbook)
}
