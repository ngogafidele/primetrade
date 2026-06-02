import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"

type ExpenseApiEntry = {
  _id: { toString(): string }
  title: string
  amount: number
  category?: string
  vendor?: string
  notes?: string
  incurredAt?: Date
  createdAt?: Date
  approvalStatus?: "pending" | "approved"
}

function serializeExpense(expense: ExpenseApiEntry) {
  return {
    _id: expense._id.toString(),
    title: expense.title,
    amount: expense.amount,
    category: expense.category ?? "",
    vendor: expense.vendor ?? "",
    notes: expense.notes ?? "",
    incurredAt: expense.incurredAt?.toISOString(),
    createdAt: expense.createdAt?.toISOString(),
    approvalStatus: expense.approvalStatus ?? "approved",
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const payload = await request.json().catch(() => null)
    if (payload?.approvalStatus !== "approved") {
      return NextResponse.json(
        { success: false, error: "Only approval updates are supported" },
        { status: 400 }
      )
    }

    const { id } = await context.params
    const approvedAt = new Date()

    await connectToDatabase()
    const expense = await Expense.findOneAndUpdate(
      { _id: id, approvalStatus: "pending" },
      {
        approvalStatus: "approved",
        approvedBy: session.userId,
        approvedAt,
      },
      { returnDocument: "after", runValidators: true }
    ).lean<ExpenseApiEntry | null>()

    if (!expense) {
      return NextResponse.json(
        { success: false, error: "Pending expense not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: serializeExpense(expense),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to approve expense" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const expense = await Expense.findByIdAndDelete(id)

    if (!expense) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to delete expense" },
      { status: 400 }
    )
  }
}
