import type { ReactNode } from "react"
import Image from "next/image"
import type { AuthSession } from "@/lib/auth/session"
import { Sidebar } from "@/components/layout/sidebar"
import { LogoutButton } from "@/components/auth/logout-button"
import {
  HeaderNotificationsButton,
  type HeaderNotifications,
} from "@/components/layout/header-notifications"
import { UserRound } from "lucide-react"

export function AppShell({
  session,
  userName,
  notifications,
  children,
}: {
  session: AuthSession
  userName?: string
  notifications?: HeaderNotifications
  children: ReactNode
}) {
  const displayName = userName ?? session.name ?? session.email

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-3 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-1.5 shadow-sm">
              <Image
                src="/images/logo.png"
                alt="Prime Trade logo"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Prime Trade Inventory Management System
              </p>
              <h1 className="text-xl font-semibold sm:text-2xl">Operations Hub</h1>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
            {session.isAdmin && notifications ? (
              <HeaderNotificationsButton notifications={notifications} />
            ) : null}
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {session.role} - {session.email}
                </p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[96rem] flex-col gap-3 px-3 py-3 sm:px-4 sm:py-4 lg:px-5 md:flex-row">
        <Sidebar session={session} />
        <main className="flex-1 rounded-2xl border border-border/80 bg-card/95 p-3 shadow-sm backdrop-blur-sm sm:p-4 lg:p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
