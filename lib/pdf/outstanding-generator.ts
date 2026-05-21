import { createRequire } from "module"
import path from "node:path"
import type * as Fs from "node:fs"
import { formatCurrency } from "@/lib/utils/format"

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

type OutstandingPdfItem = {
  saleDate?: Date | string
  paymentDate?: Date | string
  items: string
  unitPrices: string
  recordedBy?: string
  notes?: string
  totalAmount: number
}

type OutstandingPdfData = {
  number: string
  generatedAt?: Date | string
  customerName: string
  customerPhone?: string
  notes?: string
  sales: OutstandingPdfItem[]
  totalAmount: number
}

type StoreInfo = {
  name?: string
  address?: string
  phone?: string
  email?: string
}

type OutstandingPdfDocument = {
  rect(x: number, y: number, width: number, height: number): OutstandingPdfDocument
  fillColor(color: string): OutstandingPdfDocument
  fill(): OutstandingPdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): OutstandingPdfDocument
  font(name: string): OutstandingPdfDocument
  fontSize(size: number): OutstandingPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: {
      align?: "left" | "right" | "center"
      width?: number
    }
  ): OutstandingPdfDocument
  moveTo(x: number, y: number): OutstandingPdfDocument
  lineTo(x: number, y: number): OutstandingPdfDocument
  lineWidth(width: number): OutstandingPdfDocument
  strokeColor(color: string): OutstandingPdfDocument
  stroke(): OutstandingPdfDocument
  addPage(): OutstandingPdfDocument
}

type OutstandingLogoDocument = Pick<
  OutstandingPdfDocument,
  "fillColor" | "fontSize" | "image" | "text"
>

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")

const businessFooterLines = [
  "Payment Methods:",
  "Equity: 4014201273279 (Prime Trade Company Ltd)",
  "Momo Pay: 77876 (Prime Trade Company)",
]

const thankYouMessage = "Thank You For Doing Business With Us!"
const thankYouFooterOffset = 64
const headerRightColumn = {
  x: 300,
  width: 247,
}

const printColor = {
  text: "#000000",
  muted: "#000000",
  accent: "#000000",
  headerBackground: "#1d4ed8",
  headerText: "#ffffff",
  rowBackground: "#BFDBFE",
  rule: "#000000",
}
const tableHeaderHeight = 24
const tableRowHeight = 18

function formatTableText(value: string | number | undefined, maxLength?: number) {
  const text = String(value ?? "-").replace(/\s+/g, " ").trim() || "-"

  if (!maxLength || text.length <= maxLength) return text

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`
}

function estimateTextHeight(text: string, charsPerLine = 48, lineHeight = 12) {
  const lines = text.split(/\r?\n/).reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / charsPerLine))
  }, 0)

  return lines * lineHeight
}

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
}

function formatDate(value: Date | string | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

function drawLogo(doc: OutstandingLogoDocument, storeInfo: StoreInfo) {
  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, 48, 30, { fit: [96, 96] })
  } catch {
    doc
      .fontSize(16)
      .fillColor(printColor.text)
      .text(storeInfo.name ?? "Inventory", 48, 72, { width: 150 })
  }
}

export async function generateOutstandingCustomerPDF(
  data: OutstandingPdfData,
  storeInfo: StoreInfo
) {
  if (!PDFDocument) {
    const keys =
      typeof PDFKitModule === "object" && PDFKitModule !== null
        ? Object.keys(PDFKitModule).join(", ")
        : typeof PDFKitModule
    throw new Error(`Unable to load pdfkit constructor. Exports: ${keys}`)
  }

  const doc = new PDFDocument({ margin: 48, size: "A4" })
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  doc.font("Helvetica")
  drawLogo(doc, storeInfo)

  doc
    .fillColor(printColor.text)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Loan Statement", headerRightColumn.x, 48, {
      align: "right",
      width: headerRightColumn.width,
    })
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(data.number, headerRightColumn.x, 74, {
      align: "right",
      width: headerRightColumn.width,
    })
    .text(
      `Generated: ${formatDate(data.generatedAt)}`,
      headerRightColumn.x,
      90,
      {
        align: "right",
        width: headerRightColumn.width,
      }
    )

  doc
    .moveTo(48, 136)
    .lineTo(547, 136)
    .lineWidth(1.5)
    .strokeColor(printColor.accent)
    .stroke()

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(printColor.text)
    .text(storeInfo.name ?? "Prime Trade Inventory", 48, 150)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(storeInfo.address ?? "", 48, 166)
    .text(storeInfo.phone ?? "", 48, 179)
    .text(storeInfo.email ?? "", 48, 192)

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(printColor.text)
    .text("Customer", 330, 150)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(data.customerName, 330, 166)
    .text(data.customerPhone ?? "", 330, 179)

  const tableTop = 230
  const columns = {
    no: 54,
    saleDate: 82,
    paymentDate: 148,
    items: 230,
    unitPrice: 360,
    recordedBy: 430,
    amount: 504,
  }

  doc
    .rect(48, tableTop, 499, tableHeaderHeight)
    .fillColor(printColor.headerBackground)
    .fill()
    .fillColor(printColor.headerText)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("NO", columns.no, tableTop + 8)
    .text("SALE DATE", columns.saleDate, tableTop + 8)
    .text("PAYMENT DATE", columns.paymentDate, tableTop + 8)
    .text("ITEMS", columns.items, tableTop + 8)
    .text("UNIT PRICE", columns.unitPrice, tableTop + 8)
    .text("RECORDED BY", columns.recordedBy, tableTop + 8)
    .text("AMOUNT", columns.amount, tableTop + 8)

  let rowTop = tableTop + tableHeaderHeight

  data.sales.forEach((sale, index) => {
    if (rowTop + tableRowHeight > 724) {
      doc.addPage()
      rowTop = 56
    }

    const textY = rowTop + 5

    doc
      .fillColor(index % 2 === 0 ? "#ffffff" : printColor.rowBackground)
      .rect(48, rowTop, 499, tableRowHeight)
      .fill()
      .font("Helvetica")
      .fillColor(printColor.text)
      .fontSize(8)
      .text(String(index + 1), columns.no, textY, {
        width: 20,
      })
      .text(formatDate(sale.saleDate), columns.saleDate, textY, {
        width: 60,
      })
      .text(formatDate(sale.paymentDate), columns.paymentDate, textY, {
        width: 76,
      })
      .text(formatTableText(sale.items, 28), columns.items, textY, {
        width: 124,
      })
      .text(formatTableText(sale.unitPrices, 14), columns.unitPrice, textY, {
        width: 64,
      })
      .text(formatTableText(sale.recordedBy, 14), columns.recordedBy, textY, {
        width: 68,
      })
      .text(formatCurrency(sale.totalAmount), columns.amount, textY, {
        width: 42,
      })

    rowTop += tableRowHeight
  })

  let y = rowTop

  if (y > 660) {
    doc.addPage()
    y = 56
  }

  const noteText =
    data.notes?.trim() ||
    data.sales
      .map((sale) => sale.notes?.trim())
      .filter(Boolean)
      .join("\n")

  doc
    .moveTo(48, y)
    .lineTo(547, y)
    .strokeColor(printColor.rule)
    .stroke()

  let footerY = y + 58

  if (noteText) {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(printColor.text)
      .text("Note", 48, y + 20)
      .font("Helvetica")
      .fontSize(10)
      .fillColor(printColor.muted)
      .text(noteText, 48, y + 38, { width: 260 })

    const noteHeight = estimateTextHeight(noteText)
    footerY = Math.max(footerY, y + 66 + noteHeight)
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(printColor.text)
    .text("Total Loan: ", 318, y + 20)
    .text(formatCurrency(data.totalAmount), 462, y + 20, { width: 78 })

  if (footerY > 700) {
    doc.addPage()
    footerY = 56
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(printColor.text)
    .text(businessFooterLines.join("\n"), 48, footerY, { width: 220 })

  doc
    .rect(48, footerY + thankYouFooterOffset - 6, 499, 22)
    .fillColor(printColor.headerBackground)
    .fill()
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(printColor.headerText)
    .text(thankYouMessage, 48, footerY + thankYouFooterOffset, {
      align: "center",
      width: 499,
    })

  doc.end()

  return done
}
