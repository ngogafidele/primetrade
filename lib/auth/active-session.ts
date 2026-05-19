import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import {
  isSessionIdleExpired,
  type AuthSession,
} from "@/lib/auth/session"

type CurrentUser = {
  name?: string
  email: string
  role: AuthSession["role"]
  isAdmin: boolean
  isActive: boolean
}

function isValidRole(role: string): role is AuthSession["role"] {
  return role === "admin" || role === "manager" || role === "staff"
}

export async function getCurrentSession(
  session: AuthSession | null
): Promise<AuthSession | null> {
  if (!session) return null

  await connectToDatabase()

  const user = await User.findById(session.userId)
    .select("name email role isAdmin isActive")
    .lean<CurrentUser | null>()

  if (!user || !user.isActive || !isValidRole(user.role)) {
    return null
  }

  const currentSession: AuthSession = {
    userId: session.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    loginLogId: session.loginLogId,
    lastActivityAt: session.lastActivityAt,
  }

  if (isSessionIdleExpired(currentSession)) {
    return null
  }

  return currentSession
}
