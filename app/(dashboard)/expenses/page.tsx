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
    ...expense,
    _id: expense._id.toString(),
    createdAt: expense.createdAt?.toISOString(),
    incurredAt: expense.incurredAt?.toISOString(),
    createdBy: isPopulatedExpenseUser(expense.createdBy)
      ? expense.createdBy._id.toString()
      : expense.createdBy?.toString(),
    createdByName: isPopulatedExpenseUser(expense.createdBy)
      ? expense.createdBy.name ?? expense.createdBy.email ?? "Unknown User"
      : "Unknown User",
  }))

  return (
    <ExpensesManager
      initialExpenses={serializedExpenses}
      currentUserLabel={session.email}
    />
  )
}
