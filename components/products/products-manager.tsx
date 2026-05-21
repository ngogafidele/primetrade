"use client"

import { useEffect, useMemo, useState } from "react"
import { formatCurrency } from "@/lib/utils/format"
import { FileText, PackagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatInKigali, formatKigaliDateInput } from "@/lib/utils/time"

type ProductClient = {
  _id: string
  name: string
  sku: string
  unit: string
  quantity: number
  lowStockThreshold: number
  costPrice: number
  price: number
  supplierName?: string
  lastRestockAt?: string
  createdAt?: string
  updatedAt?: string
}

export type ProductsManagerProps = {
  initialProducts: ProductClient[]
  isAdmin: boolean
}

type FormState = {
  name: string
  sku: string
  unit: string
  quantity: string
  lowStockThreshold: string
  costPrice: string
  price: string
  supplierName: string
  suppliedAt: string
}

type SupplyFormState = {
  quantity: string
  unitCost: string
  supplierName: string
  suppliedAt: string
  notes: string
}

function createEmptyForm(): FormState {
  return {
    name: "",
    sku: "",
    unit: "",
    quantity: "",
    lowStockThreshold: "",
    costPrice: "",
    price: "",
    supplierName: "",
    suppliedAt: formatKigaliDateInput(new Date()),
  }
}

function createEmptySupplyForm(product?: ProductClient | null): SupplyFormState {
  return {
    quantity: "",
    unitCost: product ? String(product.costPrice ?? 0) : "",
    supplierName: "",
    suppliedAt: formatKigaliDateInput(new Date()),
    notes: "",
  }
}

const PRODUCTS_PER_PAGE = 20

function formatProductDate(value: string | undefined) {
  if (!value) return "-"

  return formatInKigali(value, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}

export function ProductsManager({
  initialProducts,
  isAdmin,
}: ProductsManagerProps) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState("")
  const [formState, setFormState] = useState<FormState>(() => createEmptyForm())
  const [supplyForm, setSupplyForm] = useState<SupplyFormState>(() =>
    createEmptySupplyForm()
  )
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [activeSupplyProduct, setActiveSupplyProduct] =
    useState<ProductClient | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [supplySubmitting, setSupplySubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supplyError, setSupplyError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const costValue = Number(formState.costPrice)
  const priceValue = Number(formState.price)
  const showPriceWarning =
    formState.costPrice.trim() !== "" &&
    formState.price.trim() !== "" &&
    Number.isFinite(costValue) &&
    Number.isFinite(priceValue) &&
    priceValue < costValue

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products

    return products.filter((product) =>
      product.name.toLowerCase().includes(query)
    )
  }, [products, search])

  const pageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  )
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE
  const paginatedProducts = filteredProducts.slice(
    pageStart,
    pageStart + PRODUCTS_PER_PAGE
  )
  const visibleStart = filteredProducts.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(
    pageStart + PRODUCTS_PER_PAGE,
    filteredProducts.length
  )

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, pageCount])

  const resetForm = () => {
    setFormState(createEmptyForm())
    setActiveProductId(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (product: ProductClient) => {
    setFormState({
      name: product.name,
      sku: product.sku,
      unit: product.unit ?? "pcs",
      quantity: String(product.quantity ?? 0),
      lowStockThreshold: String(product.lowStockThreshold ?? 0),
      costPrice: String(product.costPrice ?? 0),
      price: String(product.price ?? 0),
      supplierName: "",
      suppliedAt: formatKigaliDateInput(new Date()),
    })
    setActiveProductId(product._id)
    setError(null)
    setDialogOpen(true)
  }

  const openSupplyDialog = (product: ProductClient) => {
    setActiveSupplyProduct(product)
    setSupplyForm(createEmptySupplyForm(product))
    setSupplyError(null)
    setSupplyDialogOpen(true)
  }

  const submitForm = async () => {
    const trimmedName = formState.name.trim()
    const trimmedUnit = formState.unit.trim()

    if (!trimmedName || !trimmedUnit) {
      setError("Please fill all required fields.")
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      name: trimmedName,
      unit: trimmedUnit,
      quantity: Number(formState.quantity || 0),
      lowStockThreshold: Number(formState.lowStockThreshold || 0),
      costPrice: Number(formState.costPrice || 0),
      price: Number(formState.price || 0),
      ...(activeProductId
        ? {}
        : {
            supplierName: formState.supplierName.trim() || undefined,
            suppliedAt: formState.suppliedAt || undefined,
          }),
    }

    try {
      const response = await fetch(
        activeProductId ? `/api/products/${activeProductId}` : "/api/products",
        {
          method: activeProductId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save product.")
        return
      }

      const updated = body.data as ProductClient

      setProducts((current) => {
        if (activeProductId) {
          return current.map((item) =>
            item._id === activeProductId ? updated : item
          )
        }
        return [updated, ...current]
      })
      setCurrentPage(1)

      setDialogOpen(false)
      resetForm()
    } catch (err) {
      setError("Failed to save product.")
    } finally {
      setSubmitting(false)
    }
  }

  const submitSupply = async () => {
    if (!activeSupplyProduct) return

    const quantity = Number(supplyForm.quantity || 0)
    const unitCost = Number(supplyForm.unitCost || 0)

    if (!Number.isInteger(quantity) || quantity < 1) {
      setSupplyError("Quantity must be at least 1.")
      return
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setSupplyError("Unit cost must be 0 or more.")
      return
    }
    if (!supplyForm.supplierName.trim()) {
      setSupplyError("Supplier is required.")
      return
    }

    setSupplySubmitting(true)
    setSupplyError(null)

    try {
      const response = await fetch("/api/product-supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: activeSupplyProduct._id,
          quantity,
          unitCost,
          supplierName: supplyForm.supplierName.trim(),
          suppliedAt: supplyForm.suppliedAt || undefined,
          notes: supplyForm.notes.trim() || undefined,
        }),
      })

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setSupplyError(body?.error ?? "Failed to receive stock.")
        return
      }

      const updatedProduct = body.data.product as ProductClient

      setProducts((current) =>
        current.map((product) =>
          product._id === updatedProduct._id ? updatedProduct : product
        )
      )
      setSupplyDialogOpen(false)
      setActiveSupplyProduct(null)
      setSupplyForm(createEmptySupplyForm())
    } catch {
      setSupplyError("Failed to receive stock.")
    } finally {
      setSupplySubmitting(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Delete this product?")) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      })
      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete product.")
        return
      }

      setProducts((current) =>
        current.filter((product) => product._id !== productId)
      )
    } catch (err) {
      setError("Failed to delete product.")
    } finally {
      setSubmitting(false)
    }
  }

  const produceCatalogPdf = async () => {
    setError(null)

    try {
      const response = await fetch("/api/products/catalog/pdf")
      if (!response.ok) {
        setError("Failed to download catalog PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "products-catalog.pdf"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download catalog PDF.")
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Catalog
          </p>
          <h2 className="text-2xl font-semibold">Products</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={produceCatalogPdf}>
            <FileText className="size-4" />
            Catalog PDF
          </Button>
          {isAdmin ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>Add Product</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {activeProductId ? "Edit product" : "Add product"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm">
                    Name
                    <Input
                      value={formState.name}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Unit
                    <Input
                      placeholder="pcs, kg, l, box"
                      value={formState.unit}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          unit: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Quantity
                      <Input
                        type="number"
                        min={0}
                        placeholder="e.g. 120"
                        value={formState.quantity}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            quantity: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Low Stock Threshold (optional)
                      <Input
                        type="number"
                        min={0}
                        placeholder="Defaults to 0"
                        value={formState.lowStockThreshold}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            lowStockThreshold: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Cost Price
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g. 850"
                        value={formState.costPrice}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            costPrice: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  {!activeProductId ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        Supplier
                        <Input
                          placeholder="Supplier name"
                          value={formState.supplierName}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              supplierName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        Supplied Date
                        <Input
                          type="date"
                          value={formState.suppliedAt}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              suppliedAt: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Selling Price
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g. 1000"
                        value={formState.price}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            price: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  {showPriceWarning ? (
                    <p className="text-sm text-amber-600">
                      Warning: selling price is lower than the cost price.
                    </p>
                  ) : null}
                  {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={submitForm} disabled={submitting}>
                    {submitting
                      ? "Saving..."
                      : activeProductId
                      ? "Save changes"
                      : "Create product"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
          {isAdmin ? (
            <Dialog
              open={supplyDialogOpen}
              onOpenChange={(open) => {
                setSupplyDialogOpen(open)
                if (!open) {
                  setActiveSupplyProduct(null)
                  setSupplyError(null)
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Receive stock</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  {activeSupplyProduct ? (
                    <p className="text-sm text-muted-foreground">
                      {activeSupplyProduct.name} - current stock{" "}
                      {activeSupplyProduct.quantity} {activeSupplyProduct.unit}
                    </p>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Quantity
                      <Input
                        type="number"
                        min={1}
                        step="1"
                        value={supplyForm.quantity}
                        onChange={(event) =>
                          setSupplyForm((prev) => ({
                            ...prev,
                            quantity: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Unit Cost
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={supplyForm.unitCost}
                        onChange={(event) =>
                          setSupplyForm((prev) => ({
                            ...prev,
                            unitCost: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      Supplier
                      <Input
                        value={supplyForm.supplierName}
                        onChange={(event) =>
                          setSupplyForm((prev) => ({
                            ...prev,
                            supplierName: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Supplied Date
                      <Input
                        type="date"
                        value={supplyForm.suppliedAt}
                        onChange={(event) =>
                          setSupplyForm((prev) => ({
                            ...prev,
                            suppliedAt: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-sm">
                    Notes
                    <Input
                      placeholder="Optional"
                      value={supplyForm.notes}
                      onChange={(event) =>
                        setSupplyForm((prev) => ({
                          ...prev,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {supplyError ? (
                    <p className="text-sm text-destructive">{supplyError}</p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSupplyDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={submitSupply} disabled={supplySubmitting}>
                    {supplySubmitting ? "Saving..." : "Receive stock"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-2 sm:max-w-md">
        <label className="text-sm font-medium" htmlFor="product-search">
          Search products
        </label>
        <Input
          id="product-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product name"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Recorded</TableHead>
            <TableHead>Last Restock</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Low Stock Threshold</TableHead>
            <TableHead>Cost Price</TableHead>
            <TableHead>Selling Price</TableHead>
            {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedProducts.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 11 : 10}
                className="text-muted-foreground"
              >
                No products found.
              </TableCell>
            </TableRow>
          ) : (
            paginatedProducts.map((product) => (
              <TableRow key={product._id.toString()}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.sku}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{product.quantity}</span>
                    {product.quantity <= (product.lowStockThreshold ?? 0) ? (
                      <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Low
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{product.unit ?? "pcs"}</TableCell>
                <TableCell>{formatProductDate(product.createdAt)}</TableCell>
                <TableCell>{formatProductDate(product.lastRestockAt)}</TableCell>
                <TableCell>{product.supplierName || "-"}</TableCell>
                <TableCell>{product.lowStockThreshold ?? 0}</TableCell>
                <TableCell>{formatCurrency(product.costPrice ?? 0)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{formatCurrency(product.price)}</span>
                    {product.price < (product.costPrice ?? 0) ? (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Below cost
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                {isAdmin ? (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSupplyDialog(product)}
                      >
                        <PackagePlus className="size-3.5" />
                        Receive
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(product)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(product._id)}
                        disabled={submitting}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-3 border-t border-border/80 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {visibleStart}-{visibleEnd} of {filteredProducts.length} products
          {search.trim()
            ? ` (filtered from ${products.length})`
            : ""}
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
    </div>
  )
}
