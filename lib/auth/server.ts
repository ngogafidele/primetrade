import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/auth/active-session"
import {
  getSessionFromCookies,
  type AuthSession,
} from "@/lib/auth/session"

export async function requireServerSession(): Promise<AuthSession> {
  const cookieStore = await cookies()
  const session = await getCurrentSession(getSessionFromCookies(cookieStore))
  if (!session) {
    redirect("/")
  }
  return session
}
