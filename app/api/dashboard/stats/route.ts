import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnTransaction } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { Invoice } from "@/lib/db/models/Invoice"
import { Expense } from "@/lib/db/models/Expense"
import { approvedExpenseDateFilter } from "@/lib/db/expense-approval"
import {
  approvedSaleDateFilter,
  approvedSaleFilter,
} from "@/lib/db/sales-approval"
import { getKigaliDateParts } from "@/lib/utils/time"

type DashboardSaleItem = {
  quantity: number
  unit?: string
}

type DashboardRecentSale = {
  _id: { toString(): string }
  createdAt?: Date
  approvedAt?: Date
  totalAmount: number
  items: DashboardSaleItem[]
}

type DashboardLowStockProduct = {
  _id: { toString(): string }
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
}

type DashboardMoneyTotal = {
  total: number
}

type DashboardRevenueTotal = {
  revenue: number
}

type DashboardReturnTotals = {
  revenue: number
  grossProfit: number
}

type DashboardTopMovingProduct = {
  _id: {
    sku: string
    name: string
    unit?: string
  }
  soldQuantity: number
  salesValue: number
}

function getTodayRange() {
  const now = new Date()
  const parts = getKigaliDateParts(now)
  const utcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0)
  // Kigali stays on CAT (UTC+2) year-round.
  const start = new Date(utcMidnight - 2 * 60 * 60 * 1000)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectToDatabase()

    const today = getTodayRange()
    const todayDateRange = { $gte: today.start, $lt: today.end }
    const todayFilter = approvedSaleDateFilter(todayDateRange)

    const [
      productCount,
      lowStockCount,
      salesCount,
      salesToday,
      invoiceCount,
      unpaidCount,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({
        $expr: { $lte: ["$quantity", { $ifNull: ["$lowStockThreshold", 0] }] },
      }),
      Sale.countDocuments(approvedSaleFilter),
      Sale.countDocuments(todayFilter),
      Invoice.countDocuments(),
      Invoice.countDocuments({ status: "unpaid" }),
    ])

    const sales = await Sale.aggregate<DashboardMoneyTotal>([
      { $match: approvedSaleFilter },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ])

    const allReturnTotals = await ReturnTransaction.aggregate<DashboardMoneyTotal>([
      { $unwind: "$returnItems" },
      { $group: { _id: null, total: { $sum: "$returnItems.lineTotal" } } },
    ])

    const stockValue = await Product.aggregate<DashboardMoneyTotal>([
      { $match: {} },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: [
                { $ifNull: ["$quantity", 0] },
                { $ifNull: ["$costPrice", 0] },
              ],
            },
          },
        },
      },
    ])

    const unpaidTotals = await Invoice.aggregate<DashboardMoneyTotal>([
      { $match: { status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ])

    const todaySalesTotals = await Sale.aggregate<DashboardRevenueTotal>([
      { $match: todayFilter },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
        },
      },
    ])

    const todayCostTotals = await Sale.aggregate<DashboardMoneyTotal>([
      { $match: todayFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $multiply: ["$items.basePrice", "$items.quantity"],
            },
          },
        },
      },
    ])

    const todayGrossProfit = await Sale.aggregate<DashboardMoneyTotal>([
      { $match: todayFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $subtract: [
                "$items.lineTotal",
                { $multiply: ["$items.basePrice", "$items.quantity"] },
              ],
            },
          },
        },
      },
    ])

    const todayReturnTotals = await ReturnTransaction.aggregate<DashboardReturnTotals>([
      { $match: { createdAt: { $gte: today.start, $lt: today.end } } },
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
    ])

    const todayExpenses = await Expense.aggregate<DashboardMoneyTotal>([
      {
        $match: approvedExpenseDateFilter(todayDateRange),
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])

    const lowStockProducts = await Product.find({
      $expr: { $lte: ["$quantity", { $ifNull: ["$lowStockThreshold", 0] }] },
    })
      .select("name sku quantity unit lowStockThreshold")
      .sort({ quantity: 1, name: 1 })
      .limit(8)
      .lean<DashboardLowStockProduct[]>()

    const recentSales = await Sale.find(approvedSaleFilter)
      .select("totalAmount items createdAt approvedAt")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean<DashboardRecentSale[]>()

    const topMoving = await Sale.aggregate<DashboardTopMovingProduct>([
      { $match: approvedSaleFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            sku: "$items.sku",
            name: "$items.name",
            unit: "$items.unit",
          },
          soldQuantity: { $sum: "$items.quantity" },
          salesValue: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { soldQuantity: -1 } },
    ])

    const returnedTopMoving =
      await ReturnTransaction.aggregate<DashboardTopMovingProduct>([
        { $match: {} },
        { $unwind: "$returnItems" },
        {
          $group: {
            _id: {
              sku: "$returnItems.sku",
              name: "$returnItems.name",
              unit: "$returnItems.unit",
            },
            soldQuantity: { $sum: "$returnItems.quantity" },
            salesValue: { $sum: "$returnItems.lineTotal" },
          },
        },
      ])

    const topMovingBySku = new Map<string, DashboardTopMovingProduct>()
    topMoving.forEach((entry) => {
      topMovingBySku.set(entry._id.sku, { ...entry })
    })
    returnedTopMoving.forEach((entry) => {
      const current = topMovingBySku.get(entry._id.sku) ?? {
        _id: entry._id,
        soldQuantity: 0,
        salesValue: 0,
      }

      topMovingBySku.set(entry._id.sku, {
        ...current,
        soldQuantity: current.soldQuantity - entry.soldQuantity,
        salesValue: current.salesValue - entry.salesValue,
      })
    })
    const netTopMoving = Array.from(topMovingBySku.values())
      .filter((entry) => entry.soldQuantity !== 0 || entry.salesValue !== 0)
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, 6)

    const returnCostToday =
      (todayReturnTotals[0]?.revenue || 0) -
      (todayReturnTotals[0]?.grossProfit || 0)
    const costOfSalesToday =
      (todayCostTotals[0]?.total || 0) - returnCostToday

    return NextResponse.json({
      success: true,
      data: {
        productCount,
        lowStockCount,
        salesCount,
        salesToday,
        invoiceCount,
        unpaidCount,
        stockValue: stockValue[0]?.total || 0,
        revenue: (sales[0]?.total || 0) - (allReturnTotals[0]?.total || 0),
        revenueToday:
          (todaySalesTotals[0]?.revenue || 0) -
          (todayReturnTotals[0]?.revenue || 0),
        costOfSalesToday,
        grossProfitToday:
          (todayGrossProfit[0]?.total || 0) -
          (todayReturnTotals[0]?.grossProfit || 0),
        expensesToday: todayExpenses[0]?.total || 0,
        returnCostToday,
        outstandingAmount: unpaidTotals[0]?.total || 0,
        lowStockProducts: lowStockProducts.map((product) => ({
          _id: product._id.toString(),
          name: product.name,
          sku: product.sku,
          quantity: product.quantity,
          unit: product.unit ?? "pcs",
          lowStockThreshold: product.lowStockThreshold ?? 0,
        })),
        recentSales: recentSales.map((sale) => ({
          _id: sale._id.toString(),
          createdAt: sale.approvedAt ?? sale.createdAt,
          totalAmount: sale.totalAmount,
          quantitySold: sale.items.reduce((acc, item) => acc + item.quantity, 0),
          units: Array.from(
            new Set(sale.items.map((item) => item.unit ?? "pcs"))
          ),
        })),
        topMoving: netTopMoving.map((entry) => ({
          sku: entry._id.sku,
          name: entry._id.name,
          unit: entry._id.unit ?? "pcs",
          soldQuantity: entry.soldQuantity,
          salesValue: entry.salesValue,
        })),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
