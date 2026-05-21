"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bell, CheckCircle2, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/format"

export type HeaderNotificationSale = {
  _id: string
  totalAmount: number
  createdAtLabel: string
}

export type HeaderNotificationLoan = {
  _id: string
  customerName: string
  customerPhone: string
  paymentDateLabel: string
  totalAmount: number
}

export type HeaderNotifications = {
  pendingSales: HeaderNotificationSale[]
  dueLoans: HeaderNotificationLoan[]
  overdueLoans: HeaderNotificationLoan[]
}

export function HeaderNotificationsButton({
  notifications,
}: {
  notifications: HeaderNotifications
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const totalCount = useMemo(
    () =>
      notifications.pendingSales.length +
      notifications.dueLoans.length +
      notifications.overdueLoans.length,
    [notifications]
  )

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative"
      >
        <Bell className="size-4" />
        {totalCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-semibold text-white">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                Admin items needing attention
              </p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
              {totalCount}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="-mr-1"
            >
              <X className="size-4" />
            </Button>
          </div>

          {totalCount === 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-muted/40 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
              <p>No pending approvals or due loans.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <NotificationGroup
                href="/sales"
                icon={<Bell className="size-4 text-primary" />}
                items={notifications.pendingSales}
                label="Sales to approve"
                onNavigate={() => setOpen(false)}
                renderItem={(sale) => (
                  <>
                    <span>{formatCurrency(sale.totalAmount)}</span>
                    <span className="text-muted-foreground">
                      {sale.createdAtLabel}
                    </span>
                  </>
                )}
              />

              <NotificationGroup
                href="/loans"
                icon={<Clock className="size-4 text-amber-600" />}
                items={notifications.dueLoans}
                label="Loans due today"
                onNavigate={() => setOpen(false)}
                renderItem={(loan) => (
                  <>
                    <span>{loan.customerName}</span>
                    <span className="text-muted-foreground">
                      {loan.customerPhone || "No phone"} -{" "}
                      {formatCurrency(loan.totalAmount)}
                    </span>
                  </>
                )}
              />

              <NotificationGroup
                href="/loans"
                icon={<AlertTriangle className="size-4 text-destructive" />}
                items={notifications.overdueLoans}
                label="Overdue loans"
                onNavigate={() => setOpen(false)}
                renderItem={(loan) => (
                  <>
                    <span>{loan.customerName}</span>
                    <span className="text-muted-foreground">
                      {loan.paymentDateLabel} - {formatCurrency(loan.totalAmount)}
                    </span>
                  </>
                )}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function NotificationGroup<T>({
  href,
  icon,
  items,
  label,
  onNavigate,
  renderItem,
}: {
  href: string
  icon: ReactNode
  items: T[]
  label: string
  onNavigate: () => void
  renderItem: (item: T) => ReactNode
}) {
  if (items.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          <span>{label}</span>
        </div>
        <Link
          className="text-xs font-medium text-primary hover:underline"
          href={href}
          onClick={onNavigate}
        >
          View
        </Link>
      </div>
      <div className="space-y-1">
        {items.slice(0, 4).map((item, index) => (
          <div
            key={index}
            className="flex flex-col rounded-lg border border-border/80 bg-background px-3 py-2 text-sm"
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
      {items.length > 4 ? (
        <p className="text-xs text-muted-foreground">
          +{items.length - 4} more
        </p>
      ) : null}
    </section>
  )
}
