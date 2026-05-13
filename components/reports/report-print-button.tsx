"use client"

import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

type ReportSummary = {
  products: number
  lowStock: number
  inventoryCost: number
  inventoryRetail: number
  sales: number
  revenue: number
  grossProfit: number
  invoices: number
  unpaidInvoices: number
  outstanding: number
  adjustments: number
}

type TopMovingProduct = {
  sku: string
  name: string
  unit: string
  soldQuantity: number
  revenue: number
  grossProfit: number
}

type RecentSale = {
  _id: string
  createdAt?: string
  totalAmount: number
  items: Array<{
    name: string
    sku: string
    unit: string
    quantity: number
  }>
}

type ReportPrintButtonProps = {
  fromLabel: string
  toLabel: string
  reports: ReportSummary[]
  topMovingProducts: TopMovingProduct[]
  recentSales: RecentSale[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDateTime(date: string | undefined) {
  if (!date) return "-"

  return formatInKigali(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function sumReports(reports: ReportSummary[]) {
  return reports.reduce(
    (total, report) => ({
      products: total.products + report.products,
      lowStock: total.lowStock + report.lowStock,
      inventoryCost: total.inventoryCost + report.inventoryCost,
      inventoryRetail: total.inventoryRetail + report.inventoryRetail,
      sales: total.sales + report.sales,
      revenue: total.revenue + report.revenue,
      grossProfit: total.grossProfit + report.grossProfit,
      invoices: total.invoices + report.invoices,
      unpaidInvoices: total.unpaidInvoices + report.unpaidInvoices,
      outstanding: total.outstanding + report.outstanding,
      adjustments: total.adjustments + report.adjustments,
    }),
    {
      products: 0,
      lowStock: 0,
      inventoryCost: 0,
      inventoryRetail: 0,
      sales: 0,
      revenue: 0,
      grossProfit: 0,
      invoices: 0,
      unpaidInvoices: 0,
      outstanding: 0,
      adjustments: 0,
    }
  )
}

export function ReportPrintButton({
  fromLabel,
  toLabel,
  reports,
  topMovingProducts,
  recentSales,
}: ReportPrintButtonProps) {
  const produceReportPdf = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Allow pop-ups to produce the report PDF.")
      return
    }

    const totals = sumReports(reports)
    const generatedAt = formatInKigali(new Date(), {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    const lowStockClass = totals.lowStock > 0 ? "metric danger" : "metric"
    const outstandingClass = totals.outstanding > 0 ? "metric warning" : "metric"

    const summaryRows = reports
      .map(
        (report) => `
          <tr>
            <td>${escapeHtml(formatCurrency(report.revenue))}</td>
            <td>${escapeHtml(formatCurrency(report.grossProfit))}</td>
            <td>${escapeHtml(formatNumber(report.sales))}</td>
            <td>${escapeHtml(formatNumber(report.products))}</td>
            <td>${escapeHtml(formatNumber(report.lowStock))}</td>
            <td>${escapeHtml(formatCurrency(report.outstanding))}</td>
          </tr>
        `
      )
      .join("")

    const topMovingRows = topMovingProducts
      .map(
        (product, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${escapeHtml(product.name)}</strong>
              <span>${escapeHtml(product.sku)}</span>
            </td>
            <td>${escapeHtml(formatNumber(product.soldQuantity))} ${escapeHtml(product.unit ?? "pcs")}</td>
            <td>${escapeHtml(formatCurrency(product.revenue))}</td>
            <td>${escapeHtml(formatCurrency(product.grossProfit))}</td>
          </tr>
        `
      )
      .join("")

    const recentSaleRows = recentSales
      .map((sale) => {
        const items = sale.items
          .map((item) => item.name || item.sku)
          .filter(Boolean)
          .join(", ")

        return `
          <tr>
            <td>${escapeHtml(formatDateTime(sale.createdAt))}</td>
            <td>${escapeHtml(items || "-")}</td>
            <td>${escapeHtml(formatCurrency(sale.totalAmount))}</td>
          </tr>
        `
      })
      .join("")

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Inventory Report</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 28px;
              color: #172554;
              font-family: Arial, sans-serif;
              background: #ffffff;
            }
            header {
              display: grid;
              grid-template-columns: 1fr auto;
              gap: 24px;
              align-items: start;
              border-bottom: 3px solid #1d4ed8;
              padding-bottom: 18px;
              margin-bottom: 18px;
            }
            h1 {
              margin: 0 0 6px;
              font-size: 30px;
              line-height: 1.1;
              letter-spacing: 0;
            }
            h2 {
              margin: 0 0 10px;
              font-size: 15px;
              color: #1e3a8a;
            }
            p {
              margin: 0 0 4px;
              color: #52627a;
              font-size: 12px;
            }
            .eyebrow {
              margin-bottom: 5px;
              color: #1d4ed8;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
            }
            .summary {
              min-width: 240px;
              border: 1px solid #bfdbfe;
              padding: 12px;
              background: #f8fbff;
              text-align: right;
              white-space: nowrap;
            }
            .summary strong {
              color: #1e3a8a;
            }
            .metrics {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 18px 0 22px;
            }
            .metric {
              min-height: 70px;
              border: 1px solid #bfdbfe;
              border-left: 4px solid #1d4ed8;
              padding: 10px;
              background: #f8fbff;
            }
            .metric.warning {
              border-left-color: #f59e0b;
              background: #fffbeb;
            }
            .metric.danger {
              border-left-color: #dc2626;
              background: #fef2f2;
            }
            .metric span {
              display: block;
              color: #52627a;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .metric strong {
              display: block;
              margin-top: 7px;
              font-size: 16px;
              line-height: 1.2;
            }
            .section-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              align-items: start;
            }
            section {
              margin-top: 18px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            section.full {
              grid-column: 1 / -1;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background: #dbeafe;
              color: #1e3a8a;
              text-align: left;
              border: 1px solid #bfdbfe;
              padding: 8px 7px;
            }
            td {
              border: 1px solid #bfdbfe;
              padding: 7px;
              vertical-align: top;
            }
            td span {
              display: block;
              margin-top: 3px;
              color: #64748b;
              font-size: 11px;
            }
            tr:nth-child(even) td {
              background: #f8fbff;
            }
            thead {
              display: table-header-group;
            }
            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .footer {
              margin-top: 20px;
              border-top: 1px solid #bfdbfe;
              padding-top: 10px;
              color: #64748b;
              font-size: 10px;
            }
            @page {
              size: A4 landscape;
              margin: 12mm;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <p class="eyebrow">Inventory Report</p>
              <h1>Inventory Report</h1>
              <p>Period: ${escapeHtml(fromLabel)} to ${escapeHtml(toLabel)}</p>
            </div>
            <div class="summary">
              <p><strong>Prime Trade Inventory</strong></p>
              <p>Generated ${escapeHtml(generatedAt)}</p>
            </div>
          </header>

          <div class="metrics">
            <div class="metric"><span>Total Revenue</span><strong>${escapeHtml(formatCurrency(totals.revenue))}</strong></div>
            <div class="metric"><span>Gross Profit</span><strong>${escapeHtml(formatCurrency(totals.grossProfit))}</strong></div>
            <div class="metric"><span>Inventory Cost</span><strong>${escapeHtml(formatCurrency(totals.inventoryCost))}</strong></div>
            <div class="metric"><span>Inventory Retail</span><strong>${escapeHtml(formatCurrency(totals.inventoryRetail))}</strong></div>
            <div class="metric"><span>Sales Records</span><strong>${escapeHtml(formatNumber(totals.sales))}</strong></div>
            <div class="metric"><span>Products</span><strong>${escapeHtml(formatNumber(totals.products))}</strong></div>
            <div class="${lowStockClass}"><span>Low Stock</span><strong>${escapeHtml(formatNumber(totals.lowStock))}</strong></div>
            <div class="${outstandingClass}"><span>Outstanding</span><strong>${escapeHtml(formatCurrency(totals.outstanding))}</strong></div>
          </div>

          <div class="section-grid">
            <section class="full">
              <h2>Summary</h2>
              <table>
                <thead>
                  <tr>
                    <th>Revenue</th>
                    <th>Gross Profit</th>
                    <th>Sales</th>
                    <th>Products</th>
                    <th>Low Stock</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  ${summaryRows || '<tr><td colspan="6">No summary data found.</td></tr>'}
                </tbody>
              </table>
            </section>

            <section>
              <h2>Top Moving Products</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Sold</th>
                    <th>Revenue</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  ${topMovingRows || '<tr><td colspan="5">No sales movement yet.</td></tr>'}
                </tbody>
              </table>
            </section>

            <section>
              <h2>Recent Sales</h2>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentSaleRows || '<tr><td colspan="3">No sales recorded yet.</td></tr>'}
                </tbody>
              </table>
            </section>
          </div>

          <div class="footer">
            This report is generated from the current inventory database and reflects transactions recorded for the selected date range.
          </div>

          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <Button type="button" variant="outline" onClick={produceReportPdf}>
      <FileText className="size-4" />
      Report PDF
    </Button>
  )
}
