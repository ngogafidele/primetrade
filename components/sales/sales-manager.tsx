"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ProductSearchSelect } from "@/components/products/product-search-select"
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

type ProductOption = {
  _id: string
  name: string
  sku: string
  unit: string
  price: number
  quantity: number
}

type SaleItemClient = {
  productId: string
  name?: string
  sku?: string
  unit?: string
  quantity: number
  basePrice?: number
  sellingPrice: number
  lineTotal: number
}

type SaleClient = {
  _id: string
  items: SaleItemClient[]
  totalAmount: number
  paymentStatus: "paid" | "unpaid"
  paymentMethod?: "cash" | "mobile-money" | "bank"
  notes: string
  outstanding?: OutstandingDetails
  createdByName?: string
  createdAtLabel?: string
  createdAt?: string
}

type InvoiceStatus = "paid" | "unpaid"

type OutstandingDetails = {
  customerName: string
  customerPhone: string
  paymentDate: string
}

type DraftItem = {
  productId: string
  quantity: string
  sellingPrice: string
}

const emptyDraft: DraftItem = {
  productId: "",
  quantity: "",
  sellingPrice: "",
}

const SALES_PER_PAGE = 20
const defaultInvoiceForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  status: "unpaid" as InvoiceStatus,
}
const defaultOutstandingForm: OutstandingDetails = {
  customerName: "",
  customerPhone: "",
  paymentDate: "",
}

export function SalesManager({
  initialSales,
  products,
  currentUserLabel,
}: {
  initialSales: SaleClient[]
  products: ProductOption[]
  currentUserLabel: string
}) {
  const [sales, setSales] = useState(initialSales)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyDraft])
  const [notes, setNotes] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<InvoiceStatus>("paid")
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "mobile-money" | "bank"
  >("cash")
  const [error, setError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [outstandingDialogOpen, setOutstandingDialogOpen] = useState(false)
  const [activeInvoiceSale, setActiveInvoiceSale] = useState<SaleClient | null>(null)
  const [invoiceForm, setInvoiceForm] = useState(defaultInvoiceForm)
  const [outstandingForm, setOutstandingForm] = useState(defaultOutstandingForm)
  const [outstandingError, setOutstandingError] = useState<string | null>(null)
  const [invoicedSaleIds, setInvoicedSaleIds] = useState<string[]>([])

  const productMap = useMemo(
    () => new Map(products.map((product) => [product._id, product])),
    [products]
  )

  const pageCount = Math.max(1, Math.ceil(sales.length / SALES_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * SALES_PER_PAGE
  const paginatedSales = sales.slice(pageStart, pageStart + SALES_PER_PAGE)
  const visibleStart = sales.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(pageStart + SALES_PER_PAGE, sales.length)

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  useEffect(() => {
    async function loadInvoices() {
      const response = await fetch("/api/sales-invoices")
      const body = await response.json()
      if (response.ok && body?.success) {
        const saleIds = body.data
          .map((invoice: { saleId?: string }) => invoice.saleId?.toString())
          .filter(Boolean) as string[]
        setInvoicedSaleIds(saleIds)
      }
    }

    loadInvoices().catch(() => null)
  }, [])

  const setDraftItem = (
    index: number,
    key: keyof DraftItem,
    value: string
  ) => {
    setDraftItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    )
  }

  const addDraftItem = () => {
    setDraftItems((current) => [...current, emptyDraft])
  }

  const removeDraftItem = (index: number) => {
    setDraftItems((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  const resetForm = () => {
    setDraftItems([emptyDraft])
    setNotes("")
    setPaymentStatus("paid")
    setPaymentMethod("cash")
    setError(null)
    setOutstandingForm(defaultOutstandingForm)
    setOutstandingError(null)
  }

  const openInvoiceDialog = (sale: SaleClient) => {
    setInvoiceError(null)
    setActiveInvoiceSale(sale)
    setInvoiceForm({
      ...defaultInvoiceForm,
      status: sale.paymentStatus,
    })
    setInvoiceDialogOpen(true)
  }

  const getItemLabel = (item: SaleItemClient) => {
    return item.name?.trim() || item.sku?.trim() || "Unnamed item"
  }

  const validateSaleItems = () => {
    const payloadItems = draftItems.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      sellingPrice: Number(item.sellingPrice),
    }))

    if (payloadItems.some((item) => !item.productId)) {
      setError("Select a product for each line.")
      return null
    }

    if (
      payloadItems.some(
        (item) =>
          Number.isNaN(item.quantity) ||
          item.quantity < 1 ||
          Number.isNaN(item.sellingPrice) ||
          item.sellingPrice < 0
      )
    ) {
      setError("Quantity must be at least 1 and price must be 0 or more.")
      return null
    }

    const requestedByProduct = new Map<string, number>()
    for (const item of payloadItems) {
      const current = requestedByProduct.get(item.productId) ?? 0
      requestedByProduct.set(item.productId, current + item.quantity)
    }

    for (const [productId, totalRequested] of requestedByProduct.entries()) {
      const product = productMap.get(productId)
      if (!product) {
        setError("One selected product is no longer available.")
        return null
      }
      if (totalRequested > product.quantity) {
        setError(`Insufficient stock for ${product.name}.`)
        return null
      }
    }

    return payloadItems
  }

  const recordSale = async (outstanding?: OutstandingDetails) => {
    setError(null)
    setOutstandingError(null)

    const payloadItems = validateSaleItems()
    if (!payloadItems) return

    setSubmitting(true)

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          paymentStatus,
          ...(paymentStatus === "paid" ? { paymentMethod } : {}),
          notes: notes.trim(),
          outstanding:
            paymentStatus === "unpaid" && outstanding
              ? {
                  customerName: outstanding.customerName.trim(),
                  customerPhone: outstanding.customerPhone.trim(),
                  paymentDate: outstanding.paymentDate,
                }
              : undefined,
        }),
      })

      const body = await response.json()
      if (!response.ok || !body?.success) {
        const message = body?.error ?? "Failed to record sale."
        setError(message)
        if (paymentStatus === "unpaid") {
          setOutstandingError(message)
        }
        return
      }

      const createdSale = body.data as SaleClient
      setSales((current) => [
        {
          ...createdSale,
          paymentStatus: createdSale.paymentStatus ?? paymentStatus,
          paymentMethod:
            createdSale.paymentMethod ??
            (paymentStatus === "paid" ? paymentMethod : undefined),
        },
        ...current,
      ])
      setCurrentPage(1)
      setOutstandingDialogOpen(false)
      resetForm()
    } catch {
      setError("Failed to record sale.")
      if (paymentStatus === "unpaid") {
        setOutstandingError("Failed to record sale.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const submitSale = async () => {
    setError(null)

    const payloadItems = validateSaleItems()
    if (!payloadItems) return

    if (paymentStatus === "unpaid") {
      setOutstandingError(null)
      setOutstandingDialogOpen(true)
      return
    }

    await recordSale()
  }

  const submitOutstandingSale = async () => {
    if (!outstandingForm.customerName.trim()) {
      setOutstandingError("Customer names are required.")
      return
    }

    if (!outstandingForm.customerPhone.trim()) {
      setOutstandingError("Phone number is required.")
      return
    }

    if (!outstandingForm.paymentDate) {
      setOutstandingError("Payment date is required.")
      return
    }

    await recordSale(outstandingForm)
  }

  const submitInvoice = async () => {
    if (!activeInvoiceSale) return

    if (!invoiceForm.customerName.trim()) {
      setInvoiceError("Customer name is required.")
      return
    }

    setInvoiceSubmitting(true)
    setInvoiceError(null)

    try {
      const response = await fetch("/api/sales-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: activeInvoiceSale._id,
          customerName: invoiceForm.customerName.trim(),
          customerEmail: invoiceForm.customerEmail.trim() || undefined,
          customerPhone: invoiceForm.customerPhone.trim() || undefined,
          status: invoiceForm.status,
        }),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        setInvoiceError(body?.error ?? "Failed to create invoice.")
        return
      }

      setInvoicedSaleIds((current) =>
        current.includes(activeInvoiceSale._id)
          ? current
          : [activeInvoiceSale._id, ...current]
      )
      setInvoiceDialogOpen(false)
      setActiveInvoiceSale(null)
      setInvoiceForm(defaultInvoiceForm)
    } catch {
      setInvoiceError("Failed to create invoice.")
    } finally {
      setInvoiceSubmitting(false)
    }
  }

  const paymentStatusLabel = (status: InvoiceStatus) =>
    status === "paid" ? "Paid" : "Unpaid"

  const paymentMethodLabel = (method?: "cash" | "mobile-money" | "bank") => {
    if (!method) return "-"
    if (method === "mobile-money") return "Mobile Money"
    if (method === "bank") return "Bank"
    return "Cash"
  }

  const invoicedSaleIdSet = useMemo(
    () => new Set(invoicedSaleIds),
    [invoicedSaleIds]
  )

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Transactions
        </p>
        <h2 className="text-2xl font-semibold">Sales</h2>
        <p className="text-sm text-muted-foreground">
          Logged in as: {currentUserLabel}
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-lg font-semibold">Record Sale</h3>
        <div className="space-y-3">
          {draftItems.map((item, index) => {
            const selectedProduct = item.productId
              ? productMap.get(item.productId)
              : null
            return (
              <div
                key={`${index}-${item.productId}`}
                className="grid gap-3 rounded-lg border border-border/80 p-3 md:grid-cols-[1.6fr_0.8fr_1fr_auto]"
              >
                <label className="grid gap-1 text-sm">
                  Product
                  <ProductSearchSelect
                    products={products}
                    value={item.productId}
                    onValueChange={(value) => {
                      const product = productMap.get(value)
                      setDraftItem(index, "productId", value)
                      if (product) {
                        setDraftItem(index, "sellingPrice", String(product.price))
                      }
                    }}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  Quantity
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 3"
                    value={item.quantity}
                    onChange={(event) =>
                      setDraftItem(index, "quantity", event.target.value)
                    }
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  Selling Price
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 1200"
                    value={item.sellingPrice}
                    onChange={(event) =>
                      setDraftItem(index, "sellingPrice", event.target.value)
                    }
                  />
                </label>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => removeDraftItem(index)}
                    disabled={draftItems.length === 1}
                  >
                    Remove
                  </Button>
                </div>

                {selectedProduct ? (
                  <p className="md:col-span-4 text-xs text-muted-foreground">
                    Base price: {formatCurrency(selectedProduct.price)} | Available: {selectedProduct.quantity} {selectedProduct.unit}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addDraftItem}>
            Add Item
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <label className="grid gap-1 text-sm">
            Payment Status
            <Select
              value={paymentStatus}
              onValueChange={(value) => setPaymentStatus(value as InvoiceStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </label>

          {paymentStatus === "paid" ? (
            <label className="grid gap-1 text-sm">
              Payment Method
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as "cash" | "mobile-money" | "bank")
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
          ) : null}
        </div>

        <label className="grid gap-1 text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 rounded-md border border-border px-3 py-2"
            placeholder="Any note for this sale"
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button onClick={submitSale} disabled={submitting || products.length === 0}>
          {submitting ? "Recording..." : "Record Sale"}
        </Button>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Items Sold</TableHead>
            <TableHead>Quantity Sold</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Sold Price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Logged By</TableHead>
            <TableHead className="text-right">Invoice</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground">
                No sales recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            paginatedSales.map((sale) => {
              const items = sale.items.length
                ? sale.items
                : [
                    {
                      productId: `${sale._id}-empty`,
                      quantity: 0,
                      sellingPrice: 0,
                      lineTotal: 0,
                    },
                  ]
              const rowSpan = items.length

              return (
                <Fragment key={sale._id}>
                  {items.map((item, itemIndex) => (
                    <TableRow key={`${sale._id}-${item.productId}-${itemIndex}`}>
                      {itemIndex === 0 ? (
                        <TableCell rowSpan={rowSpan}>
                          {sale.createdAtLabel ?? "-"}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="whitespace-normal wrap-break-word">
                          <p className="font-medium">{getItemLabel(item)}</p>
                          {item.sku ? (
                            <p className="text-xs text-muted-foreground">
                              {item.sku}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.unit ?? "pcs"}
                      </TableCell>
                      <TableCell>{formatCurrency(item.basePrice ?? 0)}</TableCell>
                      <TableCell>{formatCurrency(item.sellingPrice)}</TableCell>
                      {itemIndex === 0 ? (
                        <>
                          <TableCell rowSpan={rowSpan}>
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            {paymentStatusLabel(sale.paymentStatus)}
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            {paymentMethodLabel(sale.paymentMethod)}
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            {sale.createdByName ?? "Unknown User"}
                          </TableCell>
                          <TableCell rowSpan={rowSpan} className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInvoiceDialog(sale)}
                              disabled={invoicedSaleIdSet.has(sale._id)}
                            >
                              {invoicedSaleIdSet.has(sale._id)
                                ? "Invoiced"
                                : "Create Invoice"}
                            </Button>
                          </TableCell>
                        </>
                      ) : null}
                    </TableRow>
                  ))}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-3 border-t border-border/80 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {visibleStart}-{visibleEnd} of {sales.length} sales
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safeCurrentPage === 1}
          >
            Previous
          </Button>
          <span className="min-w-20 text-center">
            Page {safeCurrentPage} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((page) => Math.min(pageCount, page + 1))
            }
            disabled={safeCurrentPage === pageCount}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog
        open={outstandingDialogOpen}
        onOpenChange={(open) => {
          setOutstandingDialogOpen(open)
          if (!open) {
            setOutstandingError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Outstanding Details</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Unpaid Sale
            </p>
            <p className="mt-1 text-muted-foreground">
              Add customer details and the expected payment date before
              recording this sale.
            </p>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Customer Names
              <Input
                value={outstandingForm.customerName}
                onChange={(event) =>
                  setOutstandingForm((current) => ({
                    ...current,
                    customerName: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-1 text-sm">
              Phone Number
              <Input
                value={outstandingForm.customerPhone}
                onChange={(event) =>
                  setOutstandingForm((current) => ({
                    ...current,
                    customerPhone: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-1 text-sm">
              Payment Date
              <Input
                type="date"
                value={outstandingForm.paymentDate}
                onChange={(event) =>
                  setOutstandingForm((current) => ({
                    ...current,
                    paymentDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          {outstandingError ? (
            <p className="text-sm text-destructive">{outstandingError}</p>
          ) : null}

          <DialogFooter showCloseButton>
            <Button onClick={submitOutstandingSale} disabled={submitting}>
              {submitting ? "Recording..." : "Record Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          setInvoiceDialogOpen(open)
          if (!open) {
            setInvoiceError(null)
            setActiveInvoiceSale(null)
            setInvoiceForm(defaultInvoiceForm)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>

          {activeInvoiceSale ? (
            <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-sm">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Sale Summary
              </p>
              <p className="mt-1 font-semibold">
                Total: {formatCurrency(activeInvoiceSale.totalAmount)}
              </p>
              <p className="text-xs text-muted-foreground">
                Payment: {paymentStatusLabel(activeInvoiceSale.paymentStatus)} • {paymentMethodLabel(activeInvoiceSale.paymentMethod)}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Customer Name
              <Input
                value={invoiceForm.customerName}
                onChange={(event) =>
                  setInvoiceForm((current) => ({
                    ...current,
                    customerName: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-1 text-sm">
              Customer Email (optional)
              <Input
                type="email"
                value={invoiceForm.customerEmail}
                onChange={(event) =>
                  setInvoiceForm((current) => ({
                    ...current,
                    customerEmail: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-1 text-sm">
              Customer Phone (optional)
              <Input
                value={invoiceForm.customerPhone}
                onChange={(event) =>
                  setInvoiceForm((current) => ({
                    ...current,
                    customerPhone: event.target.value,
                  }))
                }
              />
            </label>

            <label className="grid gap-1 text-sm">
              Invoice Status
              <Select
                value={invoiceForm.status}
                onValueChange={(value) =>
                  setInvoiceForm((current) => ({
                    ...current,
                    status: value as InvoiceStatus,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          {invoiceError ? (
            <p className="text-sm text-destructive">{invoiceError}</p>
          ) : null}

          <DialogFooter>
            <Button
              onClick={submitInvoice}
              disabled={invoiceSubmitting || !activeInvoiceSale}
            >
              {invoiceSubmitting ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
