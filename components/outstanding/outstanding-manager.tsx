"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Download, Search } from "lucide-react"
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
  itemSummary: string
  recordedBy: string
  totalAmount: number
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
        setError(body?.error ?? "Failed to remove outstanding record.")
        return
      }

      setSales((current) => current.filter((sale) => sale._id !== saleId))
    } catch {
      setError("Failed to remove outstanding record.")
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
      const response = await fetch(`/api/outstanding/pdf?${params.toString()}`)

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download outstanding PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `outstanding-${sale.customerName
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "customer"}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download outstanding PDF.")
    } finally {
      setDownloadingKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Matching Outstanding Sales</p>
          <p className="mt-1 text-2xl font-semibold">{filteredSales.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Matching Amount</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
      </section>

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
                  No outstanding sales match this search.
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
                    <TableCell>{sale.paymentDateLabel}</TableCell>
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
