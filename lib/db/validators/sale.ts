import { z } from "zod"
import { objectIdSchema } from "@/lib/db/validators/shared"

export const SaleItemSchema = z
  .object({
    productId: objectIdSchema,
    quantity: z.number().int().min(1),
    sellingPrice: z.number().min(0),
  })
  .strict()

export const OutstandingDetailsSchema = z
  .object({
    customerName: z.string().trim().min(1),
    customerPhone: z.string().trim().min(1),
    paymentDate: z.string().trim().min(1),
  })
  .strict()

export const SaleCustomerSchema = z
  .object({
    customerName: z.string().trim().optional(),
    customerPhone: z.string().trim().optional(),
  })
  .strict()
  .optional()

export const CreateSaleSchema = z
  .object({
    items: z.array(SaleItemSchema).min(1),
    paymentStatus: z.enum(["paid", "unpaid"]),
    paymentMethod: z.enum(["cash", "mobile-money", "bank"]).optional(),
    notes: z.string().optional(),
    customer: SaleCustomerSchema,
    outstanding: OutstandingDetailsSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.paymentStatus === "paid" || Boolean(value.outstanding),
    {
      message: "Loan details are required for unpaid sales",
      path: ["outstanding"],
    }
  )
  .refine(
    (value) => value.paymentStatus === "unpaid" || Boolean(value.paymentMethod),
    {
      message: "Payment method is required for paid sales",
      path: ["paymentMethod"],
    }
  )
