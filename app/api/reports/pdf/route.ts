import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"
import { approvedExpenseDateFilter } from "@/lib/db/expense-approval"
import { Invoice } from "@/lib/db/models/Invoice"
import { Product } from "@/lib/db/models/Product"
import { ReturnTransaction } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { StockAdjustment } from "@/lib/db/models/StockAdjustment"
import { approvedSaleDateFilter } from "@/lib/db/sales-approval"
import {
  generateReportPDF,
  type ReportPdfSummary,
  type ReportPdfTopMovingProduct,
} from "@/lib/pdf/report-generator"
import {
  formatKigaliDateInput,
  getKigaliDateParts,
  parseKigaliDateInput,
} from "@/lib/utils/time"

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

type ReturnProductImpact = ReportPdfTopMovingProduct

type RecentSale = {
  _id: { toString(): string }
  createdAt?: Date
  approvedAt?: Date
  totalAmount: number
  items: Array<{
    name: string
    sku: string
    unit: string
    quantity: number
  }>
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getReportRange(request: NextRequest) {
  const now = new Date()
  const nowParts = getKigaliDateParts(now)
  const todayInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-${String(
    nowParts.day
  ).padStart(2, "0")}`
  const monthStartInput = `${nowParts.year}-${String(nowParts.month).padStart(2, "0")}-01`
  const today = parseKigaliDateInput(todayInput) ?? now
  const monthStart = parseKigaliDateInput(monthStartInput) ?? today
  const parsedFrom =
    parseKigaliDateInput(request.nextUrl.searchParams.get("from") ?? undefined) ??
    monthStart
  const parsedTo =
    parseKigaliDateInput(request.nextUrl.searchParams.get("to") ?? undefined) ??
    today

  let from = parsedFrom
  let to = parsedTo

  if (from > to) {
    const earlierDate = to
    to = from
    from = earlierDate
  }

  return {
    from,
    to,
    endExclusive: addDays(to, 1),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const range = getReportRange(request)
    const periodFilter = {
      $gte: range.from,
      $lt: range.endExclusive,
    }
    const approvedPeriodFilter = approvedSaleDateFilter(periodFilter)

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
        { $match: approvedPeriodFilter },
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
          $match: approvedExpenseDateFilter(periodFilter),
        },
        {
          $group: {
            _id: null,
            expenses: { $sum: "$amount" },
          },
        },
      ]),
      Sale.aggregate<OutstandingSalesTotals>([
        {
          $match: {
            ...approvedPeriodFilter,
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
                          {
                            $ifNull: [
                              "$product.costPrice",
                              "$returnItems.unitPrice",
                            ],
                          },
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
      Sale.aggregate<PaymentMethodTotals>([
        {
          $match: {
            ...approvedPeriodFilter,
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
      Sale.aggregate<ReportPdfTopMovingProduct>([
        { $match: approvedPeriodFilter },
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
                          {
                            $ifNull: [
                              "$product.costPrice",
                              "$returnItems.unitPrice",
                            ],
                          },
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
      Sale.find(approvedPeriodFilter)
        .select("items totalAmount createdAt approvedAt")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean<RecentSale[]>(),
    ])

    const revenue =
      (saleTotals[0]?.revenue ?? 0) - (returnImpactTotals[0]?.revenue ?? 0)
    const grossProfit =
      (saleTotals[0]?.grossProfit ?? 0) -
      (returnImpactTotals[0]?.grossProfit ?? 0)

    const report: ReportPdfSummary = {
      products: productTotals[0]?.products ?? 0,
      inventoryCost: productTotals[0]?.inventoryCost ?? 0,
      inventoryRetail: productTotals[0]?.inventoryRetail ?? 0,
      sales: saleTotals[0]?.sales ?? 0,
      revenue,
      grossProfit,
      costOfSales: revenue - grossProfit,
      expenses: expenseTotals[0]?.expenses ?? 0,
      returnCostImpact: 0,
      revenueCash:
        paymentTotals.find((entry) => entry._id === "cash")?.total ?? 0,
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

    const topMovingBySku = new Map<string, ReportPdfTopMovingProduct>()
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

    const pdf = await generateReportPDF(
      {
        from: range.from,
        to: range.to,
        generatedAt: new Date(),
        reports: [report],
        topMovingProducts: netTopMovingProducts,
        recentSales: recentSales.map((sale) => ({
          _id: sale._id.toString(),
          createdAt: sale.approvedAt ?? sale.createdAt,
          totalAmount: sale.totalAmount,
          items: sale.items.map((item) => ({
            name: item.name,
            sku: item.sku,
            unit: item.unit,
            quantity: item.quantity,
          })),
        })),
      },
      {
        name: "Prime Trade Company Ltd",
        email: "primetrade155@gmail.com",
        phone: "Tel No: 0788746260",
      }
    )

    const filename = `inventory-report-${formatKigaliDateInput(
      range.from
    )}-to-${formatKigaliDateInput(range.to)}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("[Report PDF Error]", error)
    const detail = error instanceof Error ? `: ${error.message}` : ""
    return NextResponse.json(
      { success: false, error: `Failed to generate report PDF${detail}` },
      { status: 500 }
    )
  }
}
