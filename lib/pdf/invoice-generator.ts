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

type PdfItem = {
  description: string
  sku?: string
  unit?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type PdfDocumentData = {
  number: string
  date?: Date | string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  status?: string
  processedBy?: string
  notes?: string
  totalAmount: number
  items: PdfItem[]
}

type StoreInfo = {
  name?: string
  address?: string
  phone?: string
  email?: string
}

type InvoicePdfDocument = {
  rect(x: number, y: number, width: number, height: number): InvoicePdfDocument
  fillColor(color: string): InvoicePdfDocument
  fill(): InvoicePdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): InvoicePdfDocument
  font(name: string): InvoicePdfDocument
  fontSize(size: number): InvoicePdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: {
      align?: "left" | "right" | "center"
      width?: number
    }
  ): InvoicePdfDocument
}

type InvoiceLogoDocument = Pick<
  InvoicePdfDocument,
  "fill" | "fillColor" | "fontSize" | "image" | "rect" | "text"
>

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const logoBox = {
  x: 42,
  y: 24,
  width: 136,
  height: 136,
  imageX: 48,
  imageY: 30,
  imageFit: [124, 124] as [number, number],
}

const businessFooterLines = [
  "Payment Methods:",
  "Equity: 4014201273279 (Prime Trade Company Ltd)",
  "Momo Pay: 77876 (Prime Trade Company)",
]

const thankYouMessage = "Thank you for doing business with us!"
const thankYouFooterOffset = 64

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

function drawLogo(doc: InvoiceLogoDocument, storeInfo: StoreInfo) {
  doc
    .rect(logoBox.x, logoBox.y, logoBox.width, logoBox.height)
    .fillColor("#ffffff")
    .fill()

  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, logoBox.imageX, logoBox.imageY, {
      fit: logoBox.imageFit,
    })
    return
  } catch (bufferError) {
    try {
      doc.image(logoPath, logoBox.imageX, logoBox.imageY, {
        fit: logoBox.imageFit,
      })
      return
    } catch (pathError) {
      console.error("[Invoice PDF Logo Error]", {
        buffer:
          bufferError instanceof Error
            ? bufferError.message
            : "Failed to load logo buffer",
        path:
          pathError instanceof Error
            ? pathError.message
            : "Failed to load logo path",
        logoPath,
      })
      doc
        .fontSize(16)
        .fillColor(printColor.text)
        .text(storeInfo.name ?? "Inventory", 48, 72, { width: 150 })
    }
  }
}

function formatDate(value: Date | string | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

function writeInvoicePdf(
  title: string,
  data: PdfDocumentData,
  storeInfo: StoreInfo,
  recipientLabel = "Invoice to",
  footerLines: string[] = []
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
    .text(title, 340, 50, { align: "right" })
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(data.number, 340, 76, { align: "right" })
    .text(`Date: ${formatDate(data.date)}`, 340, 92, { align: "right" })

  let metaLine = 92

  if (data.status) {
    doc.text(`Status: ${data.status}`, 340, 108, { align: "right" })
    metaLine = 108
  }

  if (data.processedBy) {
    doc.text(`Processed by: ${data.processedBy}`, 340, metaLine + 16, {
      align: "right",
    })
  }

  doc
    .moveTo(48, 166)
    .lineTo(547, 166)
    .lineWidth(1.5)
    .strokeColor(printColor.accent)
    .stroke()

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(printColor.text)
    .text(storeInfo.name ?? "Prime Trade Inventory", 48, 180)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(storeInfo.address ?? "", 48, 196)
    .text(storeInfo.phone ?? "", 48, 209)
    .text(storeInfo.email ?? "", 48, 222)

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(printColor.text)
    .text(recipientLabel, 330, 180)
    .font("Helvetica")
    .fontSize(10)
    .fillColor(printColor.muted)
    .text(data.customerName, 330, 196)
    .text(data.customerEmail ?? "", 330, 209)
    .text(data.customerPhone ?? "", 330, 222)

  const tableTop = 262
  const columns = {
    no: 54,
    item: 84,
    quantity: 292,
    price: 360,
    total: 454,
  }

  doc
    .rect(48, tableTop, 499, tableHeaderHeight)
    .fillColor(printColor.headerBackground)
    .fill()
    .fillColor(printColor.headerText)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("NO", columns.no, tableTop + 8)
    .text("ITEM", columns.item, tableTop + 8)
    .text("QTY", columns.quantity, tableTop + 8)
    .text("PRICE", columns.price, tableTop + 8)
    .text("AMOUNT", columns.total, tableTop + 8)

  let rowTop = tableTop + tableHeaderHeight
  data.items.forEach((item, index) => {
    if (rowTop + tableRowHeight > 724) {
      doc.addPage()
      rowTop = 56
    }

    const textY = rowTop + 5
    const itemLabel = item.sku
      ? `${item.description} (${item.sku})`
      : item.description

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
      .text(formatTableText(itemLabel, 42), columns.item, textY, {
        width: 195,
      })
      .text(
        formatTableText(`${item.quantity} ${item.unit ?? "pcs"}`),
        columns.quantity,
        textY,
        {
          width: 62,
        }
      )
      .text(formatCurrency(item.unitPrice), columns.price, textY, {
        width: 82,
      })
      .text(formatCurrency(item.lineTotal), columns.total, textY, {
        width: 92,
      })

    rowTop += tableRowHeight
  })

  let y = rowTop

  if (y > 660) {
    doc.addPage()
    y = 56
  }

  const noteText = data.notes?.trim()

  doc
    .moveTo(48, y)
    .lineTo(547, y)
    .strokeColor(printColor.rule)
    .stroke()

  let nextSectionY = y + 58

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
    nextSectionY = Math.max(nextSectionY, y + 66 + noteHeight)
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(printColor.text)
    .text("Total", 355, y + 20)
    .text(formatCurrency(data.totalAmount), 448, y + 20, { width: 92 })

  if (footerLines.length > 0) {
    let footerY = nextSectionY
    if (footerY > 700) {
      doc.addPage()
      footerY = 56
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(printColor.text)
      .text(footerLines.join("\n"), 48, footerY, { width: 220 })

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
  }

  doc.end()

  return done
}

export function generateSalesInvoicePDF(
  invoice: PdfDocumentData,
  storeInfo: StoreInfo
) {
  return writeInvoicePdf(
    "Sales Invoice",
    invoice,
    storeInfo,
    "Invoice to",
    businessFooterLines
  )
}

export function generateProformaPDF(
  proforma: PdfDocumentData,
  storeInfo: StoreInfo
) {
  return writeInvoicePdf(
    "Proforma Invoice",
    proforma,
    storeInfo,
    "Proforma to",
    businessFooterLines
  )
}
