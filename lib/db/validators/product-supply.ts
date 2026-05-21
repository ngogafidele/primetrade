import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const CreateProductSupplySchema = z
  .object({
    productId: objectIdSchema,
    supplierName: z.string().trim().min(1, "Supplier is required"),
    quantity: z.number().int().min(1),
    unitCost: z.number().min(0),
    suppliedAt: z.string().trim().min(1).optional(),
    notes: z.string().trim().optional(),
  })
  .strict()
