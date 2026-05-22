"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

type ReportPrintButtonProps = {
  fromInput: string
  toInput: string
}

function getDownloadFilename(response: Response) {
  const disposition = response.headers.get("Content-Disposition")
  const match = disposition?.match(/filename="([^"]+)"/)
  return match?.[1] ?? "inventory-report.pdf"
}

export function ReportPrintButton({ fromInput, toInput }: ReportPrintButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadReportPdf = async () => {
    setIsDownloading(true)

    try {
      const params = new URLSearchParams()
      if (fromInput) params.set("from", fromInput)
      if (toInput) params.set("to", toInput)

      const response = await fetch(`/api/reports/pdf?${params.toString()}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        alert(body?.error ?? "Failed to download report PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = getDownloadFilename(response)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert("Failed to download report PDF.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={downloadReportPdf}
      disabled={isDownloading}
    >
      <FileText className="size-4" />
      {isDownloading ? "Preparing PDF..." : "Report PDF"}
    </Button>
  )
}
