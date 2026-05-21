import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/app-shell"
import type { HeaderNotifications } from "@/components/layout/header-notifications"
import { requireServerSession } from "@/lib/auth/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { User } from "@/lib/db/models/User"
import { approvedSaleFilter } from "@/lib/db/sales-approval"
import { formatInKigali, getKigaliDateParts } from "@/lib/utils/time"

type DashboardLayoutUser = {
  name?: string
}

type PendingSaleNotification = {
  _id: { toString(): string }
  totalAmount: number
  createdAt?: Date
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
  const [pendingSales, loanSales] = await Promise.all([
    Sale.find({ approvalStatus: "pending" })
      .select("totalAmount createdAt")
      .sort({ createdAt: -1 })
      .lean<PendingSaleNotification[]>(),
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
