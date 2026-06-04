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

type ProductCatalogItem = {
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice?: number
  price: number
  supplierName?: string
  lastRestockAt?: Date | string
  createdAt?: Date | string
}

type ProductCatalogData = {
  generatedAt?: Date | string
  products: ProductCatalogItem[]
}

type StoreInfo = {
  name?: string
  address?: string
  phone?: string
  email?: string
}

type ProductCatalogPdfDocument = {
  rect(x: number, y: number, width: number, height: number): ProductCatalogPdfDocument
  fillColor(color: string): ProductCatalogPdfDocument
  fill(): ProductCatalogPdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): ProductCatalogPdfDocument
  font(name: string): ProductCatalogPdfDocument
  fontSize(size: number): ProductCatalogPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): ProductCatalogPdfDocument
  moveTo(x: number, y: number): ProductCatalogPdfDocument
  lineTo(x: number, y: number): ProductCatalogPdfDocument
  lineWidth(width: number): ProductCatalogPdfDocument
  strokeColor(color: string): ProductCatalogPdfDocument
  stroke(): ProductCatalogPdfDocument
  addPage(): ProductCatalogPdfDocument
}

type CatalogLogoDocument = Pick<
  ProductCatalogPdfDocument,
  "fillColor" | "fontSize" | "image" | "text"
>

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")

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

const table = {
  x: 36,
  width: 770,
  headerHeight: 24,
  rowHeight: 18,
}

const columns = {
  no: 42,
  product: 64,
  quantity: 220,
  recorded: 278,
  restock: 348,
  supplier: 420,
  lowStock: 512,
  cost: 564,
  price: 642,
  status: 724,
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

function formatTableText(value: string | number | undefined, maxLength?: number) {
  const text = String(value ?? "-").replace(/\s+/g, " ").trim() || "-"

  if (!maxLength || text.length <= maxLength) return text

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`
}

function drawLogo(doc: CatalogLogoDocument, storeInfo: StoreInfo) {
  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, 40, 26, { fit: [92, 92] })
  } catch {
    doc
      .fontSize(16)
      .fillColor(printColor.text)
      .text(storeInfo.name ?? "Inventory", 40, 62, { width: 150 })
  }
}

function drawTableHeader(doc: ProductCatalogPdfDocument, y: number) {
  doc
    .rect(table.x, y, table.width, table.headerHeight)
    .fillColor(printColor.headerBackground)
    .fill()
    .fillColor(printColor.headerText)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text("NO", columns.no, y + 8)
    .text("PRODUCT", columns.product, y + 8)
    .text("QTY", columns.quantity, y + 8)
    .text("RECORDED", columns.recorded, y + 8)
    .text("RESTOCK", columns.restock, y + 8)
    .text("SUPPLIER", columns.supplier, y + 8)
    .text("LOW", columns.lowStock, y + 8)
    .text("COST", columns.cost, y + 8)
    .text("PRICE", columns.price, y + 8)
    .text("STATUS", columns.status, y + 8)
}

export async function generateProductsCatalogPDF(
  data: ProductCatalogData,
  storeInfo: StoreInfo
) {
  if (!PDFDocument) {
    const keys =
      typeof PDFKitModule === "object" && PDFKitModule !== null
        ? Object.keys(PDFKitModule).join(", ")
        : typeof PDFKitModule
    throw new Error(`Unable to load pdfkit constructor. Exports: ${keys}`)
  }

  const doc = new PDFDocument({ layout: "landscape", margin: 36, size: "A4" })
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
    .text("Products Catalog", 590, 42, {
      align: "right",
      width: 216,
    })
    .font("Helvetica")
    .fontSize(9)
    .fillColor(printColor.muted)
    .text(`${data.products.length} products`, 590, 70, {
      align: "right",
      width: 216,
    })
    .text(`Generated: ${formatDate(data.generatedAt)}`, 590, 84, {
      align: "right",
      width: 216,
    })
    .text(
      `Amber rows are below cost (${data.products.filter(
        (product) => product.price < (product.costPrice ?? 0)
      ).length} products).`,
      590,
      98,
      {
        align: "right",
        width: 216,
      }
    )

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(printColor.text)
    .text(storeInfo.name ?? "Prime Trade Inventory", 150, 46)
    .font("Helvetica")
    .fontSize(9)
    .fillColor(printColor.muted)
    .text(storeInfo.address ?? "", 150, 62)
    .text(storeInfo.phone ?? "", 150, 75)
    .text(storeInfo.email ?? "", 150, 88)

  doc
    .moveTo(36, 124)
    .lineTo(806, 124)
    .lineWidth(1.5)
    .strokeColor(printColor.accent)
    .stroke()

  let y = 148
  drawTableHeader(doc, y)
  y += table.headerHeight

  data.products.forEach((product, index) => {
    if (y + table.rowHeight > 550) {
      doc.addPage()
      y = 48
      drawTableHeader(doc, y)
      y += table.headerHeight
    }

    const isLowStock = product.quantity <= (product.lowStockThreshold ?? 0)
    const isBelowCost = product.price < (product.costPrice ?? 0)
    const status = isLowStock ? "Low" : "In stock"
    const textY = y + 5

    doc
      .fillColor(
        isBelowCost
          ? printColor.warningBackground
          : index % 2 === 0
            ? "#ffffff"
            : printColor.rowBackground
      )
      .rect(table.x, y, table.width, table.rowHeight)
      .fill()
      .font("Helvetica")
      .fillColor(printColor.text)
      .fontSize(7.5)
      .text(String(index + 1), columns.no, textY, { width: 18 })
      .text(
        formatTableText(`${product.name} (${product.sku})`, 34),
        columns.product,
        textY,
        { width: 148 }
      )
      .text(
        formatTableText(`${product.quantity} ${product.unit ?? "pcs"}`, 12),
        columns.quantity,
        textY,
        { width: 52 }
      )
      .text(formatDate(product.createdAt), columns.recorded, textY, {
        width: 66,
      })
      .text(formatDate(product.lastRestockAt), columns.restock, textY, {
        width: 66,
      })
      .text(formatTableText(product.supplierName, 18), columns.supplier, textY, {
        width: 84,
      })
      .text(String(product.lowStockThreshold ?? 0), columns.lowStock, textY, {
        width: 40,
      })
      .text(formatCurrency(product.costPrice ?? 0), columns.cost, textY, {
        width: 72,
      })
      .text(formatCurrency(product.price), columns.price, textY, {
        width: 72,
      })
      .text(status, columns.status, textY, { width: 68 })

    y += table.rowHeight
  })

  if (data.products.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(printColor.text)
      .text("No products found.", table.x, y + 8, {
        align: "center",
        width: table.width,
      })
  }

  doc.end()

  return done
}
