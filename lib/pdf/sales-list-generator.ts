import { createRequire } from "module"
import path from "node:path"
import type * as Fs from "node:fs"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

const require = createRequire(import.meta.url)
const {
  existsSync,
  readFileSync,
}: {
  existsSync: typeof Fs.existsSync
  readFileSync: typeof Fs.readFileSync
} = require("node:fs")
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

export type SalesListPdfSale = {
  date?: Date | string
  totalAmount: number
  paymentStatus: "paid" | "unpaid"
  paymentMethod?: "cash" | "mobile-money" | "bank"
  approvalStatus: "pending" | "approved"
  customerName?: string
  createdByName?: string
  items: Array<{
    name: string
    sku: string
    unit?: string
    quantity: number
    basePrice: number
    sellingPrice: number
    lineTotal: number
  }>
}

type SalesListPdfData = {
  from: Date | string
  to: Date | string
  generatedAt?: Date | string
  sales: SalesListPdfSale[]
}

type StoreInfo = {
  name?: string
  phone?: string
  email?: string
}

type SalesListPdfDocument = {
  rect(x: number, y: number, width: number, height: number): SalesListPdfDocument
  fillColor(color: string): SalesListPdfDocument
  fill(): SalesListPdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): SalesListPdfDocument
  font(name: string): SalesListPdfDocument
  fontSize(size: number): SalesListPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): SalesListPdfDocument
  moveTo(x: number, y: number): SalesListPdfDocument
  lineTo(x: number, y: number): SalesListPdfDocument
  lineWidth(width: number): SalesListPdfDocument
  strokeColor(color: string): SalesListPdfDocument
  stroke(): SalesListPdfDocument
  addPage(): SalesListPdfDocument
  on(event: "data", callback: (chunk: Buffer) => void): SalesListPdfDocument
  on(event: "end", callback: () => void): SalesListPdfDocument
  on(event: "error", callback: (error: Error) => void): SalesListPdfDocument
  end(): void
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const colors = {
  text: "#000000",
  muted: "#000000",
  header: "#1d4ed8",
  headerText: "#ffffff",
  alternateRow: "#BFDBFE",
  warningRow: "#FEF3C7",
  rule: "#000000",
}
const table = { x: 36, width: 770, headerHeight: 24, rowHeight: 18 }
const columns = {
  no: 42,
  date: 64,
  item: 126,
  quantity: 278,
  cost: 330,
  sold: 400,
  lineTotal: 470,
  payment: 548,
  approval: 604,
  customer: 660,
  loggedBy: 744,
}

function formatDate(value: Date | string | undefined) {
  if (!value) return "-"
  return formatInKigali(value, { year: "numeric", month: "short", day: "2-digit" })
}

function formatDateTime(value: Date | string | undefined) {
  if (!value) return "-"
  return formatInKigali(value, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function shorten(value: string | undefined, maxLength: number) {
  const text = value?.replace(/\s+/g, " ").trim() || "-"
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`
}

function paymentLabel(sale: SalesListPdfSale) {
  if (sale.paymentStatus === "unpaid") return "Unpaid"
  if (sale.paymentMethod === "mobile-money") return "Mobile"
  if (sale.paymentMethod === "bank") return "Bank"
  return "Cash"
}

function drawTableHeader(doc: SalesListPdfDocument, y: number) {
  doc
    .rect(table.x, y, table.width, table.headerHeight)
    .fillColor(colors.header)
    .fill()
    .fillColor(colors.headerText)
    .font("Helvetica-Bold")
    .fontSize(7.2)
    .text("NO", columns.no, y + 8)
    .text("DATE", columns.date, y + 8)
    .text("ITEM", columns.item, y + 8)
    .text("QTY", columns.quantity, y + 8)
    .text("COST", columns.cost, y + 8)
    .text("SOLD", columns.sold, y + 8)
    .text("LINE TOTAL", columns.lineTotal, y + 8)
    .text("PAYMENT", columns.payment, y + 8)
    .text("APPROVAL", columns.approval, y + 8)
    .text("CUSTOMER", columns.customer, y + 8)
    .text("BY", columns.loggedBy, y + 8)
}

export async function generateSalesListPDF(
  data: SalesListPdfData,
  storeInfo: StoreInfo
) {
  if (!PDFDocument) {
    throw new Error("Unable to load pdfkit constructor")
  }

  const doc = new PDFDocument({ layout: "landscape", margin: 36, size: "A4" })
  const chunks: Buffer[] = []
  doc.on("data", (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  const totalRevenue = data.sales.reduce((sum, sale) => sum + sale.totalAmount, 0)
  const totalUnits = data.sales.reduce(
    (sum, sale) =>
      sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  )
  const totalGrossProfit = data.sales.reduce(
    (sum, sale) =>
      sum +
      sale.items.reduce(
        (itemSum, item) =>
          itemSum + item.lineTotal - item.basePrice * item.quantity,
        0
      ),
    0
  )
  const belowCostItems = data.sales.reduce(
    (sum, sale) =>
      sum +
      sale.items.filter((item) => item.sellingPrice < item.basePrice).length,
    0
  )

  try {
    if (existsSync(logoPath)) {
      doc.image(readFileSync(logoPath), 40, 26, { fit: [78, 78] })
    }
  } catch {
    // The document remains usable without a logo.
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(colors.text)
    .text("Sales List", 560, 36, { align: "right", width: 246 })
    .font("Helvetica")
    .fontSize(9)
    .text(`${formatDate(data.from)} to ${formatDate(data.to)}`, 560, 60, {
      align: "right",
      width: 246,
    })
    .text(`Generated: ${formatDateTime(data.generatedAt)}`, 560, 74, {
      align: "right",
      width: 246,
    })
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(storeInfo.name ?? "Prime Trade Inventory", 140, 40)
    .font("Helvetica")
    .fontSize(9)
    .text(storeInfo.phone ?? "", 140, 57)
    .text(storeInfo.email ?? "", 140, 71)
    .moveTo(36, 112)
    .lineTo(806, 112)
    .lineWidth(1.5)
    .strokeColor(colors.rule)
    .stroke()

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(colors.text)
    .text(`Sales: ${data.sales.length}`, 42, 126)
    .text(`Units: ${totalUnits}`, 160, 126)
    .text(`Revenue: ${formatCurrency(totalRevenue)}`, 270, 126)
    .text(`Gross profit: ${formatCurrency(totalGrossProfit)}`, 500, 126)
    .font("Helvetica")
    .fontSize(7.5)
    .text(`Amber rows are below cost (${belowCostItems} items).`, 620, 140, {
      align: "right",
      width: 186,
    })

  let y = 150
  let rowNumber = 0
  drawTableHeader(doc, y)
  y += table.headerHeight

  for (const sale of data.sales) {
    const items = sale.items.length
      ? sale.items
      : [
          {
            name: "No item",
            sku: "",
            unit: "pcs",
            quantity: 0,
            basePrice: 0,
            sellingPrice: 0,
            lineTotal: 0,
          },
        ]

    for (const item of items) {
      if (y + table.rowHeight > 550) {
        doc.addPage()
        y = 48
        drawTableHeader(doc, y)
        y += table.headerHeight
      }

      rowNumber += 1
      const belowCost = item.sellingPrice < item.basePrice
      const rowColor = belowCost
        ? colors.warningRow
        : rowNumber % 2 === 0
          ? colors.alternateRow
          : "#ffffff"
      const textY = y + 5

      doc
        .rect(table.x, y, table.width, table.rowHeight)
        .fillColor(rowColor)
        .fill()
        .font("Helvetica")
        .fontSize(7.2)
        .fillColor(colors.text)
        .text(String(rowNumber), columns.no, textY, { width: 18 })
        .text(formatDate(sale.date), columns.date, textY, { width: 58 })
        .text(shorten(`${item.name} (${item.sku})`, 28), columns.item, textY, {
          width: 146,
        })
        .text(`${item.quantity} ${item.unit ?? "pcs"}`, columns.quantity, textY, {
          width: 48,
        })
        .text(formatCurrency(item.basePrice), columns.cost, textY, { width: 66 })
        .text(formatCurrency(item.sellingPrice), columns.sold, textY, {
          width: 66,
        })
        .text(formatCurrency(item.lineTotal), columns.lineTotal, textY, {
          width: 74,
        })
        .text(paymentLabel(sale), columns.payment, textY, { width: 52 })
        .text(sale.approvalStatus, columns.approval, textY, { width: 52 })
        .text(shorten(sale.customerName, 14), columns.customer, textY, {
          width: 80,
        })
        .text(shorten(sale.createdByName, 10), columns.loggedBy, textY, {
          width: 58,
        })

      y += table.rowHeight
    }
  }

  if (data.sales.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(colors.text)
      .text("No sales found in this date range.", table.x, y + 8, {
        align: "center",
        width: table.width,
      })
  }

  doc.end()
  return done
}
