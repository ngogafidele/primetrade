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

type ReceiptItem = {
  description: string
  sku?: string
  unit?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type ReturnReceiptData = {
  receiptNumber: string
  date?: Date | string
  processedBy?: string
  notes?: string
  returnItems: ReceiptItem[]
  replacementItems: ReceiptItem[]
  totalReturnAmount: number
  totalReplacementAmount: number
}

type StoreInfo = {
  name?: string
  address?: string
  phone?: string
  email?: string
}

type ReceiptPdfDocument = {
  rect(x: number, y: number, width: number, height: number): ReceiptPdfDocument
  fillColor(color: string): ReceiptPdfDocument
  fill(): ReceiptPdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): ReceiptPdfDocument
  font(name: string): ReceiptPdfDocument
  fontSize(size: number): ReceiptPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): ReceiptPdfDocument
  moveTo(x: number, y: number): ReceiptPdfDocument
  lineTo(x: number, y: number): ReceiptPdfDocument
  lineWidth(width: number): ReceiptPdfDocument
  strokeColor(color: string): ReceiptPdfDocument
  stroke(): ReceiptPdfDocument
  addPage(): ReceiptPdfDocument
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const logoBox = {
  x: 42,
  y: 24,
  width: 174,
  height: 174,
  imageX: 48,
  imageY: 30,
  imageFit: [162, 162] as [number, number],
}

const businessFooterLines = [
  "Payements methods",
  "Equity Bank Account: 4014201273279",
  "Momo Pay: 77876",
  "Momo Pay Name: Prime Trade Company",
]

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
}

function drawLogo(doc: ReceiptPdfDocument, storeInfo: StoreInfo) {
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
      console.error("[Return Receipt Logo Error]", {
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
        .fillColor("#1d4ed8")
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

function renderItemsTable(
  doc: ReceiptPdfDocument,
  title: string,
  items: ReceiptItem[],
  startY: number
) {
  let y = startY

  doc
    .fontSize(12)
    .fillColor("#172554")
    .text(title, 48, y)

  y += 16

  doc
    .rect(48, y, 499, 22)
    .fillColor("#dbeafe")
    .fill()
    .fillColor("#1e3a8a")
    .fontSize(9)
    .text("Item", 54, y + 7)
    .text("Qty", 286, y + 7)
    .text("Price", 355, y + 7)
    .text("Total", 448, y + 7)

  y += 28

  items.forEach((item, index) => {
    if (y > 700) {
      doc.addPage()
      y = 56
    }

    doc
      .fillColor(index % 2 === 0 ? "#ffffff" : "#f8fbff")
      .rect(48, y - 6, 499, 32)
      .fill()
      .fillColor("#172554")
      .fontSize(9)
      .text(item.description, 54, y, { width: 210 })
      .fillColor("#64748b")
      .fontSize(8)
      .text(item.sku ?? "", 54, y + 12, { width: 210 })
      .fillColor("#172554")
      .fontSize(9)
      .text(`${item.quantity} ${item.unit ?? "pcs"}`, 286, y)
      .text(formatCurrency(item.unitPrice), 355, y, { width: 82 })
      .text(formatCurrency(item.lineTotal), 448, y, { width: 92 })

    y += 34
  })

  return y + 6
}

export async function generateReturnReceiptPDF(
  receipt: ReturnReceiptData,
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

  drawLogo(doc, storeInfo)

  doc
    .fillColor("#172554")
    .fontSize(22)
    .text("Return Receipt", 340, 58, { align: "right" })
    .fontSize(10)
    .fillColor("#52627a")
    .text(receipt.receiptNumber, 340, 88, { align: "right" })
    .text(`Date: ${formatDate(receipt.date)}`, 340, 104, { align: "right" })

  if (receipt.processedBy) {
    doc.text(`Processed by: ${receipt.processedBy}`, 340, 120, {
      align: "right",
    })
  }

  doc
    .moveTo(48, 210)
    .lineTo(547, 210)
    .lineWidth(1.5)
    .strokeColor("#1d4ed8")
    .stroke()

  doc
    .fontSize(11)
    .fillColor("#172554")
    .text(storeInfo.name ?? "Prime Trade Inventory", 48, 230)
    .fontSize(9)
    .fillColor("#52627a")
    .text(storeInfo.address ?? "", 48, 248)
    .text(storeInfo.phone ?? "", 48, 262)
    .text(storeInfo.email ?? "", 48, 276)

  let y = 320
  y = renderItemsTable(doc, "Returned Items", receipt.returnItems, y)
  y += 16
  y = renderItemsTable(doc, "Replacement Items", receipt.replacementItems, y)

  if (y > 660) {
    doc.addPage()
    y = 56
  }

  doc
    .moveTo(48, y)
    .lineTo(547, y)
    .strokeColor("#bfdbfe")
    .stroke()

  doc
    .fontSize(11)
    .fillColor("#172554")
    .text("Return Total", 355, y + 16)
    .text(formatCurrency(receipt.totalReturnAmount), 448, y + 16, {
      width: 92,
    })
    .text("Replacement Total", 355, y + 34)
    .text(formatCurrency(receipt.totalReplacementAmount), 448, y + 34, {
      width: 92,
    })

  let footerY = y + 70

  if (receipt.notes) {
    doc
      .fontSize(10)
      .fillColor("#172554")
      .text("Notes", 48, footerY)
      .fontSize(9)
      .fillColor("#52627a")
      .text(receipt.notes, 48, footerY + 12, { width: 300 })
    footerY += 46
  }

  if (footerY > 700) {
    doc.addPage()
    footerY = 56
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#172554")
    .text(businessFooterLines.join("\n"), 48, footerY, { width: 220 })

  doc.end()

  return done
}
