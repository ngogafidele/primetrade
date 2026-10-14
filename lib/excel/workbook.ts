import ExcelJS from "exceljs"
import { getKigaliDateParts } from "@/lib/utils/time"

export const xlsxContentType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export const currencyFormat = '#,##0 "Rwf"'
export const dateFormat = "dd mmm yyyy"
export const dateTimeFormat = "dd mmm yyyy hh:mm"

// Spreadsheet print colors, matching the PDF table palette.
const headerFill = "FF1D4ED8"
const headerText = "FFFFFFFF"
export const warningFill = "FFFEF3C7"

export function createWorkbook() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Prime Trade Company Ltd"
  workbook.created = new Date()
  return workbook
}

// Excel dates have no timezone, so shift to Kigali wall-clock time before
// writing; otherwise late-evening records show on the next/previous day.
export function toExcelDate(value: Date | string | undefined) {
  if (!value) return null
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return null

  const parts = getKigaliDateParts(date)
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
  )
}

export function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber)
  row.font = { bold: true, color: { argb: headerText } }
  row.alignment = { vertical: "middle" }
  row.height = 20
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: headerFill },
    }
  })
}

export function fillRow(row: ExcelJS.Row, argb: string) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }
  })
}

export async function workbookToBytes(workbook: ExcelJS.Workbook) {
  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}
