import { createRequire } from "module"
import path from "node:path"
import type * as Fs from "node:fs"

const require = createRequire(import.meta.url)
const {
  existsSync,
  readFileSync,
}: {
  existsSync: typeof Fs.existsSync
  readFileSync: typeof Fs.readFileSync
} = require("node:fs")

type StampDocument = {
  image(
    src: Buffer,
    x?: number,
    y?: number,
    options?: { fit?: [number, number] }
  ): unknown
}

const stampPath = path.join(process.cwd(), "public", "images", "stamp.jpg")
const stampSize = 96
const stampGap = 10
const stampRight = 467
const pageTop = 48

let stampBuffer: Buffer | null | undefined

function getStampBuffer() {
  if (stampBuffer === undefined) {
    stampBuffer = existsSync(stampPath) ? readFileSync(stampPath) : null
  }
  return stampBuffer
}

// The stamp sits bottom-right, just above the thank-you bar that starts at
// footerY + thankYouOffset - 6. Push footerY down so the stamp clears content
// ending at contentBottom (the totals block).
export function getStampedFooterY(
  footerY: number,
  contentBottom: number,
  thankYouOffset: number
) {
  return Math.max(
    footerY,
    contentBottom + stampGap * 2 + stampSize + 6 - thankYouOffset
  )
}

// Footer Y to use after starting a fresh page for the footer.
export function getStampedPageFooterY(thankYouOffset: number) {
  return getStampedFooterY(0, pageTop, thankYouOffset)
}

export function drawStamp(
  doc: StampDocument,
  footerY: number,
  thankYouOffset: number
) {
  const buffer = getStampBuffer()
  if (!buffer) return

  const y = footerY + thankYouOffset - 6 - stampGap - stampSize
  try {
    doc.image(buffer, stampRight - stampSize, y, {
      fit: [stampSize, stampSize],
    })
  } catch (error) {
    console.error("[PDF Stamp Error]", {
      message: error instanceof Error ? error.message : "Failed to draw stamp",
    })
  }
}
