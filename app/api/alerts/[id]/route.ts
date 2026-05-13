import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Alert } from "@/lib/db/models/Alert"
import { requireAdmin } from "@/lib/auth/middleware"
import { UpdateAlertSchema } from "@/lib/db/validators/alert"

export async function PUT(
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
    const payload = UpdateAlertSchema.parse(await request.json())

    await connectToDatabase()
    const alert = await Alert.findOneAndUpdate(
      { _id: id },
      {
        ...payload,
        resolvedAt: payload.isResolved ? new Date() : undefined,
      },
      { returnDocument: "after", runValidators: true }
    )

    if (!alert) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: alert })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update alert" },
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
    const alert = await Alert.findOneAndDelete({ _id: id })

    if (!alert) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete alert" },
      { status: 400 }
    )
  }
}
