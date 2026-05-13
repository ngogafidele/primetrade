import { NumberSequence } from "@/lib/db/models/NumberSequence"
import { getKigaliDateParts } from "@/lib/utils/time"

type SequenceType = "invoice" | "proforma"

function formatSequence(sequence: number) {
  return String(sequence).padStart(4, "0")
}

async function generateNumber(type: SequenceType) {
  const nowParts = getKigaliDateParts(new Date())
  const year = nowParts.year
  const month = nowParts.month

  const sequence = await NumberSequence.findOneAndUpdate(
    { type, year, month },
    { $inc: { sequence: 1 } },
    {
      new: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      upsert: true,
    }
  )

  if (!sequence) {
    throw new Error("Failed to generate number sequence")
  }

  const prefix = type === "invoice" ? "INV" : "PF"
  const period = `${year}${String(month).padStart(2, "0")}`

  return `${prefix}-${period}-${formatSequence(sequence.sequence)}`
}

export async function generateInvoiceNumber(): Promise<string> {
  return generateNumber("invoice")
}

export async function generateProformaNumber(): Promise<string> {
  return generateNumber("proforma")
}
