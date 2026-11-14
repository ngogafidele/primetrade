"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react"
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

type WebsiteImage = {
  id: string
  url: string
  width: number
  height: number
  alt: string
}

type WebsiteSpec = { label: string; value: string }

type WebsiteProfile = {
  isPublished: boolean
  category: string
  brand: string
  description: string
  specs: WebsiteSpec[]
  images: WebsiteImage[]
}

type WebsiteCategory = { slug: string; name: string }

type WebsiteLimits = {
  maxImages: number
  maxBytes: number
  contentTypes: string[]
}

type WebsiteDetails = {
  profile: WebsiteProfile
  categories: WebsiteCategory[]
  limits: WebsiteLimits
  storageConfigured: boolean
}

export type ProductWebsiteDialogProps = {
  product: { _id: string; name: string; sku: string } | null
  onClose: () => void
  onPublishedChange: (productId: string, isPublished: boolean) => void
}

const MAX_IMAGE_EDGE = 1600
const fieldClass =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"

/** Shrinks a photo to at most 1600px on its long side and re-encodes it. */
async function prepareImage(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("This browser cannot process images")
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))

  // Browsers that cannot encode WebP fall back to another type; use JPEG then.
  let blob = await encode("image/webp")
  if (!blob || blob.type !== "image/webp") blob = await encode("image/jpeg")
  if (!blob) throw new Error("This image could not be processed")

  return { blob, width, height }
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null)
  return typeof body?.error === "string" ? body.error : fallback
}

export function ProductWebsiteDialog({
  product,
  onClose,
  onPublishedChange,
}: ProductWebsiteDialogProps) {
  const [details, setDetails] = useState<WebsiteDetails | null>(null)
  const [profile, setProfile] = useState<WebsiteProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const productId = product?._id ?? null

  useEffect(() => {
    if (!productId) return

    // The parent remounts this dialog per product (via key), so state starts empty.
    let cancelled = false

    fetch(`/api/products/${productId}/website`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readError(response, "Failed to load website details"))
        }
        return response.json()
      })
      .then((body: { data: WebsiteDetails }) => {
        if (cancelled) return
        setDetails(body.data)
        setProfile(body.data.profile)
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return
        setLoadError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load website details"
        )
      })

    return () => {
      cancelled = true
    }
  }, [productId])

  const updateProfile = (changes: Partial<WebsiteProfile>) =>
    setProfile((current) => (current ? { ...current, ...changes } : current))

  const busy = saving || uploading !== null || removingId !== null
  const imageCount = profile?.images.length ?? 0
  const maxImages = details?.limits.maxImages ?? 0

  const uploadFiles = async (files: FileList | null) => {
    if (!productId || !details || !profile || !files?.length) return
    setError(null)

    const room = details.limits.maxImages - profile.images.length
    const selected = Array.from(files).slice(0, Math.max(room, 0))
    if (selected.length < files.length) {
      setError(`A product can have up to ${details.limits.maxImages} images.`)
    }

    for (const [index, file] of selected.entries()) {
      setUploading(`Uploading image ${index + 1} of ${selected.length}...`)
      try {
        const { blob, width, height } = await prepareImage(file)

        const ticketResponse = await fetch(
          `/api/products/${productId}/images/upload-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentType: blob.type, size: blob.size }),
          }
        )
        if (!ticketResponse.ok) {
          throw new Error(await readError(ticketResponse, "Failed to start the upload"))
        }
        const ticket: { data: { key: string; uploadUrl: string; contentType: string } } =
          await ticketResponse.json()

        const stored = await fetch(ticket.data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": ticket.data.contentType },
          body: blob,
        })
        if (!stored.ok) throw new Error("The image could not be uploaded to storage")

        const confirmResponse = await fetch(`/api/products/${productId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: ticket.data.key, width, height, alt: "" }),
        })
        if (!confirmResponse.ok) {
          throw new Error(await readError(confirmResponse, "Failed to save the image"))
        }
        const confirmed: { data: { image: WebsiteImage } } = await confirmResponse.json()

        setProfile((current) =>
          current ? { ...current, images: [...current.images, confirmed.data.image] } : current
        )
      } catch (uploadError) {
        setError(
          `${file.name}: ${
            uploadError instanceof Error ? uploadError.message : "Upload failed"
          }`
        )
        break
      }
    }

    setUploading(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeImage = async (image: WebsiteImage) => {
    if (!productId) return
    if (!window.confirm("Remove this image? It is deleted from storage immediately.")) return

    setError(null)
    setRemovingId(image.id)
    try {
      const response = await fetch(`/api/products/${productId}/images/${image.id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error(await readError(response, "Failed to remove the image"))
      }
      setProfile((current) =>
        current
          ? { ...current, images: current.images.filter((item) => item.id !== image.id) }
          : current
      )
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "Failed to remove the image"
      )
    } finally {
      setRemovingId(null)
    }
  }

  const moveImage = (index: number, offset: number) => {
    if (!profile) return
    const target = index + offset
    if (target < 0 || target >= profile.images.length) return
    const images = [...profile.images]
    ;[images[index], images[target]] = [images[target], images[index]]
    updateProfile({ images })
  }

  const updateSpec = (index: number, changes: Partial<WebsiteSpec>) => {
    if (!profile) return
    updateProfile({
      specs: profile.specs.map((spec, specIndex) =>
        specIndex === index ? { ...spec, ...changes } : spec
      ),
    })
  }

  const save = async () => {
    if (!productId || !profile) return
    setError(null)

    const specs = profile.specs
      .map((spec) => ({ label: spec.label.trim(), value: spec.value.trim() }))
      .filter((spec) => spec.label || spec.value)

    if (specs.some((spec) => !spec.label || !spec.value)) {
      setError("Every specification needs both a label and a value.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/products/${productId}/website`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPublished: profile.isPublished,
          category: profile.category,
          brand: profile.brand,
          description: profile.description,
          specs,
          images: profile.images.map((image) => ({ id: image.id, alt: image.alt })),
        }),
      })
      if (!response.ok) {
        throw new Error(await readError(response, "Failed to save website details"))
      }
      onPublishedChange(productId, profile.isPublished)
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save website details"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Website details</DialogTitle>
          <DialogDescription>
            {product ? `${product.name} (${product.sku})` : ""}. Prices, cost and stock
            are never sent to the website.
          </DialogDescription>
        </DialogHeader>

        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
        {!profile && !loadError ? (
          <p className="text-sm text-muted-foreground">Loading website details...</p>
        ) : null}

        {profile && details ? (
          <div className="grid gap-5">
            <label className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={profile.isPublished}
                onChange={(event) => updateProfile({ isPublished: event.target.checked })}
              />
              <span>
                <span className="font-medium">Show on website</span>
                <span className="block text-muted-foreground">
                  On by default: every product appears on the public website with the
                  details below. Turn off to hide this one. Its price shows as
                  &quot;Price on request&quot;.
                </span>
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Website category (optional)
                <select
                  className={fieldClass}
                  value={profile.category}
                  onChange={(event) => updateProfile({ category: event.target.value })}
                >
                  <option value="">No category</option>
                  {details.categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                Brand (optional)
                <Input
                  value={profile.brand}
                  maxLength={80}
                  onChange={(event) => updateProfile({ brand: event.target.value })}
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              Description
              <textarea
                className={`${fieldClass} min-h-24`}
                value={profile.description}
                maxLength={2000}
                placeholder="What the product is and what it is used for"
                onChange={(event) => updateProfile({ description: event.target.value })}
              />
            </label>

            <section className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">
                    Images ({imageCount} of {maxImages})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    The first image is the main one. Images save as soon as they upload.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={details.limits.contentTypes.join(",")}
                  multiple
                  hidden
                  onChange={(event) => uploadFiles(event.target.files)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!details.storageConfigured || busy || imageCount >= maxImages}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="size-3.5" />
                  {uploading ?? "Upload images"}
                </Button>
              </div>

              {!details.storageConfigured ? (
                <p className="rounded-lg border border-border/80 bg-muted/40 p-3 text-sm text-muted-foreground">
                  Image storage is not set up yet. Add the R2 settings to the
                  environment to enable uploads.
                </p>
              ) : null}

              {profile.images.length === 0 ? (
                <p className="text-sm text-muted-foreground">No images yet</p>
              ) : (
                <ul className="grid gap-2">
                  {profile.images.map((image, index) => (
                    <li
                      key={image.id}
                      className="flex items-center gap-3 rounded-xl border border-border/80 p-2"
                    >
                      {/* Stored on R2 under a configurable domain, so next/image is not used here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt=""
                        className="size-16 shrink-0 rounded-lg bg-muted object-contain"
                      />
                      <label className="grid min-w-0 flex-1 gap-1 text-xs text-muted-foreground">
                        Image description
                        <Input
                          value={image.alt}
                          maxLength={160}
                          placeholder="What the photo shows"
                          onChange={(event) =>
                            updateProfile({
                              images: profile.images.map((item) =>
                                item.id === image.id
                                  ? { ...item, alt: event.target.value }
                                  : item
                              ),
                            })
                          }
                        />
                      </label>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Move image up"
                          disabled={index === 0 || busy}
                          onClick={() => moveImage(index, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Move image down"
                          disabled={index === profile.images.length - 1 || busy}
                          onClick={() => moveImage(index, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Remove image"
                          disabled={busy}
                          onClick={() => removeImage(image)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">Specifications</h3>
                  <p className="text-xs text-muted-foreground">
                    The first three show on the product card.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={profile.specs.length >= 20}
                  onClick={() =>
                    updateProfile({ specs: [...profile.specs, { label: "", value: "" }] })
                  }
                >
                  <Plus className="size-3.5" />
                  Add row
                </Button>
              </div>
              {profile.specs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No specifications yet</p>
              ) : (
                <ul className="grid gap-2">
                  {profile.specs.map((spec, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Input
                        aria-label={`Specification ${index + 1} label`}
                        placeholder="Label, e.g. Rated current"
                        value={spec.label}
                        maxLength={60}
                        onChange={(event) => updateSpec(index, { label: event.target.value })}
                      />
                      <Input
                        aria-label={`Specification ${index + 1} value`}
                        placeholder="Value, e.g. 16 A"
                        value={spec.value}
                        maxLength={120}
                        onChange={(event) => updateSpec(index, { value: event.target.value })}
                      />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove specification ${index + 1}`}
                        onClick={() =>
                          updateProfile({
                            specs: profile.specs.filter((_, specIndex) => specIndex !== index),
                          })
                        }
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!profile || busy}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
