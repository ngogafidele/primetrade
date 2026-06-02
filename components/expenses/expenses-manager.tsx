"use client"

import { useState } from "react"
import { CheckCircle2, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/format"
import {
  formatInKigali,
  parseKigaliDateInput,
} from "@/lib/utils/time"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const EXPENSES_PER_PAGE = 20

type ExpenseClient = {
  _id: string
  title: string
  amount: number
  category?: string
  vendor?: string
  notes?: string
  incurredAt?: string
  createdAt?: string
  createdByName?: string
  approvalStatus?: "pending" | "approved"
}

type FormState = {
  title: string
  amount: string
  category: string
  vendor: string
  notes: string
  incurredAt: string
}

const emptyForm: FormState = {
  title: "",
  amount: "",
  category: "",
  vendor: "",
  notes: "",
  incurredAt: "",
}

export function ExpensesManager({
  initialExpenses,
  currentUserLabel,
  canApproveExpenses,
}: {
  initialExpenses: ExpenseClient[]
  currentUserLabel: string
  canApproveExpenses: boolean
}) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(expenses.length / EXPENSES_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStart = (safeCurrentPage - 1) * EXPENSES_PER_PAGE
  const paginatedExpenses = expenses.slice(
    pageStart,
    pageStart + EXPENSES_PER_PAGE
  )
  const visibleStart = expenses.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(pageStart + EXPENSES_PER_PAGE, expenses.length)

  const resetForm = () => {
    setFormState(emptyForm)
    setError(null)
  }

  const setField = (key: keyof FormState, value: string) => {
    setFormState((current) => ({ ...current, [key]: value }))
  }

  const submitExpense = async () => {
    setError(null)

    const trimmedTitle = formState.title.trim()
    const amount = Number(formState.amount)

    if (!trimmedTitle) {
      setError("Please provide the expense title.")
      return
    }

    if (Number.isNaN(amount) || amount <= 0) {
      setError("Amount must be greater than 0.")
      return
    }

    const incurredDate = parseKigaliDateInput(formState.incurredAt)

    setSubmitting(true)

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          amount,
          category: formState.category.trim() || undefined,
          vendor: formState.vendor.trim() || undefined,
          notes: formState.notes.trim() || undefined,
          incurredAt: incurredDate ? incurredDate.toISOString() : undefined,
        }),
      })

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to record expense.")
        return
      }

      const created = body.data as ExpenseClient
      setExpenses((current) => [
        {
          ...created,
          approvalStatus: created.approvalStatus ?? "approved",
          createdByName: currentUserLabel,
        },
        ...current,
      ])
      setCurrentPage(1)
      resetForm()
    } catch {
      setError("Failed to record expense.")
    } finally {
      setSubmitting(false)
    }
  }

  const approveExpense = async (expense: ExpenseClient) => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/expenses/${expense._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: "approved" }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to approve expense.")
        return
      }

      setExpenses((current) =>
        current.map((item) =>
          item._id === expense._id
            ? { ...item, ...body.data, approvalStatus: "approved" }
            : item
        )
      )
    } catch {
      setError("Failed to approve expense.")
    } finally {
      setSubmitting(false)
    }
  }

  const deleteExpense = async (expense: ExpenseClient) => {
    const shouldDelete = window.confirm(
      "Delete this expense? Reports, dashboard totals, and pending approvals will no longer include it."
    )
    if (!shouldDelete) return

    setError(null)
    setDeletingId(expense._id)

    try {
      const response = await fetch(`/api/expenses/${expense._id}`, {
        method: "DELETE",
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete expense.")
        return
      }

      setExpenses((current) =>
        current.filter((item) => item._id !== expense._id)
      )
    } catch {
      setError("Failed to delete expense.")
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (value?: string) => {
    if (!value) return "-"
    return formatInKigali(value, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Finance
        </p>
        <h2 className="text-2xl font-semibold">Expenses</h2>
        <p className="text-sm text-muted-foreground">
          Logged in as: {currentUserLabel}
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-lg font-semibold">Record Expense</h3>
        <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
          <label className="grid gap-1 text-sm">
            Title
            <Input
              placeholder="Fuel, transport, utilities"
              value={formState.title}
              onChange={(event) => setField("title", event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            Amount
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 15000"
              value={formState.amount}
              onChange={(event) => setField("amount", event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            Date
            <Input
              type="date"
              value={formState.incurredAt}
              onChange={(event) => setField("incurredAt", event.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <label className="grid gap-1 text-sm">
            Category (optional)
            <Input
              placeholder="Operations, Marketing"
              value={formState.category}
              onChange={(event) => setField("category", event.target.value)}
            />
          </label>

          <label className="grid gap-1 text-sm">
            Vendor (optional)
            <Input
              placeholder="Supplier or payee"
              value={formState.vendor}
              onChange={(event) => setField("vendor", event.target.value)}
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          Notes (optional)
          <textarea
            value={formState.notes}
            onChange={(event) => setField("notes", event.target.value)}
            className="min-h-20 rounded-md border border-border px-3 py-2"
            placeholder="Add more details about the expense"
          />
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Total entries: {expenses.length}
          </span>
          <Button onClick={submitExpense} disabled={submitting}>
            {submitting ? "Recording..." : "Record Expense"}
          </Button>
        </div>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Logged By</TableHead>
            <TableHead>Status</TableHead>
            {canApproveExpenses ? (
              <TableHead className="text-right">Actions</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedExpenses.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canApproveExpenses ? 8 : 7}
                className="text-muted-foreground"
              >
                No expenses recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            paginatedExpenses.map((expense) => (
              <TableRow key={expense._id}>
                <TableCell>
                  {formatDate(expense.incurredAt ?? expense.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium">{expense.title}</p>
                    {expense.notes ? (
                      <p className="text-xs text-muted-foreground">
                        {expense.notes}
                      </p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{expense.category || "-"}</TableCell>
                <TableCell>{expense.vendor || "-"}</TableCell>
                <TableCell>{formatCurrency(expense.amount)}</TableCell>
                <TableCell>{expense.createdByName ?? "Unknown User"}</TableCell>
                <TableCell>
                  {(expense.approvalStatus ?? "approved") === "pending" ? (
                    <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      Pending approval
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                      Approved
                    </span>
                  )}
                </TableCell>
                {canApproveExpenses ? (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(expense.approvalStatus ?? "approved") === "pending" ? (
                        <Button
                          size="sm"
                          onClick={() => approveExpense(expense)}
                          disabled={submitting || deletingId === expense._id}
                        >
                          <CheckCircle2 className="size-4" />
                          Approve
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteExpense(expense)}
                        disabled={submitting || deletingId === expense._id}
                      >
                        <Trash2 className="size-4" />
                        {deletingId === expense._id ? "Deleting..." : "Delete"}
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
          Showing {visibleStart}-{visibleEnd} of {expenses.length} expenses
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
