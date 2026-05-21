"use client"

import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

type ReportSummary = {
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
    const outstandingSalesClass =
      totals.outstandingSales > 0 ? "metric warning" : "metric"
    const expenseClass = totals.expenses > 0 ? "metric warning" : "metric"

    const summaryRows = reports
      .map(
        (report) => `
          <tr>
            <td>${escapeHtml(formatCurrency(report.revenue))}</td>
            <td>${escapeHtml(formatCurrency(report.grossProfit - report.expenses + report.returnCostImpact))}</td>
            <td>${escapeHtml(formatCurrency(report.expenses))}</td>
            <td>${escapeHtml(formatCurrency(report.revenueCash))}</td>
            <td>${escapeHtml(formatCurrency(report.revenueMobileMoney))}</td>
            <td>${escapeHtml(formatCurrency(report.revenueBank))}</td>
            <td>${escapeHtml(formatNumber(report.sales))}</td>
            <td>${escapeHtml(formatNumber(report.products))}</td>
            <td>${escapeHtml(formatCurrency(report.outstandingSales))}</td>
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
            html {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body {
              margin: 0;
              padding: 28px;
              color: #000000;
              font-family: Arial, sans-serif;
              background: #ffffff;
            }
            header {
              display: grid;
              grid-template-columns: 1fr auto;
              gap: 24px;
              align-items: start;
              border-bottom: 3px solid #000000;
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
              color: #000000;
            }
            p {
              margin: 0 0 4px;
              color: #000000;
              font-size: 12px;
            }
            .eyebrow {
              margin-bottom: 5px;
              color: #000000;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
            }
            .summary {
              min-width: 240px;
              border: 1.5px solid #000000;
              padding: 12px;
              background: #eeeeee;
              text-align: right;
              white-space: nowrap;
            }
            .summary strong {
              color: #000000;
            }
            .metrics {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 18px 0 22px;
            }
            .metric {
              min-height: 70px;
              border: 1.5px solid #000000;
              border-left: 4px solid #000000;
              padding: 10px;
              background: #eeeeee;
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
              color: #000000;
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
              background: #d1d5db;
              color: #000000;
              text-align: left;
              border: 1.5px solid #000000;
              padding: 8px 7px;
            }
            td {
              border: 1.5px solid #000000;
              padding: 7px;
              vertical-align: top;
            }
            td span {
              display: block;
              margin-top: 3px;
              color: #000000;
              font-size: 11px;
            }
            tr:nth-child(even) td {
              background: #eeeeee;
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
              border-top: 1.5px solid #000000;
              padding-top: 10px;
              color: #000000;
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
            <div class="metric"><span>Profit</span><strong>${escapeHtml(formatCurrency(totals.grossProfit - totals.expenses + totals.returnCostImpact))}</strong></div>
            <div class="${expenseClass}"><span>Expenses</span><strong>${escapeHtml(formatCurrency(totals.expenses))}</strong></div>
            <div class="metric"><span>Cash</span><strong>${escapeHtml(formatCurrency(totals.revenueCash))}</strong></div>
            <div class="metric"><span>Mobile Money</span><strong>${escapeHtml(formatCurrency(totals.revenueMobileMoney))}</strong></div>
            <div class="metric"><span>Bank</span><strong>${escapeHtml(formatCurrency(totals.revenueBank))}</strong></div>
            <div class="metric"><span>Inventory Cost</span><strong>${escapeHtml(formatCurrency(totals.inventoryCost))}</strong></div>
            <div class="metric"><span>Inventory Retail</span><strong>${escapeHtml(formatCurrency(totals.inventoryRetail))}</strong></div>
            <div class="metric"><span>Sales Records</span><strong>${escapeHtml(formatNumber(totals.sales))}</strong></div>
            <div class="metric"><span>Products</span><strong>${escapeHtml(formatNumber(totals.products))}</strong></div>
            <div class="${outstandingSalesClass}"><span>Loan Sales</span><strong>${escapeHtml(formatCurrency(totals.outstandingSales))}</strong></div>
          </div>

          <div class="section-grid">
            <section class="full">
              <h2>Summary</h2>
              <table>
                <thead>
                  <tr>
                    <th>Revenue</th>
                    <th>Profit</th>
                    <th>Expenses</th>
                    <th>Cash</th>
                    <th>Mobile Money</th>
                    <th>Bank</th>
                    <th>Sales</th>
                    <th>Products</th>
                    <th>Loan Sales</th>
                  </tr>
                </thead>
                <tbody>
                  ${summaryRows || '<tr><td colspan="9">No summary data found.</td></tr>'}
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
