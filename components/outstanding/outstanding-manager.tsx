"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type OutstandingSaleClient = {
  _id: string
  createdAtLabel: string
  customerName: string
  customerPhone: string
  paymentDateLabel: string
  paymentDateStatus: "overdue" | "due" | "upcoming" | "unknown"
  itemSummary: string
  recordedBy: string
  totalAmount: number
}

function PaymentDateStatusBadge({
  status,
}: {
  status: OutstandingSaleClient["paymentDateStatus"]
}) {
  if (status === "overdue") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        Overdue
      </span>
    )
  }

  if (status === "due") {
    return (
      <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
        Due today
      </span>
    )
  }

  return null
}

export function OutstandingManager({
  initialSales,
}: {
  initialSales: OutstandingSaleClient[]
}) {
  const [sales, setSales] = useState(initialSales)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sales

    return sales.filter((sale) => {
      return (
        sale.customerName.toLowerCase().includes(query) ||
        sale.customerPhone.toLowerCase().includes(query)
      )
    })
  }, [sales, search])

  const totalOutstanding = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    [filteredSales]
  )

  const paymentAlerts = useMemo(() => {
    return sales.reduce(
      (alerts, sale) => {
        if (sale.paymentDateStatus === "overdue") {
          alerts.overdue += 1
        }
        if (sale.paymentDateStatus === "due") {
          alerts.due += 1
        }

        return alerts
      },
      { overdue: 0, due: 0 }
    )
  }, [sales])

  const hasPaymentAlerts = paymentAlerts.overdue > 0 || paymentAlerts.due > 0

  const markPaid = async (saleId: string) => {
    setUpdatingId(saleId)
    setError(null)

    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "paid" }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to remove loan record.")
        return
      }

      setSales((current) => current.filter((sale) => sale._id !== saleId))
    } catch {
      setError("Failed to remove loan record.")
    } finally {
      setUpdatingId(null)
    }
  }

  const downloadCustomerPdf = async (sale: OutstandingSaleClient) => {
    const key = `${sale.customerName}-${sale.customerPhone}`
    setDownloadingKey(key)
    setError(null)

    try {
      const params = new URLSearchParams({ customerName: sale.customerName })
      if (sale.customerPhone !== "Not recorded") {
        params.set("customerPhone", sale.customerPhone)
      }
      const response = await fetch(`/api/loans/pdf?${params.toString()}`)

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download loan PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `loan-${sale.customerName
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "customer"}.pdf`
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

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Matching Loans</p>
          <p className="mt-1 text-2xl font-semibold">{filteredSales.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Matching Amount</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
      </section>

      {hasPaymentAlerts ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
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
        <div className="mb-4 grid gap-2 sm:max-w-md">
          <label className="text-sm font-medium" htmlFor="outstanding-search">
            Search customer
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="outstanding-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by customer name or phone"
              className="pl-8"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Recorded By</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  No loans match this search.
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => {
                const downloadKey = `${sale.customerName}-${sale.customerPhone}`

                return (
                  <TableRow key={sale._id}>
                    <TableCell>{sale.createdAtLabel}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
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
                        {sale.itemSummary}
                      </div>
                    </TableCell>
                    <TableCell>{sale.recordedBy}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(sale.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markPaid(sale._id)}
                          disabled={updatingId === sale._id}
                        >
                          <CheckCircle2 className="size-3.5" />
                          {updatingId === sale._id ? "Removing..." : "Mark Paid"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
