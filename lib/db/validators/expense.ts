import { z } from "zod"

export const CreateExpenseSchema = z
  .object({
    title: z.string().min(1),
    amount: z.number().min(0),
    category: z.string().optional(),
    vendor: z.string().optional(),
    notes: z.string().optional(),
    incurredAt: z.string().datetime().optional(),
  })
  .strict()
