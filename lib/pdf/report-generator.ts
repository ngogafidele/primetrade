import { createRequire } from "module"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

const require = createRequire(import.meta.url)
const PDFKitModule = require("pdfkit") as
  | typeof import("pdfkit").default
  | {
      default?: typeof import("pdfkit").default
      PDFDocument?: typeof import("pdfkit").default
    }
const PDFDocument =
  typeof PDFKitModule === "function"
    ? PDFKitModule
    : PDFKitModule.default ?? PDFKitModule.PDFDocument

export type ReportPdfSummary = {
  products: number
  inventoryCost: number
  inventoryRetail: number
  sales: number
  revenue: number
  grossProfit: number
  costOfSales: number
  expenses: number
  returnCostImpact: number
  revenueCash: number
  revenueMobileMoney: number
  revenueBank: number
  invoices: number
  unpaidInvoices: number
  outstanding: number
  outstandingSales: number
  adjustments: number
}

export type ReportPdfTopMovingProduct = {
  sku: string
  name: string
  unit?: string
  soldQuantity: number
  revenue: number
  grossProfit: number
}

export type ReportPdfRecentSale = {
  _id: string
  createdAt?: Date | string
  totalAmount: number
  items: Array<{
    name?: string
    sku?: string
    unit?: string
    quantity?: number
  }>
}

export type ReportPdfData = {
  from: Date | string
  to: Date | string
  generatedAt?: Date | string
  reports: ReportPdfSummary[]
  topMovingProducts: ReportPdfTopMovingProduct[]
  recentSales: ReportPdfRecentSale[]
}

type StoreInfo = {
  name?: string
  address?: string
  phone?: string
  email?: string
}

type ReportPdfDocument = {
  rect(x: number, y: number, width: number, height: number): ReportPdfDocument
  fillColor(color: string): ReportPdfDocument
  fill(): ReportPdfDocument
  font(name: string): ReportPdfDocument
  fontSize(size: number): ReportPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): ReportPdfDocument
  moveTo(x: number, y: number): ReportPdfDocument
  lineTo(x: number, y: number): ReportPdfDocument
  lineWidth(width: number): ReportPdfDocument
  strokeColor(color: string): ReportPdfDocument
  stroke(): ReportPdfDocument
  addPage(): ReportPdfDocument
  on(event: "data", callback: (chunk: Buffer) => void): ReportPdfDocument
  on(event: "end", callback: () => void): ReportPdfDocument
  on(event: "error", callback: (error: Error) => void): ReportPdfDocument
  end(): void
}

const printColor = {
  text: "#000000",
  muted: "#000000",
  accent: "#000000",
  headerBackground: "#1d4ed8",
  headerText: "#ffffff",
  rowBackground: "#BFDBFE",
  warningBackground: "#FEF3C7",
  rule: "#000000",
}

const page = {
  width: 842,
  margin: 36,
  bottom: 552,
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDate(value: Date | string | undefined) {
  if (!value) return "-"
  return formatInKigali(value, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(value: Date | string | undefined) {
  if (!value) return "-"
  return formatInKigali(value, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatTableText(value: string | number | undefined, maxLength?: number) {
  const text = String(value ?? "-").replace(/\s+/g, " ").trim() || "-"
  if (!maxLength || text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`
}

function sumReports(reports: ReportPdfSummary[]) {
  return reports.reduce(
    (total, report) => ({
      products: total.products + report.products,
      inventoryCost: total.inventoryCost + report.inventoryCost,
      inventoryRetail: total.inventoryRetail + report.inventoryRetail,
      sales: total.sales + report.sales,
      revenue: total.revenue + report.revenue,
      grossProfit: total.grossProfit + report.grossProfit,
      costOfSales: total.costOfSales + report.costOfSales,
      expenses: total.expenses + report.expenses,
      returnCostImpact: total.returnCostImpact + report.returnCostImpact,
      revenueCash: total.revenueCash + report.revenueCash,
      revenueMobileMoney: total.revenueMobileMoney + report.revenueMobileMoney,
      revenueBank: total.revenueBank + report.revenueBank,
      invoices: total.invoices + report.invoices,
      unpaidInvoices: total.unpaidInvoices + report.unpaidInvoices,
      outstanding: total.outstanding + report.outstanding,
      outstandingSales: total.outstandingSales + report.outstandingSales,
      adjustments: total.adjustments + report.adjustments,
    }),
    {
      products: 0,
      inventoryCost: 0,
      inventoryRetail: 0,
      sales: 0,
      revenue: 0,
      grossProfit: 0,
      costOfSales: 0,
      expenses: 0,
      returnCostImpact: 0,
      revenueCash: 0,
      revenueMobileMoney: 0,
      revenueBank: 0,
      invoices: 0,
      unpaidInvoices: 0,
      outstanding: 0,
      outstandingSales: 0,
      adjustments: 0,
    }
  )
}

function drawPageHeader(
  doc: ReportPdfDocument,
  data: ReportPdfData,
  storeInfo: StoreInfo
) {
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(printColor.text)
    .text("Inventory Report", page.margin, 36, { width: 260 })
    .font("Helvetica")
    .fontSize(9)
    .fillColor(printColor.muted)
    .text(`${formatDate(data.from)} to ${formatDate(data.to)}`, page.margin, 60)

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(printColor.text)
    .text(storeInfo.name ?? "Prime Trade Inventory", 560, 38, {
      align: "right",
      width: 246,
    })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(printColor.muted)
    .text(`Generated: ${formatDateTime(data.generatedAt)}`, 560, 55, {
      align: "right",
      width: 246,
    })
    .text(storeInfo.phone ?? "", 560, 69, { align: "right", width: 246 })
    .text(storeInfo.email ?? "", 560, 82, { align: "right", width: 246 })

  doc
    .moveTo(page.margin, 110)
    .lineTo(page.width - page.margin, 110)
    .lineWidth(1.5)
    .strokeColor(printColor.accent)
    .stroke()
}

function drawMetric(
  doc: ReportPdfDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  warning = false
) {
  doc
    .rect(x, y, width, 44)
    .fillColor(warning ? printColor.warningBackground : printColor.rowBackground)
    .fill()
    .fillColor(printColor.text)
    .font("Helvetica-Bold")
    .fontSize(6.8)
    .text(label.toUpperCase(), x + 8, y + 8, { width: width - 16 })
    .fontSize(10)
    .text(value, x + 8, y + 23, { width: width - 16 })
}

function drawTableHeader(
  doc: ReportPdfDocument,
  y: number,
  headers: Array<{ label: string; x: number; width: number }>,
  tableWidth = 770
) {
  doc
    .rect(page.margin, y, tableWidth, 22)
    .fillColor(printColor.headerBackground)
    .fill()
    .fillColor(printColor.headerText)
    .font("Helvetica-Bold")
    .fontSize(7.5)

  headers.forEach((header) => {
    doc.text(header.label, header.x, y + 7, { width: header.width })
  })
}

function drawSectionTitle(doc: ReportPdfDocument, title: string, y: number) {
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(printColor.text)
    .text(title, page.margin, y)
}

export async function generateReportPDF(data: ReportPdfData, storeInfo: StoreInfo) {
  if (!PDFDocument) {
    const keys =
      typeof PDFKitModule === "object" && PDFKitModule !== null
        ? Object.keys(PDFKitModule).join(", ")
        : typeof PDFKitModule
    throw new Error(`Unable to load pdfkit constructor. Exports: ${keys}`)
  }

  const doc = new PDFDocument({
    layout: "landscape",
    margin: page.margin,
    size: "A4",
  }) as ReportPdfDocument
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  const totals = sumReports(data.reports)
  const profit = totals.grossProfit - totals.expenses + totals.returnCostImpact

  doc.font("Helvetica")
  drawPageHeader(doc, data, storeInfo)

  const metricWidth = 143
  const metricGap = 10
  const metricStartX = page.margin
  const metrics = [
    ["Total Revenue", formatCurrency(totals.revenue), false],
    ["Profit", formatCurrency(profit), profit < 0],
    ["Expenses", formatCurrency(totals.expenses), totals.expenses > 0],
    ["Cash", formatCurrency(totals.revenueCash), false],
    ["Mobile Money", formatCurrency(totals.revenueMobileMoney), false],
    ["Bank", formatCurrency(totals.revenueBank), false],
    ["Inventory Cost", formatCurrency(totals.inventoryCost), false],
    ["Inventory Retail", formatCurrency(totals.inventoryRetail), false],
    ["Sales Records", formatNumber(totals.sales), false],
    ["Products", formatNumber(totals.products), false],
  ] as const

  metrics.forEach(([label, value, warning], index) => {
    const row = Math.floor(index / 5)
    const col = index % 5
    drawMetric(
      doc,
      label,
      value,
      metricStartX + col * (metricWidth + metricGap),
      130 + row * 52,
      metricWidth,
      warning
    )
  })

  let y = 254
  drawSectionTitle(doc, "Summary", y)
  y += 18

  const summaryHeaders = [
    { label: "Revenue", x: 44, width: 80 },
    { label: "Profit", x: 128, width: 80 },
    { label: "Expenses", x: 212, width: 80 },
    { label: "Cash", x: 296, width: 80 },
    { label: "Mobile Money", x: 380, width: 92 },
    { label: "Bank", x: 476, width: 78 },
    { label: "Sales", x: 558, width: 50 },
    { label: "Products", x: 612, width: 58 },
    { label: "Loan Sales", x: 674, width: 90 },
  ]
  drawTableHeader(doc, y, summaryHeaders)
  y += 22

  data.reports.forEach((report, index) => {
    doc
      .rect(page.margin, y, 770, 22)
      .fillColor(index % 2 === 0 ? "#ffffff" : printColor.rowBackground)
      .fill()
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(printColor.text)
      .text(formatCurrency(report.revenue), 44, y + 7, { width: 80 })
      .text(
        formatCurrency(
          report.grossProfit - report.expenses + report.returnCostImpact
        ),
        128,
        y + 7,
        { width: 80 }
      )
      .text(formatCurrency(report.expenses), 212, y + 7, { width: 80 })
      .text(formatCurrency(report.revenueCash), 296, y + 7, { width: 80 })
      .text(formatCurrency(report.revenueMobileMoney), 380, y + 7, {
        width: 92,
      })
      .text(formatCurrency(report.revenueBank), 476, y + 7, { width: 78 })
      .text(formatNumber(report.sales), 558, y + 7, { width: 50 })
      .text(formatNumber(report.products), 612, y + 7, { width: 58 })
      .text(formatCurrency(report.outstandingSales), 674, y + 7, {
        width: 90,
      })
    y += 22
  })

  if (data.reports.length === 0) {
    doc.fontSize(9).text("No summary data found.", page.margin, y + 8, {
      align: "center",
      width: 770,
    })
    y += 24
  }

  y += 22
  drawSectionTitle(doc, "Top Moving Products", y)
  y += 18

  const productHeaders = [
    { label: "#", x: 44, width: 22 },
    { label: "Product", x: 74, width: 280 },
    { label: "Sold", x: 366, width: 90 },
    { label: "Revenue", x: 470, width: 120 },
    { label: "Profit", x: 604, width: 120 },
  ]
  drawTableHeader(doc, y, productHeaders)
  y += 22

  const productRows = data.topMovingProducts.slice(0, 8)
  productRows.forEach((product, index) => {
    if (y + 22 > page.bottom) {
      doc.addPage()
      drawPageHeader(doc, data, storeInfo)
      y = 132
      drawTableHeader(doc, y, productHeaders)
      y += 22
    }

    doc
      .rect(page.margin, y, 770, 22)
      .fillColor(index % 2 === 0 ? "#ffffff" : printColor.rowBackground)
      .fill()
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(printColor.text)
      .text(String(index + 1), 44, y + 7, { width: 22 })
      .text(formatTableText(`${product.name} (${product.sku})`, 58), 74, y + 7, {
        width: 280,
      })
      .text(
        `${formatNumber(product.soldQuantity)} ${product.unit ?? "pcs"}`,
        366,
        y + 7,
        { width: 90 }
      )
      .text(formatCurrency(product.revenue), 470, y + 7, { width: 120 })
      .text(formatCurrency(product.grossProfit), 604, y + 7, { width: 120 })
    y += 22
  })

  if (productRows.length === 0) {
    doc.fontSize(9).text("No sales movement yet.", page.margin, y + 8, {
      align: "center",
      width: 770,
    })
    y += 24
  }

  if (y + 100 > page.bottom) {
    doc.addPage()
    drawPageHeader(doc, data, storeInfo)
    y = 132
  } else {
    y += 24
  }

  drawSectionTitle(doc, "Recent Sales", y)
  y += 18

  const recentHeaders = [
    { label: "Time", x: 44, width: 130 },
    { label: "Items", x: 188, width: 420 },
    { label: "Total", x: 624, width: 120 },
  ]
  drawTableHeader(doc, y, recentHeaders)
  y += 22

  data.recentSales.slice(0, 8).forEach((sale, index) => {
    if (y + 22 > page.bottom) {
      doc.addPage()
      drawPageHeader(doc, data, storeInfo)
      y = 132
      drawTableHeader(doc, y, recentHeaders)
      y += 22
    }

    const items =
      sale.items
        .map((item) => item.name || item.sku)
        .filter(Boolean)
        .join(", ") || "-"

    doc
      .rect(page.margin, y, 770, 22)
      .fillColor(index % 2 === 0 ? "#ffffff" : printColor.rowBackground)
      .fill()
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(printColor.text)
      .text(formatDateTime(sale.createdAt), 44, y + 7, { width: 130 })
      .text(formatTableText(items, 86), 188, y + 7, { width: 420 })
      .text(formatCurrency(sale.totalAmount), 624, y + 7, { width: 120 })
    y += 22
  })

  if (data.recentSales.length === 0) {
    doc.fontSize(9).text("No sales recorded yet.", page.margin, y + 8, {
      align: "center",
      width: 770,
    })
    y += 24
  }

  doc
    .moveTo(page.margin, page.bottom)
    .lineTo(page.width - page.margin, page.bottom)
    .lineWidth(1)
    .strokeColor(printColor.rule)
    .stroke()
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(printColor.muted)
    .text(
      "This report is generated from the current inventory database and reflects transactions recorded for the selected date range.",
      page.margin,
      page.bottom + 10,
      { width: 770 }
    )

  doc.end()

  return done
}
