import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/app-shell"
import type { HeaderNotifications } from "@/components/layout/header-notifications"
import { requireServerSession } from "@/lib/auth/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"
import { Product } from "@/lib/db/models/Product"
import { Proforma } from "@/lib/db/models/Proforma"
import { Sale } from "@/lib/db/models/Sale"
import { User } from "@/lib/db/models/User"
import { approvedSaleFilter } from "@/lib/db/sales-approval"
import { activeRecordFilter } from "@/lib/db/soft-delete"
import { formatInKigali, getKigaliDateParts } from "@/lib/utils/time"

type DashboardLayoutUser = {
  name?: string
}

type PendingSaleNotification = {
  _id: { toString(): string }
  totalAmount: number
  createdAt?: Date
}

type BelowCostSaleNotification = {
  _id: { toString(): string }
  totalAmount: number
  saleDate?: Date
  createdAt?: Date
  items: Array<{
    basePrice: number
    sellingPrice: number
  }>
}

type PendingProformaNotification = {
  _id: { toString(): string }
  proformaNumber: string
  customerName: string
  totalAmount: number
  createdAt?: Date
}

type PendingExpenseNotification = {
  _id: { toString(): string }
  title: string
  amount: number
  createdAt?: Date
}

type BelowCostProductNotification = {
  _id: { toString(): string }
  name: string
  sku: string
  costPrice: number
  price: number
}

type LoanNotification = {
  _id: { toString(): string }
  totalAmount: number
  outstanding?: {
    customerName?: string
    customerPhone?: string
    paymentDate?: Date
  }
}

function getKigaliDateNumber(dateInput: Date | undefined) {
  if (!dateInput) return null

  const parts = getKigaliDateParts(dateInput)
  return parts.year * 10000 + parts.month * 100 + parts.day
}

async function getHeaderNotifications(): Promise<HeaderNotifications> {
  await connectToDatabase()

  const today = getKigaliDateNumber(new Date())
  const [
    pendingSales,
    belowCostSales,
    pendingProformas,
    pendingExpenses,
    belowCostProducts,
    loanSales,
  ] =
    await Promise.all([
      Sale.find({ approvalStatus: "pending", ...activeRecordFilter })
        .select("totalAmount createdAt")
        .sort({ createdAt: -1 })
        .lean<PendingSaleNotification[]>(),
      Sale.find({
        ...activeRecordFilter,
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ["$items", []] },
                  as: "item",
                  cond: { $lt: ["$$item.sellingPrice", "$$item.basePrice"] },
                },
              },
            },
            0,
          ],
        },
      })
        .select("totalAmount saleDate createdAt items.basePrice items.sellingPrice")
        .sort({ saleDate: -1, createdAt: -1 })
        .lean<BelowCostSaleNotification[]>(),
      Proforma.find({ approvalStatus: "pending" })
        .select("proformaNumber customerName totalAmount createdAt")
        .sort({ createdAt: -1 })
        .lean<PendingProformaNotification[]>(),
      Expense.find({ approvalStatus: "pending" })
        .select("title amount createdAt")
        .sort({ createdAt: -1 })
        .lean<PendingExpenseNotification[]>(),
      Product.find({
        ...activeRecordFilter,
        $expr: { $lt: ["$price", { $ifNull: ["$costPrice", 0] }] },
      })
        .select("name sku costPrice price")
        .sort({ name: 1 })
        .lean<BelowCostProductNotification[]>(),
      Sale.find({ ...approvedSaleFilter, paymentStatus: "unpaid" })
        .select("totalAmount outstanding")
        .sort({ "outstanding.paymentDate": 1, createdAt: -1 })
        .lean<LoanNotification[]>(),
    ])

  const loans = loanSales.map((sale) => ({
    _id: sale._id.toString(),
    customerName: sale.outstanding?.customerName ?? "Not recorded",
    customerPhone: sale.outstanding?.customerPhone ?? "",
    paymentDate: sale.outstanding?.paymentDate,
    paymentDateNumber: getKigaliDateNumber(sale.outstanding?.paymentDate),
    paymentDateLabel: formatInKigali(sale.outstanding?.paymentDate, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }),
    totalAmount: sale.totalAmount,
  }))

  return {
    pendingSales: pendingSales.map((sale) => ({
      _id: sale._id.toString(),
      totalAmount: sale.totalAmount,
      createdAtLabel: formatInKigali(sale.createdAt, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })),
    belowCostSales: belowCostSales.map((sale) => ({
      _id: sale._id.toString(),
      totalAmount: sale.totalAmount,
      belowCostItemCount: sale.items.filter(
        (item) => item.sellingPrice < item.basePrice
      ).length,
      saleDateLabel: formatInKigali(sale.saleDate ?? sale.createdAt, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    })),
    pendingProformas: pendingProformas.map((proforma) => ({
      _id: proforma._id.toString(),
      number: proforma.proformaNumber,
      customerName: proforma.customerName,
      totalAmount: proforma.totalAmount,
      createdAtLabel: formatInKigali(proforma.createdAt, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })),
    pendingExpenses: pendingExpenses.map((expense) => ({
      _id: expense._id.toString(),
      title: expense.title,
      amount: expense.amount,
      createdAtLabel: formatInKigali(expense.createdAt, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })),
    belowCostProducts: belowCostProducts.map((product) => ({
      _id: product._id.toString(),
      name: product.name,
      sku: product.sku,
      costPrice: product.costPrice,
      price: product.price,
    })),
    dueLoans: today
      ? loans
          .filter((loan) => loan.paymentDateNumber === today)
          .map(({ paymentDate: _paymentDate, paymentDateNumber: _dateNumber, ...loan }) => loan)
      : [],
    overdueLoans: today
      ? loans
          .filter(
            (loan) =>
              loan.paymentDateNumber !== null && loan.paymentDateNumber < today
          )
          .map(({ paymentDate: _paymentDate, paymentDateNumber: _dateNumber, ...loan }) => loan)
      : [],
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await requireServerSession()
  let userName = session.name

  if (!userName) {
    await connectToDatabase()
    const user = await User.findById(session.userId)
      .select("name")
      .lean<DashboardLayoutUser | null>()
    userName = user?.name
  }

  const notifications = session.isAdmin
    ? await getHeaderNotifications()
    : undefined

  return (
    <AppShell
      session={session}
      userName={userName}
      notifications={notifications}
    >
      {children}
    </AppShell>
  )
}
