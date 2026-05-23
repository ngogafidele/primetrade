import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"
import { requireAuth } from "@/lib/auth/middleware"
import { CreateExpenseSchema } from "@/lib/db/validators/expense"

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    await connectToDatabase()
    const expenses = await Expense.find().sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: expenses })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch expenses" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const payload = CreateExpenseSchema.parse(await request.json())
    const shouldApproveImmediately = session.isAdmin
    const approvalStatus = shouldApproveImmediately ? "approved" : "pending"
    const approvedAt = shouldApproveImmediately ? new Date() : undefined

    await connectToDatabase()

    const expense = await Expense.create({
      title: payload.title,
      amount: payload.amount,
      category: payload.category?.trim() ?? "",
      vendor: payload.vendor?.trim() ?? "",
      notes: payload.notes?.trim() ?? "",
      incurredAt: payload.incurredAt ? new Date(payload.incurredAt) : undefined,
      createdBy: session.userId,
      approvalStatus,
      approvedBy: shouldApproveImmediately ? session.userId : undefined,
      approvedAt,
    })

    return NextResponse.json({ success: true, data: expense }, { status: 201 })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record expense"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
