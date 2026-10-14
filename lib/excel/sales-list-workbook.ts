import type { SalesListSale } from "@/lib/db/sales-list"
import {
  createWorkbook,
  currencyFormat,
  dateFormat,
  dateTimeFormat,
  fillRow,
  styleHeaderRow,
  toExcelDate,
  warningFill,
  workbookToBytes,
} from "@/lib/excel/workbook"

type SalesListWorkbookData = {
  from: Date
  to: Date
  generatedAt: Date
  sales: SalesListSale[]
}

function paymentLabel(sale: SalesListSale) {
  if (sale.paymentStatus === "unpaid") return "Unpaid"
  if (sale.paymentMethod === "mobile-money") return "Mobile Money"
  if (sale.paymentMethod === "bank") return "Bank"
  return "Cash"
}

// Admin-only export: includes cost and gross profit per item.
export async function generateSalesListWorkbook(data: SalesListWorkbookData) {
  const workbook = createWorkbook()
  const sheet = workbook.addWorksheet("Sales", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Sale", key: "sale", width: 7 },
    { header: "Date", key: "date", width: 14, style: { numFmt: dateFormat } },
    { header: "Product", key: "name", width: 32 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Cost Price", key: "basePrice", width: 14, style: { numFmt: currencyFormat } },
    { header: "Selling Price", key: "sellingPrice", width: 14, style: { numFmt: currencyFormat } },
    { header: "Line Total", key: "lineTotal", width: 15, style: { numFmt: currencyFormat } },
    { header: "Gross Profit", key: "grossProfit", width: 15, style: { numFmt: currencyFormat } },
    { header: "Payment", key: "payment", width: 14 },
    { header: "Approval", key: "approval", width: 11 },
    { header: "Customer", key: "customer", width: 24 },
    { header: "Recorded By", key: "recordedBy", width: 20 },
  ]
  styleHeaderRow(sheet, 1)

  let rowNumber = 0
  let totalUnits = 0
  let totalRevenue = 0
  let totalGrossProfit = 0
  let belowCostItems = 0

  data.sales.forEach((sale, saleIndex) => {
    totalRevenue += sale.totalAmount

    sale.items.forEach((item) => {
      rowNumber += 1
      const grossProfit = item.lineTotal - item.basePrice * item.quantity
      const isBelowCost = item.sellingPrice < item.basePrice
      totalUnits += item.quantity
      totalGrossProfit += grossProfit
      if (isBelowCost) belowCostItems += 1

      const row = sheet.addRow({
        no: rowNumber,
        sale: saleIndex + 1,
        date: toExcelDate(sale.date),
        name: item.name,
        sku: item.sku,
        unit: item.unit ?? "pcs",
        quantity: item.quantity,
        basePrice: item.basePrice,
        sellingPrice: item.sellingPrice,
        lineTotal: item.lineTotal,
        grossProfit,
        payment: paymentLabel(sale),
        approval: sale.approvalStatus === "pending" ? "Pending" : "Approved",
        customer: sale.customerName ?? "",
        recordedBy: sale.createdByName ?? "",
      })

      if (isBelowCost) fillRow(row, warningFill)
    })
  })

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 15 } }

  const summary = workbook.addWorksheet("Summary")
  summary.columns = [
    { key: "label", width: 24 },
    { key: "value", width: 22 },
  ]
  const summaryRows: Array<[string, string | number | Date | null, string?]> = [
    ["From", toExcelDate(data.from), dateFormat],
    ["To", toExcelDate(data.to), dateFormat],
    ["Generated", toExcelDate(data.generatedAt), dateTimeFormat],
    ["Sales", data.sales.length],
    [
      "Pending sales",
      data.sales.filter((sale) => sale.approvalStatus === "pending").length,
    ],
    ["Units", totalUnits],
    ["Revenue", totalRevenue, currencyFormat],
    ["Gross profit", totalGrossProfit, currencyFormat],
    ["Below-cost items", belowCostItems],
  ]
  summaryRows.forEach(([label, value, numFmt]) => {
    const row = summary.addRow({ label, value })
    row.getCell(1).font = { bold: true }
    row.getCell(2).alignment = { horizontal: "left" }
    if (numFmt) row.getCell(2).numFmt = numFmt
  })

  return workbookToBytes(workbook)
}
