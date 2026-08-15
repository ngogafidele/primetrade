"use client"

import { Fragment, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CreditCard, Download, RotateCcw, Search, Trash2 } from "lucide-react"
import { PasswordConfirmDialog } from "@/components/auth/password-confirm-dialog"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali, formatKigaliDateInput } from "@/lib/utils/time"

type OutstandingItem = {
  name: string
  sku?: string
  unit?: string
  quantity: number
}

export type OutstandingSaleClient = {
  _id: string
  createdAt?: string
  createdAtLabel: string
  customerName: string
  customerPhone: string
  paymentDate?: string
  paymentDateLabel: string
  paymentDateStatus: "overdue" | "due" | "upcoming" | "unknown"
  items: OutstandingItem[]
  recordedBy: string
  totalAmount: number
  paymentStatus?: "paid" | "unpaid"
  amountPaid: number
  remainingBalance: number
  payments: Array<{
    amount: number
    paymentMethod: "cash" | "mobile-money" | "bank"
    paidAt?: string
    notes?: string
  }>
}

type DeletedOutstandingSaleClient = OutstandingSaleClient & {
  deletedByName?: string
  deletedAtLabel?: string
}

function summarizeItems(items: OutstandingItem[]) {
  if (!items.length) return "No items"
  return items
    .map((item) => `${item.name} (${item.quantity} ${item.unit ?? "pcs"})`)
    .join(", ")
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function PaymentDateStatusBadge({
  status,
}: {
  status: OutstandingSaleClient["paymentDateStatus"]
}) {
  if (status === "overdue") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
        Overdue
      </span>
    )
  }

  if (status === "due") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-accent/60 bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
        Due today
      </span>
    )
  }

  return null
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getAmountPaid(sale: OutstandingSaleClient) {
  return roundMoney(
    typeof sale.amountPaid === "number"
      ? sale.amountPaid
      : sale.payments.reduce((sum, payment) => sum + payment.amount, 0)
  )
}

function getRemainingBalance(sale: OutstandingSaleClient) {
  return roundMoney(
    typeof sale.remainingBalance === "number"
      ? sale.remainingBalance
      : Math.max(0, sale.totalAmount - getAmountPaid(sale))
  )
}

function getPaymentMethodLabel(
  value: "cash" | "mobile-money" | "bank" | undefined
) {
  if (value === "mobile-money") return "Mobile Money"
  if (value === "bank") return "Bank"
  return "Cash"
}

function refreshLoanNotifications() {
  window.dispatchEvent(new Event("loan-notifications:refresh"))
}

export function OutstandingManager({
  initialSales,
  initialDeletedSales,
  isAdmin,
  canViewLoanTotals,
}: {
  initialSales: OutstandingSaleClient[]
  initialDeletedSales: DeletedOutstandingSaleClient[]
  isAdmin: boolean
  canViewLoanTotals: boolean
}) {
  const router = useRouter()
  const [sales, setSales] = useState(initialSales)
  const [deletedSales, setDeletedSales] = useState(initialDeletedSales)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [paymentTarget, setPaymentTarget] =
    useState<OutstandingSaleClient | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "mobile-money" | "bank"
  >("cash")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<OutstandingSaleClient | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] =
    useState<DeletedOutstandingSaleClient | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const matchesFilters = (
    sale: OutstandingSaleClient,
    query: string,
    normalizedQuery: string
  ) => {
    const saleDate = sale.createdAt ? formatKigaliDateInput(sale.createdAt) : ""
    if (dateFrom && (!saleDate || saleDate < dateFrom)) return false
    if (dateTo && (!saleDate || saleDate > dateTo)) return false
    if (!query) return true

    const name = sale.customerName.toLowerCase()
    const phone = sale.customerPhone.toLowerCase()
    return (
      name.includes(query) ||
      phone.includes(query) ||
      normalizeSearchText(name).includes(normalizedQuery) ||
      normalizeSearchText(phone).includes(normalizedQuery)
    )
  }

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    const normalizedQuery = normalizeSearchText(search.trim())
    return sales.filter((sale) => matchesFilters(sale, query, normalizedQuery))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, search, dateFrom, dateTo])

  const filteredDeletedSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    const normalizedQuery = normalizeSearchText(search.trim())
    return deletedSales.filter((sale) =>
      matchesFilters(sale, query, normalizedQuery)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletedSales, search, dateFrom, dateTo])

  const totalOutstanding = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + getRemainingBalance(sale), 0),
    [filteredSales]
  )

  const paymentAlerts = useMemo(() => {
    return sales.reduce(
      (alerts, sale) => {
        if (sale.paymentDateStatus === "overdue") alerts.overdue += 1
        if (sale.paymentDateStatus === "due") alerts.due += 1
        return alerts
      },
      { overdue: 0, due: 0 }
    )
  }, [sales])

  const openPaymentDialog = (sale: OutstandingSaleClient) => {
    setError(null)
    setPaymentTarget(sale)
    setPaymentAmount(String(getRemainingBalance(sale)))
    setPaymentMethod("cash")
    setPaymentNotes("")
  }

  const recordPayment = async () => {
    if (!paymentTarget) return

    if (!isAdmin) {
      setError("Only admins can record loan payments.")
      return
    }

    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a payment amount greater than zero.")
      return
    }

    if (amount > getRemainingBalance(paymentTarget)) {
      setError("Payment amount cannot exceed the remaining loan balance.")
      return
    }

    setUpdatingId(paymentTarget._id)
    setError(null)

    try {
      const response = await fetch(`/api/sales/${paymentTarget._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paymentMethod, notes: paymentNotes }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to record payment.")
        return
      }

      const updatedSale = body.data as OutstandingSaleClient
      setSales((current) => {
        if (updatedSale.paymentStatus === "paid") {
          return current.filter((sale) => sale._id !== paymentTarget._id)
        }

        return current.map((sale) =>
          sale._id === paymentTarget._id
            ? {
                ...sale,
                amountPaid: updatedSale.amountPaid,
                remainingBalance: updatedSale.remainingBalance,
                payments: updatedSale.payments ?? [],
              }
            : sale
        )
      })
      setPaymentTarget(null)
      refreshLoanNotifications()
      router.refresh()
    } catch {
      setError("Failed to record payment.")
    } finally {
      setUpdatingId(null)
    }
  }

  const downloadCustomerPdf = async (sale: OutstandingSaleClient) => {
    const customerName = sale.customerName.trim()
    if (!customerName || customerName === "Not recorded") {
      setError("Customer name is missing for this loan.")
      return
    }

    const key = `${sale.customerName}-${sale.customerPhone}`
    setDownloadingKey(key)
    setError(null)

    try {
      const params = new URLSearchParams({ customerName })
      if (sale.customerPhone !== "Not recorded") {
        params.set("customerPhone", sale.customerPhone)
      }
      const response = await fetch(`/api/loans/pdf?${params.toString()}`)

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download loan PDF.")
        return
      }

      const disposition = response.headers.get("Content-Disposition")
      const match = disposition?.match(/filename="([^"]+)"/)
      const filename =
        match?.[1] ??
        `loan-${customerName
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase() || "customer"}.pdf`
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download loan PDF.")
    } finally {
      setDownloadingKey(null)
    }
  }

  const deleteLoan = async (password: string) => {
    if (!deleteTarget) return

    setDeleteError(null)
    setDeletingId(deleteTarget._id)

    try {
      const response = await fetch(`/api/sales/${deleteTarget._id}?loan=true`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setDeleteError(body?.error ?? "Failed to delete loan.")
        return
      }

      setSales((current) =>
        current.filter((sale) => sale._id !== deleteTarget._id)
      )
      setDeleteTarget(null)
      refreshLoanNotifications()
      router.refresh()
    } catch {
      setDeleteError("Failed to delete loan.")
    } finally {
      setDeletingId(null)
    }
  }

  const restoreLoan = async (password: string) => {
    if (!restoreTarget) return

    setRestoreError(null)
    setRestoringId(restoreTarget._id)

    try {
      const response = await fetch(`/api/sales/${restoreTarget._id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setRestoreError(body?.error ?? "Failed to restore loan.")
        return
      }

      const {
        deletedByName: _deletedByName,
        deletedAtLabel: _deletedAtLabel,
        ...restored
      } = restoreTarget
      setDeletedSales((current) =>
        current.filter((sale) => sale._id !== restoreTarget._id)
      )
      setSales((current) => [restored, ...current])
      setRestoreTarget(null)
      refreshLoanNotifications()
      router.refresh()
    } catch {
      setRestoreError("Failed to restore loan.")
    } finally {
      setRestoringId(null)
    }
  }

  const hasPaymentAlerts = paymentAlerts.overdue > 0 || paymentAlerts.due > 0

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Receivables
          </p>
          <h2 className="text-2xl font-semibold">Loans</h2>
          <p className="text-sm text-muted-foreground">
            Track unpaid sales, installments, expected payment dates, and
            customer loan statements.
          </p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by customer name or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          From
          <Input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Filter loans from date"
          />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <Input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="Filter loans to date"
          />
        </label>
        {dateFrom || dateTo ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDateFrom("")
              setDateTo("")
            }}
          >
            Clear dates
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard label="Matching Loans" value={filteredSales.length} />
        {canViewLoanTotals ? (
          <StatsCard
            label="Remaining Loans"
            value={formatCurrency(totalOutstanding)}
          />
        ) : null}
      </div>

      {hasPaymentAlerts ? (
        <div className="flex items-start gap-3 rounded-lg border border-accent/60 bg-accent/15 p-4 text-accent-foreground">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">Payment reminder</p>
            <p className="text-sm">
              {paymentAlerts.overdue > 0
                ? `${paymentAlerts.overdue} overdue payment${
                    paymentAlerts.overdue === 1 ? "" : "s"
                  }`
                : ""}
              {paymentAlerts.overdue > 0 && paymentAlerts.due > 0 ? " and " : ""}
              {paymentAlerts.due > 0
                ? `${paymentAlerts.due} payment${
                    paymentAlerts.due === 1 ? "" : "s"
                  } due today`
                : ""}
              .
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground">
                  No loans match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale, saleIndex) => {
                const downloadKey = `${sale.customerName}-${sale.customerPhone}`
                const payments = sale.payments ?? []

                return (
                  <Fragment key={sale._id}>
                    <TableRow
                      className={
                        saleIndex % 2 === 1
                          ? "bg-muted/60 hover:bg-muted/70"
                          : undefined
                      }
                    >
                      <TableCell>{sale.createdAtLabel}</TableCell>
                      <TableCell className="whitespace-normal">
                        {sale.customerName}
                      </TableCell>
                      <TableCell>{sale.customerPhone}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{sale.paymentDateLabel}</span>
                          <PaymentDateStatusBadge
                            status={sale.paymentDateStatus}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-sm whitespace-normal wrap-break-word">
                          {summarizeItems(sale.items)}
                        </div>
                      </TableCell>
                      <TableCell>{sale.recordedBy}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(sale.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(getAmountPaid(sale))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(getRemainingBalance(sale))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadCustomerPdf(sale)}
                            disabled={downloadingKey === downloadKey}
                          >
                            <Download className="size-3.5" />
                            {downloadingKey === downloadKey
                              ? "Downloading..."
                              : "PDF"}
                          </Button>
                          {isAdmin ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => openPaymentDialog(sale)}
                                disabled={updatingId === sale._id}
                              >
                                <CreditCard className="size-3.5" />
                                {updatingId === sale._id
                                  ? "Saving..."
                                  : "Payment"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteTarget(sale)}
                                disabled={deletingId === sale._id}
                              >
                                <Trash2 className="size-3.5" />
                                {deletingId === sale._id ? "Deleting..." : "Delete"}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    {payments.length > 0 ? (
                      <TableRow
                        className={
                          saleIndex % 2 === 1
                            ? "bg-muted/60 hover:bg-muted/70"
                            : undefined
                        }
                      >
                        <TableCell
                          colSpan={10}
                          className="text-xs text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">
                            Payments:
                          </span>{" "}
                          {payments
                            .map((payment) => {
                              const paidAt = payment.paidAt
                                ? formatInKigali(payment.paidAt, {
                                    year: "numeric",
                                    month: "short",
                                    day: "2-digit",
                                  })
                                : "-"
                              const notes = payment.notes?.trim()
                              return `${formatCurrency(
                                payment.amount
                              )} via ${getPaymentMethodLabel(
                                payment.paymentMethod
                              )} on ${paidAt}${notes ? ` (${notes})` : ""}`
                            })
                            .join("; ")}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </section>

      {isAdmin ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-semibold">Deleted Loans</h3>
            <p className="text-sm text-muted-foreground">
              Deleted loans are excluded from active business numbers. Restoring
              re-applies the sale stock movement and returns the loan to this
              page.
            </p>
          </div>

          {restoreError ? (
            <p className="text-sm text-destructive">{restoreError}</p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Deleted By</TableHead>
                <TableHead>Deleted On</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeletedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    No deleted loans match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeletedSales.map((sale) => (
                  <TableRow key={sale._id}>
                    <TableCell>{sale.createdAtLabel}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
                    <TableCell>{sale.customerPhone}</TableCell>
                    <TableCell className="whitespace-normal">
                      {summarizeItems(sale.items)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(sale.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(getRemainingBalance(sale))}
                    </TableCell>
                    <TableCell>{sale.deletedByName ?? "-"}</TableCell>
                    <TableCell>{sale.deletedAtLabel ?? "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreTarget(sale)}
                        disabled={restoringId === sale._id}
                      >
                        <RotateCcw className="size-3.5" />
                        {restoringId === sale._id ? "Restoring..." : "Restore"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <Dialog
        open={paymentTarget !== null}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setPaymentTarget(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record loan payment</DialogTitle>
            <DialogDescription>
              Record an installment and update the remaining loan balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">
                {paymentTarget?.customerName ?? "-"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Total
                </p>
                <p className="font-semibold">
                  {formatCurrency(paymentTarget?.totalAmount ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Paid
                </p>
                <p className="font-semibold">
                  {formatCurrency(
                    paymentTarget ? getAmountPaid(paymentTarget) : 0
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Remaining
                </p>
                <p className="font-semibold">
                  {formatCurrency(
                    paymentTarget ? getRemainingBalance(paymentTarget) : 0
                  )}
                </p>
              </div>
            </div>
            <label className="grid gap-1 text-sm">
              Amount paid
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Payment method
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(
                    value as "cash" | "mobile-money" | "bank"
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile-money">Mobile Money</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              Notes
              <Input
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                placeholder="Optional note"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentTarget(null)}
              disabled={updatingId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={recordPayment}
              disabled={updatingId !== null}
            >
              {updatingId ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin ? (
        <PasswordConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open && !deletingId) {
              setDeleteTarget(null)
              setDeleteError(null)
            }
          }}
          title="Delete loan?"
          description="This removes the loan from active records and returns its items to stock. You can restore it later from Deleted Loans."
          confirmLabel="Delete Loan"
          pendingLabel="Deleting..."
          pending={deletingId !== null}
          error={deleteError}
          onConfirm={deleteLoan}
        />
      ) : null}

      {isAdmin ? (
        <PasswordConfirmDialog
          open={restoreTarget !== null}
          onOpenChange={(open) => {
            if (!open && !restoringId) {
              setRestoreTarget(null)
              setRestoreError(null)
            }
          }}
          title="Restore loan?"
          description="This returns the loan to active records and deducts its items from stock again."
          confirmLabel="Restore Loan"
          pendingLabel="Restoring..."
          confirmVariant="default"
          pending={restoringId !== null}
          error={restoreError}
          onConfirm={restoreLoan}
        />
      ) : null}
    </div>
  )
}
