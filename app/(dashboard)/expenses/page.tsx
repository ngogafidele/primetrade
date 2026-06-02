import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"
import "@/lib/db/models/User"
import { requireServerSession } from "@/lib/auth/server"
import { ExpensesManager } from "@/components/expenses/expenses-manager"

type PopulatedExpenseUser = {
  _id: { toString(): string }
  name?: string
  email?: string
}

type ExpensePageEntry = {
  _id: { toString(): string }
  title: string
  amount: number
  category?: string
  vendor?: string
  notes?: string
  incurredAt?: Date
  createdAt?: Date
  updatedAt?: Date
  approvalStatus?: "pending" | "approved"
  createdBy?: PopulatedExpenseUser | { toString(): string }
}

function isPopulatedExpenseUser(
  value: ExpensePageEntry["createdBy"]
): value is PopulatedExpenseUser {
  return typeof value === "object" && value !== null && "_id" in value
}

export default async function ExpensesPage() {
  const session = await requireServerSession()

  await connectToDatabase()
  const expenses = await Expense.find()
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean<ExpensePageEntry[]>()

  const serializedExpenses = expenses.map((expense) => ({
    _id: expense._id.toString(),
    title: expense.title,
    amount: expense.amount,
    category: expense.category ?? "",
    vendor: expense.vendor ?? "",
    notes: expense.notes ?? "",
    incurredAt: expense.incurredAt?.toISOString(),
    createdAt: expense.createdAt?.toISOString(),
    approvalStatus: expense.approvalStatus ?? "approved",
    createdByName: isPopulatedExpenseUser(expense.createdBy)
      ? expense.createdBy.name ?? expense.createdBy.email ?? "Unknown User"
      : "Unknown User",
  }))

  return (
    <ExpensesManager
      initialExpenses={serializedExpenses}
      currentUserLabel={session.email}
      canApproveExpenses={session.isAdmin}
    />
  )
}
