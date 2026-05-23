import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Expense } from "@/lib/db/models/Expense"

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
    )

    if (!expense) {
      return NextResponse.json(
        { success: false, error: "Pending expense not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: expense })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to approve expense" },
      { status: 400 }
    )
  }
}
