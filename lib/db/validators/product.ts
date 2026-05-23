import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1),
    unit: z.string().min(1),
    quantity: z.number().int().min(0),
    lowStockThreshold: z.number().int().min(0).optional().default(0),
    costPrice: z.number().min(0),
    price: z.number().min(0),
    categoryId: objectIdSchema.optional(),
    supplierName: z.string().trim().optional(),
    suppliedAt: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.quantity === 0 || Boolean(value.supplierName?.trim().length),
    {
      message: "Supplier is required when adding stock",
      path: ["supplierName"],
    }
  )
  .strict()

export const CreateProductsSchema = z
  .object({
    products: z.array(CreateProductSchema).min(1).max(50),
  })
  .strict()

export const UpdateProductSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    unit: z.string().min(1).optional(),
    quantity: z.number().int().min(0).optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    price: z.number().min(0).optional(),
    categoryId: objectIdSchema.optional(),
  })
  .strict()
