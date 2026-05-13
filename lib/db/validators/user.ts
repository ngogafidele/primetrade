import { z } from "zod"

export const CreateUserSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().min(3),
    password: z.string().min(8),
    role: z.enum(["admin", "manager", "staff"]).default("staff"),
    isActive: z.boolean().optional(),
  })
  .strict()

export const UpdateUserSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().min(3).optional(),
    password: z.string().min(8).optional(),
    role: z.enum(["admin", "manager", "staff"]).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

export const LoginSchema = z
  .object({
    email: z.string().min(3),
    password: z.string().min(8),
  })
  .strict()

export const ForgotPasswordSchema = z
  .object({
    email: z.string().email(),
  })
  .strict()

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(20),
    password: z.string().min(8),
  })
  .strict()

export const SetupAdminSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  })
  .strict()
