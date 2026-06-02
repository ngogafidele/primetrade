"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import {
  formatInKigali,
  formatKigaliDateInput,
  parseKigaliDateInput,
} from "@/lib/utils/time"
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
  approvalStatus?: "pending" | "approved"
  paymentStatus: "paid" | "unpaid"
  paymentMethod?: "cash" | "mobile-money" | "bank"
  notes: string
  customer?: {
    customerName?: string
    customerPhone?: string
  }
  outstanding?: OutstandingDetails
  saleDate?: string
  saleDateLabel?: string
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
  canApproveSales,
}: {
  initialSales: SaleClient[]
  products: ProductOption[]
  currentUserLabel: string
  canApproveSales: boolean
}) {
  const [sales, setSales] = useState(initialSales)
  const [productOptions, setProductOptions] = useState(products)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyDraft])
  const [saleDate, setSaleDate] = useState(() =>
    formatKigaliDateInput(new Date())
  )
  const [notes, setNotes] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<InvoiceStatus>("paid")
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "mobile-money" | "bank"
  >("cash")
  const [error, setError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [outstandingDialogOpen, setOutstandingDialogOpen] = useState(false)
  const [activeInvoiceSale, setActiveInvoiceSale] = useState<SaleClient | null>(null)
  const [activeEditSale, setActiveEditSale] = useState<SaleClient | null>(null)
  const [invoiceForm, setInvoiceForm] = useState(defaultInvoiceForm)
  const [editDraftItems, setEditDraftItems] = useState<DraftItem[]>([emptyDraft])
  const [editSaleDate, setEditSaleDate] = useState("")
  const [editPaymentStatus, setEditPaymentStatus] =
    useState<InvoiceStatus>("paid")
  const [editPaymentMethod, setEditPaymentMethod] = useState<
    "cash" | "mobile-money" | "bank"
  >("cash")
  const [editNotes, setEditNotes] = useState("")
  const [editCustomerName, setEditCustomerName] = useState("")
  const [editCustomerPhone, setEditCustomerPhone] = useState("")
  const [outstandingForm, setOutstandingForm] = useState(defaultOutstandingForm)
  const [editOutstandingForm, setEditOutstandingForm] = useState(
    defaultOutstandingForm
  )
  const [outstandingError, setOutstandingError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [invoicedSaleIds, setInvoicedSaleIds] = useState<string[]>([])
  const [saleSearch, setSaleSearch] = useState("")

  const draftTotal = useMemo(() => {
    return draftItems.reduce((sum, item) => {
      const quantity = Number(item.quantity)
      const price = Number(item.sellingPrice)
      if (Number.isNaN(quantity) || Number.isNaN(price)) return sum
      return sum + quantity * price
    }, 0)
  }, [draftItems])

  const editTotal = useMemo(() => {
    return editDraftItems.reduce((sum, item) => {
      const quantity = Number(item.quantity)
      const price = Number(item.sellingPrice)
      if (Number.isNaN(quantity) || Number.isNaN(price)) return sum
      return sum + quantity * price
    }, 0)
  }, [editDraftItems])

  const productMap = useMemo(
    () => new Map(productOptions.map((product) => [product._id, product])),
    [productOptions]
  )

  const filteredSales = useMemo(() => {
    const search = saleSearch.trim().toLowerCase()
    if (!search) return sales

    return sales.filter((sale) => {
      const customerName =
        sale.paymentStatus === "unpaid"
          ? sale.outstanding?.customerName
          : sale.customer?.customerName
      const customerPhone =
        sale.paymentStatus === "unpaid"
          ? sale.outstanding?.customerPhone
          : sale.customer?.customerPhone

      return `${customerName ?? ""} ${customerPhone ?? ""}`
        .toLowerCase()
        .includes(search)
    })
  }, [saleSearch, sales])

  const pageCount = Math.max(1, Math.ceil(filteredSales.length / SALES_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * SALES_PER_PAGE
  const paginatedSales = filteredSales.slice(
    pageStart,
    pageStart + SALES_PER_PAGE
  )
  const visibleStart = filteredSales.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(pageStart + SALES_PER_PAGE, filteredSales.length)

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  useEffect(() => {
    setCurrentPage(1)
  }, [saleSearch])

  useEffect(() => {
    setProductOptions(products)
  }, [products])

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

  const setEditDraftItem = (
    index: number,
    key: keyof DraftItem,
    value: string
  ) => {
    setEditDraftItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    )
  }

  const addEditDraftItem = () => {
    setEditDraftItems((current) => [...current, emptyDraft])
  }

  const removeEditDraftItem = (index: number) => {
    setEditDraftItems((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  const resetForm = () => {
    setDraftItems([emptyDraft])
    setSaleDate(formatKigaliDateInput(new Date()))
    setNotes("")
    setCustomerName("")
    setCustomerPhone("")
    setPaymentStatus("paid")
    setPaymentMethod("cash")
    setError(null)
    setOutstandingForm(defaultOutstandingForm)
    setOutstandingError(null)
  }

  const openInvoiceDialog = (sale: SaleClient) => {
    if ((sale.approvalStatus ?? "approved") === "pending") {
      setError("Approve this sale before creating an invoice.")
      return
    }

    setInvoiceError(null)
    setActiveInvoiceSale(sale)
    setInvoiceForm({
      ...defaultInvoiceForm,
      customerName:
        sale.paymentStatus === "unpaid"
          ? sale.outstanding?.customerName ?? ""
          : sale.customer?.customerName ?? "",
      customerPhone:
        sale.paymentStatus === "unpaid"
          ? sale.outstanding?.customerPhone ?? ""
          : sale.customer?.customerPhone ?? "",
      status: sale.paymentStatus,
    })
    setInvoiceDialogOpen(true)
  }

  const toDateInputValue = (value?: string) => {
    if (!value) return ""
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""

    return formatKigaliDateInput(date)
  }

  const openEditDialog = (sale: SaleClient) => {
    setEditError(null)
    setActiveEditSale(sale)
    setEditDraftItems(
      sale.items.length
        ? sale.items.map((item) => ({
            productId: item.productId,
            quantity: String(item.quantity),
            sellingPrice: String(item.sellingPrice),
          }))
        : [emptyDraft]
    )
    setEditPaymentStatus(sale.paymentStatus)
    setEditPaymentMethod(sale.paymentMethod ?? "cash")
    setEditSaleDate(toDateInputValue(sale.saleDate ?? sale.createdAt))
    setEditNotes(sale.notes ?? "")
    setEditCustomerName(
      sale.customer?.customerName ?? sale.outstanding?.customerName ?? ""
    )
    setEditCustomerPhone(
      sale.customer?.customerPhone ?? sale.outstanding?.customerPhone ?? ""
    )
    setEditOutstandingForm({
      customerName:
        sale.outstanding?.customerName ?? sale.customer?.customerName ?? "",
      customerPhone:
        sale.outstanding?.customerPhone ?? sale.customer?.customerPhone ?? "",
      paymentDate: toDateInputValue(sale.outstanding?.paymentDate),
    })
    setEditDialogOpen(true)
  }

  const getItemLabel = (item: SaleItemClient) => {
    return item.name?.trim() || item.sku?.trim() || "Unnamed item"
  }

  const getSaleQuantityMap = (sale: SaleClient | null) => {
    const quantities = new Map<string, number>()
    sale?.items.forEach((item) => {
      const current = quantities.get(item.productId) ?? 0
      quantities.set(item.productId, current + item.quantity)
    })
    return quantities
  }

  const formatSaleDateLabel = (value?: string) => {
    if (!value) return "-"
    const date = parseKigaliDateInput(value) ?? new Date(value)
    if (Number.isNaN(date.getTime())) return "-"

    return formatInKigali(date, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
  }

  const validateSaleDate = (
    value: string,
    setMessage: (message: string) => void
  ) => {
    const parsedDate = parseKigaliDateInput(value)
    if (!parsedDate) {
      setMessage("Sale date is required.")
      return null
    }

    return value
  }

  const getSaleSortTime = (sale: SaleClient) => {
    const value = sale.saleDate ?? sale.createdAt
    if (!value) return 0
    const date = parseKigaliDateInput(value) ?? new Date(value)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
  }

  const sortSalesBySaleDate = (items: SaleClient[]) =>
    [...items].sort((a, b) => getSaleSortTime(b) - getSaleSortTime(a))

  const validateDraftItems = (
    items: DraftItem[],
    setMessage: (message: string) => void,
    existingSale: SaleClient | null = null
  ) => {
    const payloadItems = items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      sellingPrice: Number(item.sellingPrice),
    }))

    if (payloadItems.some((item) => !item.productId)) {
      setMessage("Select a product for each line.")
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
      setMessage("Quantity must be at least 1 and price must be 0 or more.")
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
        setMessage("One selected product is no longer available.")
        return null
      }
      const existingQuantities = getSaleQuantityMap(existingSale)
      const reusableQuantity =
        (existingSale?.approvalStatus ?? "approved") === "approved"
          ? existingQuantities.get(productId) ?? 0
          : 0
      if (totalRequested > product.quantity + reusableQuantity) {
        setMessage(`Insufficient stock for ${product.name}.`)
        return null
      }
    }

    return payloadItems
  }

  const validateSaleItems = () => {
    return validateDraftItems(draftItems, setError)
  }

  const recordSale = async (outstanding?: OutstandingDetails) => {
    setError(null)
    setOutstandingError(null)

    const payloadItems = validateSaleItems()
    if (!payloadItems) return
    const payloadSaleDate = validateSaleDate(saleDate, setError)
    if (!payloadSaleDate) return

    setSubmitting(true)

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          saleDate: payloadSaleDate,
          paymentStatus,
          ...(paymentStatus === "paid" ? { paymentMethod } : {}),
          customer:
            paymentStatus === "paid" &&
            (customerName.trim() || customerPhone.trim())
              ? {
                  customerName: customerName.trim(),
                  customerPhone: customerPhone.trim(),
                }
              : undefined,
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
      setSales((current) =>
        sortSalesBySaleDate([
          {
            ...createdSale,
            saleDate: createdSale.saleDate ?? payloadSaleDate,
            saleDateLabel:
              createdSale.saleDateLabel ??
              formatSaleDateLabel(createdSale.saleDate ?? payloadSaleDate),
            approvalStatus:
              createdSale.approvalStatus ??
              (canApproveSales ? "approved" : "pending"),
            paymentStatus: createdSale.paymentStatus ?? paymentStatus,
            paymentMethod:
              createdSale.paymentMethod ??
              (paymentStatus === "paid" ? paymentMethod : undefined),
          },
          ...current,
        ])
      )
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
    const payloadSaleDate = validateSaleDate(saleDate, setError)
    if (!payloadSaleDate) return

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

  const submitEditSale = async () => {
    if (!activeEditSale) return

    setEditError(null)
    const payloadItems = validateDraftItems(
      editDraftItems,
      setEditError,
      activeEditSale
    )
    if (!payloadItems) return
    const payloadSaleDate = validateSaleDate(editSaleDate, setEditError)
    if (!payloadSaleDate) return

    if (editPaymentStatus === "unpaid") {
      if (!editOutstandingForm.customerName.trim()) {
        setEditError("Customer names are required.")
        return
      }

      if (!editOutstandingForm.customerPhone.trim()) {
        setEditError("Phone number is required.")
        return
      }

      if (!editOutstandingForm.paymentDate) {
        setEditError("Payment date is required.")
        return
      }
    }

    setEditSubmitting(true)

    try {
      const response = await fetch(`/api/sales/${activeEditSale._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          saleDate: payloadSaleDate,
          paymentStatus: editPaymentStatus,
          ...(editPaymentStatus === "paid" ? { paymentMethod: editPaymentMethod } : {}),
          customer:
            editPaymentStatus === "paid" &&
            (editCustomerName.trim() || editCustomerPhone.trim())
              ? {
                  customerName: editCustomerName.trim(),
                  customerPhone: editCustomerPhone.trim(),
                }
              : undefined,
          notes: editNotes.trim(),
          outstanding:
            editPaymentStatus === "unpaid"
              ? {
                  customerName: editOutstandingForm.customerName.trim(),
                  customerPhone: editOutstandingForm.customerPhone.trim(),
                  paymentDate: editOutstandingForm.paymentDate,
                }
              : undefined,
        }),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        setEditError(body?.error ?? "Failed to edit sale.")
        return
      }

      const updatedSale = body.data as SaleClient
      setSales((current) =>
        sortSalesBySaleDate(
          current.map((sale) =>
            sale._id === activeEditSale._id
              ? {
                  ...sale,
                  ...updatedSale,
                  _id: sale._id,
                  saleDate: updatedSale.saleDate ?? payloadSaleDate,
                  saleDateLabel:
                    updatedSale.saleDateLabel ??
                    formatSaleDateLabel(
                      updatedSale.saleDate ?? payloadSaleDate
                    ),
                  createdByName: sale.createdByName,
                  approvalStatus:
                    updatedSale.approvalStatus ?? sale.approvalStatus,
                }
              : sale
          )
        )
      )
      setEditDialogOpen(false)
      setActiveEditSale(null)
    } catch {
      setEditError("Failed to edit sale.")
    } finally {
      setEditSubmitting(false)
    }
  }

  const paymentStatusLabel = (status: InvoiceStatus) =>
    status === "paid" ? "Paid" : "Unpaid"

  const approvalStatusLabel = (status?: "pending" | "approved") =>
    status === "pending" ? "Pending" : "Approved"

  const approveSale = async (saleId: string) => {
    setError(null)
    setApprovingId(saleId)

    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" }),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to approve sale.")
        return
      }

      setSales((current) =>
        current.map((sale) =>
          sale._id === saleId
            ? {
                ...sale,
                approvalStatus: "approved",
              }
            : sale
        )
      )
    } catch {
      setError("Failed to approve sale.")
    } finally {
      setApprovingId(null)
    }
  }

  const restoreDeletedSaleStock = (sale: SaleClient) => {
    if ((sale.approvalStatus ?? "approved") !== "approved") return

    const quantitiesByProduct = new Map<string, number>()
    sale.items.forEach((item) => {
      quantitiesByProduct.set(
        item.productId,
        (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity
      )
    })

    setProductOptions((current) =>
      current.map((product) => {
        const restoredQuantity = quantitiesByProduct.get(product._id)
        if (!restoredQuantity) return product

        return {
          ...product,
          quantity: product.quantity + restoredQuantity,
        }
      })
    )
  }

  const deleteSale = async (sale: SaleClient) => {
    const shouldDelete = window.confirm(
      "Delete this sale? Stock, reports, loans, proformas, and invoices from this sale will be reversed or removed."
    )
    if (!shouldDelete) return

    setError(null)
    setDeletingId(sale._id)

    try {
      const response = await fetch(`/api/sales/${sale._id}`, {
        method: "DELETE",
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete sale.")
        return
      }

      restoreDeletedSaleStock(sale)
      setSales((current) => current.filter((item) => item._id !== sale._id))
      setInvoicedSaleIds((current) =>
        current.filter((saleId) => saleId !== sale._id)
      )
    } catch {
      setError("Failed to delete sale.")
    } finally {
      setDeletingId(null)
    }
  }

  const paymentMethodLabel = (method?: "cash" | "mobile-money" | "bank") => {
    if (!method) return "-"
    if (method === "mobile-money") return "Mobile Money"
    if (method === "bank") return "Bank"
    return "Cash"
  }

  const customerNameLabel = (sale: SaleClient) => {
    const name =
      sale.paymentStatus === "unpaid"
        ? sale.outstanding?.customerName
        : sale.customer?.customerName

    return name || "-"
  }

  const customerPhoneLabel = (sale: SaleClient) => {
    const phone =
      sale.paymentStatus === "unpaid"
        ? sale.outstanding?.customerPhone
        : sale.customer?.customerPhone

    return phone || "-"
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
        {canApproveSales ? (
          <p className="text-sm text-muted-foreground">
            Pending sales enter stock, dashboards, reports, loans, and invoices
            only after approval.
          </p>
        ) : null}
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
                    products={productOptions}
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

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Sale Date
            <Input
              type="date"
              value={saleDate}
              onChange={(event) => setSaleDate(event.target.value)}
            />
          </label>

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

        {paymentStatus === "paid" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Customer Names (optional)
              <Input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer names"
              />
            </label>

            <label className="grid gap-1 text-sm">
              Phone Number (optional)
              <Input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Phone number"
              />
            </label>
          </div>
        ) : null}

        <label className="grid gap-1 text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-20 rounded-md border border-border px-3 py-2"
            placeholder="Any note for this sale"
          />
        </label>

        <div className="rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Total to pay
          </p>
          <p className="mt-1 text-lg font-semibold">
            {formatCurrency(draftTotal)}
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          onClick={submitSale}
          disabled={submitting || productOptions.length === 0}
        >
          {submitting ? "Recording..." : "Record Sale"}
        </Button>
      </section>

      <div className="grid gap-2 sm:max-w-md">
        <label className="grid gap-1 text-sm">
          Search Sales
          <Input
            value={saleSearch}
            onChange={(event) => setSaleSearch(event.target.value)}
            placeholder="Customer name or phone number"
          />
        </label>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sale Date</TableHead>
            <TableHead>Items Sold</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Sold Price</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Logged By</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-muted-foreground">
                {saleSearch.trim()
                  ? "No sales match that customer search."
                  : "No sales recorded yet."}
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
              const isPending = (sale.approvalStatus ?? "approved") === "pending"

              return (
                <Fragment key={sale._id}>
                  {items.map((item, itemIndex) => (
                    <TableRow key={`${sale._id}-${item.productId}-${itemIndex}`}>
                      {itemIndex === 0 ? (
                        <TableCell rowSpan={rowSpan}>
                          {sale.saleDateLabel ?? sale.createdAtLabel ?? "-"}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="whitespace-normal wrap-break-word">
                          <p className="font-medium">
                            {getItemLabel(item)} ({item.quantity}{" "}
                            {item.unit ?? "pcs"})
                          </p>
                          {item.sku ? (
                            <p className="text-xs text-muted-foreground">
                              {item.sku}
                            </p>
                          ) : null}
                        </div>
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
                            <span
                              className={
                                isPending
                                  ? "inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
                                  : "inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
                              }
                            >
                              {approvalStatusLabel(sale.approvalStatus)}
                            </span>
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            {paymentMethodLabel(sale.paymentMethod)}
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            <span className="whitespace-normal wrap-break-word">
                              {customerNameLabel(sale)}
                            </span>
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            <span className="whitespace-normal wrap-break-word">
                              {customerPhoneLabel(sale)}
                            </span>
                          </TableCell>
                          <TableCell rowSpan={rowSpan}>
                            {sale.createdByName ?? "Unknown User"}
                          </TableCell>
                          <TableCell rowSpan={rowSpan} className="text-right">
                            <div className="flex justify-end gap-2">
                              {canApproveSales && isPending ? (
                                <Button
                                  size="sm"
                                  onClick={() => approveSale(sale._id)}
                                  disabled={
                                    approvingId === sale._id ||
                                    deletingId === sale._id
                                  }
                                >
                                  {approvingId === sale._id
                                    ? "Approving..."
                                    : "Approve"}
                                </Button>
                              ) : null}
                              {canApproveSales ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDialog(sale)}
                                  disabled={
                                    deletingId === sale._id ||
                                    invoicedSaleIdSet.has(sale._id)
                                  }
                                >
                                  Edit
                                </Button>
                              ) : null}
                              {canApproveSales ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteSale(sale)}
                                  disabled={deletingId === sale._id}
                                >
                                  {deletingId === sale._id
                                    ? "Deleting..."
                                    : "Delete"}
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openInvoiceDialog(sale)}
                                disabled={
                                  deletingId === sale._id ||
                                  isPending ||
                                  invoicedSaleIdSet.has(sale._id)
                                }
                              >
                                {isPending
                                  ? "Pending"
                                  : invoicedSaleIdSet.has(sale._id)
                                    ? "Invoiced"
                                    : "Create Invoice"}
                              </Button>
                            </div>
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
          Showing {visibleStart}-{visibleEnd} of {filteredSales.length} sales
          {saleSearch.trim() ? ` matching "${saleSearch.trim()}"` : ""}
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
            <DialogTitle>Loan Details</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Loan Sale
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
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditError(null)
            setActiveEditSale(null)
            setEditDraftItems([emptyDraft])
            setEditSaleDate("")
            setEditPaymentStatus("paid")
            setEditPaymentMethod("cash")
            setEditNotes("")
            setEditCustomerName("")
            setEditCustomerPhone("")
            setEditOutstandingForm(defaultOutstandingForm)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {editDraftItems.map((item, index) => {
              const selectedProduct = item.productId
                ? productMap.get(item.productId)
                : null
              return (
                <div
                  key={`edit-${index}-${item.productId}`}
                  className="grid gap-3 rounded-lg border border-border/80 p-3 md:grid-cols-[1.6fr_0.8fr_1fr_auto]"
                >
                  <label className="grid gap-1 text-sm">
                    Product
                    <ProductSearchSelect
                      products={productOptions}
                      value={item.productId}
                      onValueChange={(value) => {
                        const product = productMap.get(value)
                        setEditDraftItem(index, "productId", value)
                        if (product) {
                          setEditDraftItem(
                            index,
                            "sellingPrice",
                            String(product.price)
                          )
                        }
                      }}
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    Quantity
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        setEditDraftItem(index, "quantity", event.target.value)
                      }
                    />
                  </label>

                  <label className="grid gap-1 text-sm">
                    Selling Price
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.sellingPrice}
                      onChange={(event) =>
                        setEditDraftItem(
                          index,
                          "sellingPrice",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => removeEditDraftItem(index)}
                      disabled={editDraftItems.length === 1}
                    >
                      Remove
                    </Button>
                  </div>

                  {selectedProduct ? (
                    <p className="md:col-span-4 text-xs text-muted-foreground">
                      Base price: {formatCurrency(selectedProduct.price)} |
                      Available: {selectedProduct.quantity}{" "}
                      {selectedProduct.unit}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>

          <Button variant="outline" onClick={addEditDraftItem}>
            Add Item
          </Button>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">
              Sale Date
              <Input
                type="date"
                value={editSaleDate}
                onChange={(event) => setEditSaleDate(event.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              Payment Status
              <Select
                value={editPaymentStatus}
                onValueChange={(value) =>
                  setEditPaymentStatus(value as InvoiceStatus)
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

            {editPaymentStatus === "paid" ? (
              <label className="grid gap-1 text-sm">
                Payment Method
                <Select
                  value={editPaymentMethod}
                  onValueChange={(value) =>
                    setEditPaymentMethod(
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
            ) : null}
          </div>

          {editPaymentStatus === "unpaid" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm">
                Customer Names
                <Input
                  value={editOutstandingForm.customerName}
                  onChange={(event) =>
                    setEditOutstandingForm((current) => ({
                      ...current,
                      customerName: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="grid gap-1 text-sm">
                Phone Number
                <Input
                  value={editOutstandingForm.customerPhone}
                  onChange={(event) =>
                    setEditOutstandingForm((current) => ({
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
                  value={editOutstandingForm.paymentDate}
                  onChange={(event) =>
                    setEditOutstandingForm((current) => ({
                      ...current,
                      paymentDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          ) : null}

          {editPaymentStatus === "paid" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Customer Names (optional)
                <Input
                  value={editCustomerName}
                  onChange={(event) =>
                    setEditCustomerName(event.target.value)
                  }
                />
              </label>

              <label className="grid gap-1 text-sm">
                Phone Number (optional)
                <Input
                  value={editCustomerPhone}
                  onChange={(event) =>
                    setEditCustomerPhone(event.target.value)
                  }
                />
              </label>
            </div>
          ) : null}

          <label className="grid gap-1 text-sm">
            Notes (optional)
            <textarea
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              className="min-h-20 rounded-md border border-border px-3 py-2"
            />
          </label>

          <div className="rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Updated total
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(editTotal)}
            </p>
          </div>

          {editError ? (
            <p className="text-sm text-destructive">{editError}</p>
          ) : null}

          <DialogFooter showCloseButton>
            <Button onClick={submitEditSale} disabled={editSubmitting}>
              {editSubmitting ? "Saving..." : "Save Changes"}
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
