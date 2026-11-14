"use client"

import { useEffect, useState } from "react"
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react"
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

type WebsiteCategory = {
  id: string
  slug: string
  name: string
  description: string
  productCount: number
}

type CategoryLimits = {
  maxCategories: number
  nameLength: number
  descriptionLength: number
}

type CategoryDraft = { name: string; description: string }

const emptyDraft: CategoryDraft = { name: "", description: "" }

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === "string" ? body.error : fallback
}

async function fetchCategories() {
  const response = await fetch("/api/website-categories")
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to load website categories"))
  }
  const body: { data: { categories: WebsiteCategory[]; limits: CategoryLimits } } =
    await response.json()
  return body.data
}

/**
 * Admin manager for the public website's categories: add, rename, describe,
 * reorder and delete. Every change saves immediately. The parent mounts this
 * only while it is open, so it always starts from fresh data.
 */
export function WebsiteCategoriesDialog({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<WebsiteCategory[] | null>(null)
  const [limits, setLimits] = useState<CategoryLimits | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newCategory, setNewCategory] = useState<CategoryDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<CategoryDraft>(emptyDraft)

  useEffect(() => {
    let cancelled = false

    fetchCategories()
      .then((data) => {
        if (cancelled) return
        setCategories(data.categories)
        setLimits(data.limits)
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return
        setLoadError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load website categories"
        )
      })

    return () => {
      cancelled = true
    }
  }, [])

  /** Runs one change, then reloads the list so names, order and counts are current. */
  const run = async (request: () => Promise<Response>, fallback: string) => {
    setError(null)
    setBusy(true)
    try {
      const response = await request()
      if (!response.ok) throw new Error(await readError(response, fallback))
      const data = await fetchCategories()
      setCategories(data.categories)
      setLimits(data.limits)
      return true
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : fallback)
      return false
    } finally {
      setBusy(false)
    }
  }

  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const addCategory = async () => {
    const name = newCategory.name.trim()
    if (!name) {
      setError("Enter a category name.")
      return
    }
    const added = await run(
      () =>
        fetch(
          "/api/website-categories",
          json("POST", { name, description: newCategory.description.trim() })
        ),
      "Failed to add the category"
    )
    if (added) setNewCategory(emptyDraft)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const name = editDraft.name.trim()
    if (!name) {
      setError("Enter a category name.")
      return
    }
    const saved = await run(
      () =>
        fetch(
          `/api/website-categories/${editingId}`,
          json("PUT", { name, description: editDraft.description.trim() })
        ),
      "Failed to save the category"
    )
    if (saved) setEditingId(null)
  }

  const moveCategory = async (index: number, offset: number) => {
    if (!categories) return
    const target = index + offset
    if (target < 0 || target >= categories.length) return
    const reordered = [...categories]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    await run(
      () =>
        fetch(
          "/api/website-categories",
          json("PUT", { ids: reordered.map((category) => category.id) })
        ),
      "Failed to save the category order"
    )
  }

  const deleteCategory = async (category: WebsiteCategory) => {
    const affected =
      category.productCount === 0
        ? "No products use it."
        : category.productCount === 1
          ? "1 product will stay on the website without a category."
          : `${category.productCount} products will stay on the website without a category.`
    if (!window.confirm(`Delete "${category.name}"? ${affected}`)) return

    await run(
      () => fetch(`/api/website-categories/${category.id}`, { method: "DELETE" }),
      "Failed to delete the category"
    )
  }

  const atLimit = Boolean(
    categories && limits && categories.length >= limits.maxCategories
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Website categories</DialogTitle>
          <DialogDescription>
            The categories customers browse on the public website, in this order.
            Changes save immediately and reach the website within about five minutes.
          </DialogDescription>
        </DialogHeader>

        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
        {!categories && !loadError ? (
          <p className="text-sm text-muted-foreground">Loading website categories...</p>
        ) : null}

        {categories && limits ? (
          <div className="grid gap-5">
            <ul className="grid gap-2">
              {categories.map((category, index) => (
                <li
                  key={category.id}
                  className="rounded-xl border border-border/80 p-2.5"
                >
                  {editingId === category.id ? (
                    <div className="grid gap-2">
                      <label className="grid gap-1 text-sm">
                        Name
                        <Input
                          value={editDraft.name}
                          maxLength={limits.nameLength}
                          onChange={(event) =>
                            setEditDraft((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        Description (optional)
                        <Input
                          value={editDraft.description}
                          maxLength={limits.descriptionLength}
                          onChange={(event) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" disabled={busy} onClick={saveEdit}>
                          {busy ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium wrap-break-word">
                            {category.name}
                          </span>
                          <span className="shrink-0 whitespace-nowrap rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {category.productCount}{" "}
                            {category.productCount === 1 ? "product" : "products"}
                          </span>
                        </div>
                        {category.description ? (
                          <p className="text-xs text-muted-foreground wrap-break-word">
                            {category.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Move ${category.name} up`}
                          disabled={index === 0 || busy}
                          onClick={() => moveCategory(index, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Move ${category.name} down`}
                          disabled={index === categories.length - 1 || busy}
                          onClick={() => moveCategory(index, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${category.name}`}
                          disabled={busy}
                          onClick={() => {
                            setError(null)
                            setEditingId(category.id)
                            setEditDraft({
                              name: category.name,
                              description: category.description,
                            })
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete ${category.name}`}
                          disabled={busy || categories.length === 1}
                          onClick={() => deleteCategory(category)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <section className="grid gap-2 rounded-xl border border-border/80 bg-muted/40 p-3">
              <div>
                <h3 className="text-sm font-medium">Add a category</h3>
                <p className="text-xs text-muted-foreground">
                  {atLimit
                    ? `The website can have up to ${limits.maxCategories} categories.`
                    : "A new category shows on the website once a product is put in it."}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                <label className="grid gap-1 text-sm">
                  Name
                  <Input
                    value={newCategory.name}
                    maxLength={limits.nameLength}
                    placeholder="e.g. Solar"
                    disabled={atLimit}
                    onChange={(event) =>
                      setNewCategory((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Description (optional)
                  <Input
                    value={newCategory.description}
                    maxLength={limits.descriptionLength}
                    placeholder="One line shown under the name"
                    disabled={atLimit}
                    onChange={(event) =>
                      setNewCategory((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <Button disabled={busy || atLimit} onClick={addCategory}>
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
            </section>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
