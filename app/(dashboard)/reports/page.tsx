import { redirect } from "next/navigation"
import { connection } from "next/server"
import { requireServerSession } from "@/lib/auth/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"
import { Invoice } from "@/lib/db/models/Invoice"
import { Product } from "@/lib/db/models/Product"
import { ReturnTransaction } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { formatCurrency } from "@/lib/utils/format"
import {
  formatInKigali,
  formatKigaliDateInput,
  getKigaliDateParts,
  parseKigaliDateInput,
} from "@/lib/utils/time"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ReportPrintButton } from "@/components/reports/report-print-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

type SaleTotals = {
  _id: null
  sales: number
  revenue: number
  grossProfit: number
  unitsSold: number
}

type PaymentMethodTotals = {
  _id: "cash" | "mobile-money" | "bank"
  total: number
}

type ProductTotals = {
  _id: null
  products: number
  inventoryCost: number
  inventoryRetail: number
}

type InvoiceTotals = {
  _id: null
  invoices: number
  unpaidInvoices: number
  outstanding: number
}

type AdjustmentTotals = {
  _id: null
  adjustments: number
}

type OutstandingSalesTotals = {
  _id: null
  outstandingSales: number
}

type ExpenseTotals = {
  _id: null
  expenses: number
}

type ReturnImpactTotals = {
  _id: null
  revenue: number
  grossProfit: number
}

type SearchParams = Promise<{
  from?: string | string[]
  to?: string | string[]
}>

type TopMovingProduct = {
  sku: string
  name: string
  unit: string
  soldQuantity: number
  revenue: number
  grossProfit: number
}

type ReturnProductImpact = TopMovingProduct

type RecentSale = {
  _id: string
  createdAt?: Date
  totalAmount: number
  items: Array<{
    name: string
    sku: string
    unit: string
    quantity: number
  }>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDateTime(date: Date | undefined) {
  if (!date) return "-"

  return formatInKigali(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDateInput(date: Date) {
  return formatKigaliDateInput(date)
}

function parseDateInput(value: string | undefined) {
  return parseKigaliDateInput(value)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getReportRange(params: Awaited<SearchParams>) {
  const now = new Date()
  const nowParts = getKigaliDateParts(now)
  const todayInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-${String(
    nowParts.day
  ).padStart(2, "0")}`
  const monthStartInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-01`
  const today = parseKigaliDateInput(todayInput) ?? now
  const monthStart = parseKigaliDateInput(monthStartInput) ?? today

  const rawFrom = getSingleParam(params.from)
  const rawTo = getSingleParam(params.to)
  const parsedFrom = parseDateInput(rawFrom)
  const parsedTo = parseDateInput(rawTo)

  let from = parsedFrom ?? monthStart
  let to = parsedTo ?? today

  if (from > to) {
    const earlierDate = to
    to = from
    from = earlierDate
  }

  return {
    from,
    to,
    endExclusive: addDays(to, 1),
    fromInput: formatDateInput(from),
    toInput: formatDateInput(to),
  }
}

function formatDateOnly(date: Date) {
  return formatInKigali(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await connection()
  const session = await requireServerSession()
  if (!session.isAdmin) {
    redirect("/sales")
  }
  const range = getReportRange(await searchParams)
  const periodFilter = {
    $gte: range.from,
    $lt: range.endExclusive,
  }

  await connectToDatabase()

  const [
    productTotals,
    saleTotals,
    invoiceTotals,
    adjustmentTotals,
    expenseTotals,
    outstandingSalesTotals,
    returnImpactTotals,
    paymentTotals,
    topMovingProducts,
    returnedProductImpacts,
    recentSales,
  ] = await Promise.all([
    Product.aggregate<ProductTotals>([
      { $match: {} },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          inventoryCost: {
            $sum: { $multiply: ["$quantity", "$costPrice"] },
          },
          inventoryRetail: {
            $sum: { $multiply: ["$quantity", "$price"] },
          },
        },
      },
    ]),
    Sale.aggregate<SaleTotals>([
      { $match: { createdAt: periodFilter } },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          saleIds: { $addToSet: "$_id" },
          revenue: { $sum: "$items.lineTotal" },
          unitsSold: { $sum: "$items.quantity" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$items.lineTotal",
                { $multiply: ["$items.basePrice", "$items.quantity"] },
              ],
            },
          },
        },
      },
      {
        $project: {
          sales: { $size: "$saleIds" },
          revenue: 1,
          grossProfit: 1,
          unitsSold: 1,
        },
      },
    ]),
    Invoice.aggregate<InvoiceTotals>([
      { $match: { issuedAt: periodFilter } },
      {
        $group: {
          _id: null,
          invoices: { $sum: 1 },
          unpaidInvoices: {
            $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] },
          },
          outstanding: {
            $sum: {
              $cond: [{ $eq: ["$status", "unpaid"] }, "$totalAmount", 0],
            },
          },
        },
      },
    ]),
    StockAdjustment.aggregate<AdjustmentTotals>([
      { $match: { createdAt: periodFilter } },
      {
        $group: {
          _id: null,
          adjustments: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate<ExpenseTotals>([
      {
        $match: {
          $or: [
            { incurredAt: periodFilter },
            { incurredAt: { $exists: false }, createdAt: periodFilter },
            { incurredAt: null, createdAt: periodFilter },
          ],
        },
      },
      {
        $group: {
          _id: null,
          expenses: { $sum: "$amount" },
        },
      },
    ]),
    ReturnTransaction.aggregate<ReturnImpactTotals>([
      { $match: { createdAt: periodFilter } },
      { $unwind: "$returnItems" },
      {
        $lookup: {
          from: "products",
          localField: "returnItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$returnItems.lineTotal" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$returnItems.lineTotal",
                {
                  $multiply: [
                    {
                      $ifNull: [
                        "$returnItems.basePrice",
                        { $ifNull: ["$product.costPrice", "$returnItems.unitPrice"] },
                      ],
                    },
                    "$returnItems.quantity",
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: null,
          revenue: 1,
          grossProfit: 1,
        },
      },
    ]),
    Sale.aggregate<OutstandingSalesTotals>([
      {
        $match: {
          createdAt: periodFilter,
          paymentStatus: "unpaid",
        },
      },
      {
        $group: {
          _id: null,
          outstandingSales: { $sum: "$totalAmount" },
        },
      },
    ]),
    Sale.aggregate<PaymentMethodTotals>([
      {
        $match: {
          createdAt: periodFilter,
          paymentStatus: "paid",
          paymentMethod: { $in: ["cash", "mobile-money", "bank"] },
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$totalAmount" },
        },
      },
    ]),
    Sale.aggregate<TopMovingProduct>([
      { $match: { createdAt: periodFilter } },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            sku: "$items.sku",
            name: "$items.name",
            unit: "$items.unit",
          },
          soldQuantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.lineTotal" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$items.lineTotal",
                { $multiply: ["$items.basePrice", "$items.quantity"] },
              ],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          _id: 0,
          sku: "$_id.sku",
          name: "$_id.name",
          unit: "$_id.unit",
          soldQuantity: 1,
          revenue: 1,
          grossProfit: 1,
        },
      },
    ]),
    ReturnTransaction.aggregate<ReturnProductImpact>([
      { $match: { createdAt: periodFilter } },
      { $unwind: "$returnItems" },
      {
        $lookup: {
          from: "products",
          localField: "returnItems.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            sku: "$returnItems.sku",
            name: "$returnItems.name",
            unit: "$returnItems.unit",
          },
          soldQuantity: { $sum: "$returnItems.quantity" },
          revenue: { $sum: "$returnItems.lineTotal" },
          grossProfit: {
            $sum: {
              $subtract: [
                "$returnItems.lineTotal",
                {
                  $multiply: [
                    {
                      $ifNull: [
                        "$returnItems.basePrice",
                        { $ifNull: ["$product.costPrice", "$returnItems.unitPrice"] },
                      ],
                    },
                    "$returnItems.quantity",
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          sku: "$_id.sku",
          name: "$_id.name",
          unit: "$_id.unit",
          soldQuantity: 1,
          revenue: 1,
          grossProfit: 1,
        },
      },
    ]),
    Sale.find({ createdAt: periodFilter })
      .select("items totalAmount createdAt")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean<RecentSale[]>(),
  ])

  const revenue =
    (saleTotals[0]?.revenue ?? 0) - (returnImpactTotals[0]?.revenue ?? 0)
  const grossProfit =
    (saleTotals[0]?.grossProfit ?? 0) -
    (returnImpactTotals[0]?.grossProfit ?? 0)

  const report: ReportSummary = {
    products: productTotals[0]?.products ?? 0,
    inventoryCost: productTotals[0]?.inventoryCost ?? 0,
    inventoryRetail: productTotals[0]?.inventoryRetail ?? 0,
    sales: saleTotals[0]?.sales ?? 0,
    revenue,
    grossProfit,
    costOfSales: revenue - grossProfit,
    expenses: expenseTotals[0]?.expenses ?? 0,
    returnCostImpact: 0,
    revenueCash: paymentTotals.find((entry) => entry._id === "cash")?.total ?? 0,
    revenueMobileMoney:
      paymentTotals.find((entry) => entry._id === "mobile-money")?.total ?? 0,
    revenueBank:
      paymentTotals.find((entry) => entry._id === "bank")?.total ?? 0,
    invoices: invoiceTotals[0]?.invoices ?? 0,
    unpaidInvoices: invoiceTotals[0]?.unpaidInvoices ?? 0,
    outstanding: invoiceTotals[0]?.outstanding ?? 0,
    outstandingSales: outstandingSalesTotals[0]?.outstandingSales ?? 0,
    adjustments: adjustmentTotals[0]?.adjustments ?? 0,
  }

  const reports = [report]
  const topMovingBySku = new Map<string, TopMovingProduct>()
  topMovingProducts.forEach((product) => {
    topMovingBySku.set(product.sku, { ...product })
  })
  returnedProductImpacts.forEach((returnedProduct) => {
    const current = topMovingBySku.get(returnedProduct.sku) ?? {
      sku: returnedProduct.sku,
      name: returnedProduct.name,
      unit: returnedProduct.unit,
      soldQuantity: 0,
      revenue: 0,
      grossProfit: 0,
    }

    topMovingBySku.set(returnedProduct.sku, {
      ...current,
      soldQuantity: current.soldQuantity - returnedProduct.soldQuantity,
      revenue: current.revenue - returnedProduct.revenue,
      grossProfit: current.grossProfit - returnedProduct.grossProfit,
    })
  })
  const netTopMovingProducts = Array.from(topMovingBySku.values())
    .filter(
      (product) =>
        product.soldQuantity !== 0 ||
        product.revenue !== 0 ||
        product.grossProfit !== 0
    )
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)

  const totals = sumReports(reports)
  const fromLabel = formatDateOnly(range.from)
  const toLabel = formatDateOnly(range.to)
  const printableRecentSales = recentSales.map((sale) => ({
    _id: sale._id.toString(),
    createdAt: sale.createdAt?.toISOString(),
    totalAmount: sale.totalAmount,
    items: sale.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      quantity: item.quantity,
    })),
  }))

  const cards = [
    { label: "Total Revenue", value: formatCurrency(totals.revenue) },
    { label: "Cost of Sales", value: formatCurrency(totals.costOfSales) },
    { label: "Expenses", value: formatCurrency(totals.expenses) },
    {
      label: "Profit",
      value: formatCurrency(
        totals.grossProfit - totals.expenses + totals.returnCostImpact
      ),
    },
    { label: "Inventory Cost", value: formatCurrency(totals.inventoryCost) },
    { label: "Inventory Retail", value: formatCurrency(totals.inventoryRetail) },
    { label: "Sales Records", value: formatNumber(totals.sales) },
    { label: "Products", value: formatNumber(totals.products) },
    {
      label: "Outstanding Sales",
      value: formatCurrency(totals.outstandingSales),
    },
  ]

  const paymentCards = [
    { label: "Cash", value: formatCurrency(totals.revenueCash) },
    { label: "Mobile Money", value: formatCurrency(totals.revenueMobileMoney) },
    { label: "Bank", value: formatCurrency(totals.revenueBank) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Business Overview
        </p>
        <h2 className="text-2xl font-semibold">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Reports from {fromLabel} to {toLabel}.
        </p>
      </div>

      <form
        action="/reports"
        className="grid gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[1fr_1fr_auto_auto]"
      >
        <label className="grid gap-1 text-sm">
          From
          <Input name="from" type="date" defaultValue={range.fromInput} />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <Input name="to" type="date" defaultValue={range.toInput} />
        </label>
        <div className="flex items-end">
          <Button type="submit" className="w-full md:w-auto">
            Produce Report
          </Button>
        </div>
        <div className="flex items-end">
          <ReportPrintButton
            fromLabel={fromLabel}
            toLabel={toLabel}
            reports={reports}
            topMovingProducts={netTopMovingProducts}
            recentSales={printableRecentSales}
          />
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Payment Breakdown
          </p>
          <h3 className="text-lg font-semibold">Revenue by Method</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {paymentCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Summary
          </p>
          <h3 className="text-lg font-semibold">Performance</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Revenue</TableHead>
              <TableHead>Profit</TableHead>
              <TableHead>Expenses</TableHead>
              <TableHead>Cash</TableHead>
              <TableHead>Mobile Money</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Outstanding Sales</TableHead>
              <TableHead>Outstanding Invoices</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report, index) => (
              <TableRow key={index}>
                <TableCell>{formatCurrency(report.revenue)}</TableCell>
                <TableCell>
                  {formatCurrency(
                    report.grossProfit -
                      report.expenses +
                      report.returnCostImpact
                  )}
                </TableCell>
                <TableCell>{formatCurrency(report.expenses)}</TableCell>
                <TableCell>{formatCurrency(report.revenueCash)}</TableCell>
                <TableCell>{formatCurrency(report.revenueMobileMoney)}</TableCell>
                <TableCell>{formatCurrency(report.revenueBank)}</TableCell>
                <TableCell>{formatNumber(report.sales)}</TableCell>
                <TableCell>{formatNumber(report.products)}</TableCell>
                <TableCell>{formatCurrency(report.outstandingSales)}</TableCell>
                <TableCell>{formatCurrency(report.outstanding)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Product Performance
            </p>
            <h3 className="text-lg font-semibold">Top Moving Products</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {netTopMovingProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No sales movement yet.
                  </TableCell>
                </TableRow>
              ) : (
                netTopMovingProducts.map((product) => (
                  <TableRow key={product.sku}>
                    <TableCell>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku}
                      </p>
                    </TableCell>
                    <TableCell>
                      {formatNumber(product.soldQuantity)}{" "}
                      {product.unit ?? "pcs"}
                    </TableCell>
                    <TableCell>{formatCurrency(product.revenue)}</TableCell>
                    <TableCell>{formatCurrency(product.grossProfit)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Sales Activity
            </p>
            <h3 className="text-lg font-semibold">Recent Sales</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No sales recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentSales.map((sale) => (
                  <TableRow key={sale._id.toString()}>
                    <TableCell>{formatDateTime(sale.createdAt)}</TableCell>
                    <TableCell>
                      <span className="whitespace-normal wrap-break-word">
                        {sale.items
                          .map((item) => item.name || item.sku)
                          .join(", ")}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  )
}
