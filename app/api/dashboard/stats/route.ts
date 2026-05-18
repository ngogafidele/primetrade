import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { ReturnTransaction } from "@/lib/db/models/Return"
import { Sale } from "@/lib/db/models/Sale"
import { Invoice } from "@/lib/db/models/Invoice"
import { Expense } from "@/lib/db/models/Expense"
import { getKigaliDateParts } from "@/lib/utils/time"

type DashboardSaleItem = {
  quantity: number
  unit?: string
}

type DashboardRecentSale = {
  _id: { toString(): string }
  createdAt?: Date
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
    const todayFilter = {
      createdAt: { $gte: today.start, $lt: today.end },
    }

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
      Sale.countDocuments(),
      Sale.countDocuments(todayFilter),
      Invoice.countDocuments(),
      Invoice.countDocuments({ status: "unpaid" }),
    ])

    const sales = await Sale.aggregate<DashboardMoneyTotal>([
      { $match: {} },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
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

    const todayReturnCosts = await ReturnTransaction.aggregate<{
      _id: null
      returnCost: number
      replacementCost: number
    }>([
      { $match: { createdAt: { $gte: today.start, $lt: today.end } } },
      {
        $facet: {
          returnCosts: [
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
                total: {
                  $sum: {
                    $multiply: [
                      "$returnItems.quantity",
                      { $ifNull: ["$product.costPrice", 0] },
                    ],
                  },
                },
              },
            },
          ],
          replacementCosts: [
            { $unwind: "$replacementItems" },
            {
              $lookup: {
                from: "products",
                localField: "replacementItems.productId",
                foreignField: "_id",
                as: "product",
              },
            },
            { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
            {
              $group: {
                _id: null,
                total: {
                  $sum: {
                    $multiply: [
                      "$replacementItems.quantity",
                      { $ifNull: ["$product.costPrice", 0] },
                    ],
                  },
                },
              },
            },
          ],
        },
      },
      {
        $project: {
          _id: null,
          returnCost: {
            $ifNull: [{ $arrayElemAt: ["$returnCosts.total", 0] }, 0],
          },
          replacementCost: {
            $ifNull: [{ $arrayElemAt: ["$replacementCosts.total", 0] }, 0],
          },
        },
      },
    ])

    const todayExpenses = await Expense.aggregate<DashboardMoneyTotal>([
      {
        $match: {
          $or: [
            { incurredAt: { $gte: today.start, $lt: today.end } },
            { incurredAt: { $exists: false }, createdAt: todayFilter.createdAt },
            { incurredAt: null, createdAt: todayFilter.createdAt },
          ],
        },
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

    const recentSales = await Sale.find()
      .select("totalAmount items createdAt")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean<DashboardRecentSale[]>()

    const topMoving = await Sale.aggregate<DashboardTopMovingProduct>([
      { $match: {} },
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
      { $limit: 6 },
    ])

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
        revenue: sales[0]?.total || 0,
        revenueToday: todaySalesTotals[0]?.revenue || 0,
        grossProfitToday: todayGrossProfit[0]?.total || 0,
        expensesToday: todayExpenses[0]?.total || 0,
        returnCostToday:
          (todayReturnCosts[0]?.returnCost || 0) -
          (todayReturnCosts[0]?.replacementCost || 0),
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
          createdAt: sale.createdAt,
          totalAmount: sale.totalAmount,
          quantitySold: sale.items.reduce((acc, item) => acc + item.quantity, 0),
          units: Array.from(
            new Set(sale.items.map((item) => item.unit ?? "pcs"))
          ),
        })),
        topMoving: topMoving.map((entry) => ({
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
