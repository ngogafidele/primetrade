import { NextResponse, type NextRequest } from "next/server"
import { getCurrentSession } from "@/lib/auth/active-session"
import {
  AUTH_COOKIE,
  createToken,
  getAuthCookieOptions,
  refreshSessionActivity,
  verifyToken,
} from "@/lib/auth/session"

const PUBLIC_PATHS = ["/", "/reset-password", "/setup-admin"]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) {
    return NextResponse.next()
  }

  const verifiedSession = verifyToken(token)
  const session = await getCurrentSession(verifiedSession).catch((error) => {
    console.error("[Proxy Auth Error]", error)
    return null
  })

  if (!session) {
    const response = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json(
          { success: false, error: "Session expired" },
          { status: 401 }
        )
      : isPublicPath(request.nextUrl.pathname)
        ? NextResponse.next()
        : NextResponse.redirect(new URL("/", request.url))

    clearAuthCookie(response)
    return response
  }

  const refreshedSession = refreshSessionActivity(session)
  const response = NextResponse.next()
  response.cookies.set(
    AUTH_COOKIE,
    createToken(refreshedSession),
    getAuthCookieOptions(refreshedSession)
  )
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
