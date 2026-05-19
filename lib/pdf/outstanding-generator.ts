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
  totalAmount: number
}

type OutstandingPdfData = {
  number: string
  generatedAt?: Date | string
  customerName: string
  customerPhone?: string
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
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): OutstandingPdfDocument
  moveTo(x: number, y: number): OutstandingPdfDocument
  lineTo(x: number, y: number): OutstandingPdfDocument
  lineWidth(width: number): OutstandingPdfDocument
  strokeColor(color: string): OutstandingPdfDocument
  stroke(): OutstandingPdfDocument
  addPage(): OutstandingPdfDocument
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")

const businessFooterLines = [
  "Payements methods",
  "Equity Bank Account: 4014201273279",
  "Momo Pay: 77876",
  "Momo Pay Name: Prime Trade Company",
]

const printColor = {
  text: "#000000",
  muted: "#000000",
  accent: "#000000",
  headerBackground: "#d1d5db",
  rowBackground: "#eeeeee",
  rule: "#000000",
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

function drawLogo(doc: OutstandingPdfDocument, storeInfo: StoreInfo) {
  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, 48, 30, { fit: [124, 124] })
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
    .fontSize(22)
    .text("Outstanding Statement", 310, 58, { align: "right" })
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(data.number, 310, 88, { align: "right" })
    .text(`Generated: ${formatDate(data.generatedAt)}`, 310, 104, {
      align: "right",
    })

  doc
    .moveTo(48, 178)
    .lineTo(547, 178)
    .lineWidth(1.5)
    .strokeColor(printColor.accent)
    .stroke()

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(printColor.text)
    .text(storeInfo.name ?? "Prime Trade Inventory", 48, 204)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(storeInfo.address ?? "", 48, 222)
    .text(storeInfo.phone ?? "", 48, 236)
    .text(storeInfo.email ?? "", 48, 250)

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(printColor.text)
    .text("Customer", 330, 204)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(data.customerName, 330, 222)
    .text(data.customerPhone ?? "", 330, 236)

  const tableTop = 300
  doc
    .rect(48, tableTop, 499, 24)
    .fillColor(printColor.headerBackground)
    .fill()
    .fillColor(printColor.text)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("Sale Date", 54, tableTop + 8)
    .text("Payment Date", 122, tableTop + 8)
    .text("Items", 206, tableTop + 8)
    .text("Unit Price", 346, tableTop + 8)
    .text("Recorded By", 430, tableTop + 8)
    .text("Amount", 504, tableTop + 8)

  let y = tableTop + 32

  data.sales.forEach((sale, index) => {
    if (y > 700) {
      doc.addPage()
      y = 56
    }

    doc
      .fillColor(index % 2 === 0 ? "#ffffff" : printColor.rowBackground)
      .rect(48, y - 7, 499, 42)
      .fill()
      .font("Helvetica")
      .fillColor(printColor.text)
      .fontSize(10)
      .text(formatDate(sale.saleDate), 54, y, { width: 62 })
      .text(formatDate(sale.paymentDate), 122, y, { width: 78 })
      .text(sale.items, 206, y, { width: 130 })
      .text(sale.unitPrices, 346, y, { width: 78 })
      .text(sale.recordedBy ?? "-", 430, y, { width: 68 })
      .text(formatCurrency(sale.totalAmount), 504, y, { width: 42 })

    y += 44
  })

  if (y > 660) {
    doc.addPage()
    y = 56
  }

  doc
    .moveTo(48, y)
    .lineTo(547, y)
    .strokeColor(printColor.rule)
    .stroke()
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(printColor.text)
    .text("Total Outstanding", 330, y + 20)
    .text(formatCurrency(data.totalAmount), 448, y + 20, { width: 92 })

  let footerY = y + 58
  if (footerY > 700) {
    doc.addPage()
    footerY = 56
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(printColor.text)
    .text(businessFooterLines.join("\n"), 48, footerY, { width: 220 })

  doc.end()

  return done
}
