import { NextRequest, NextResponse } from "next/server"
import { comparePassword } from "@/lib/auth/hash"
import { User } from "@/lib/db/models/User"
import type { AuthSession } from "@/lib/auth/session"

export async function verifyActionPassword(
  request: NextRequest,
  session: AuthSession
) {
  const payload = await request.json().catch(() => null)
  const password = typeof payload?.password === "string" ? payload.password : ""

  if (!password) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      ),
      payload,
    }
  }

  const user = await User.findById(session.userId).select("password isActive")
  if (!user?.isActive) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
      payload,
    }
  }

  const isValid = await comparePassword(password, user.password)
  if (!isValid) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Password is incorrect" },
        { status: 403 }
      ),
      payload,
    }
  }

  return { ok: true as const, payload }
}
