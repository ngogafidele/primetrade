import { NextRequest, NextResponse } from "next/server"
import type { ClientSession } from "mongoose"
import { z, ZodError } from "zod"
import { requireAdmin } from "@/lib/auth/middleware"
import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Sale } from "@/lib/db/models/Sale"
import { approvedSaleFilter } from "@/lib/db/sales-approval"
import { parseKigaliDateInput } from "@/lib/utils/time"

const LoanPaymentSchema = z
  .object({
    amount: z.number().positive(),
    paymentMethod: z.enum(["cash", "mobile-money", "bank"]),
    paidAt: z.string().trim().min(1),
    notes: z.string().optional(),
  })
  .strict()

type LoanPayment = {
  amount?: number
}

type LoanSaleForPayment = {
  _id: { toString(): string }
  totalAmount: number
  amountPaid?: number
  remainingBalance?: number
  payments?: LoanPayment[]
  customer?: {
    customerName?: string
    customerPhone?: string
  }
  outstanding?: {
    customerName?: string
    customerPhone?: string
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function sumPayments(payments: LoanPayment[] | undefined) {
  if (!Array.isArray(payments)) return 0
  return roundMoney(
    payments.reduce((sum, payment) => sum + (payment.amount ?? 0), 0)
  )
}

function getAmountPaid(sale: LoanSaleForPayment) {
  if (typeof sale.amountPaid === "number") return roundMoney(sale.amountPaid)
  return sumPayments(sale.payments)
}

function getRemainingBalance(sale: LoanSaleForPayment) {
  if (typeof sale.remainingBalance === "number") {
    return roundMoney(sale.remainingBalance)
  }

  return Math.max(0, roundMoney(sale.totalAmount - getAmountPaid(sale)))
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let dbSession: ClientSession | null = null

  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params
    const payload = LoanPaymentSchema.parse(await request.json())
    const paidAt = parseKigaliDateInput(payload.paidAt)

    if (!paidAt) {
      return NextResponse.json(
        { success: false, error: "Choose a valid payment date" },
        { status: 400 }
      )
    }

    const db = await connectToDatabase()
    dbSession = await db.startSession()
    const activeDbSession = dbSession

    let updatedSale: unknown = null

    await activeDbSession.withTransaction(async () => {
      const saleFilter: Record<string, unknown> = {
        _id: id,
        paymentStatus: "unpaid",
        ...approvedSaleFilter,
      }
      const sale = await Sale.findOne(saleFilter)
        .session(activeDbSession)
        .lean<LoanSaleForPayment | null>()

      if (!sale) {
        throw new Error("UNPAID_LOAN_NOT_FOUND")
      }

      const remainingBalance = getRemainingBalance(sale)
      const amount = roundMoney(payload.amount)

      if (amount > remainingBalance) {
        throw new Error("PAYMENT_EXCEEDS_BALANCE")
      }

      const amountPaid = roundMoney(getAmountPaid(sale) + amount)
      const nextRemainingBalance = Math.max(
        0,
        roundMoney(remainingBalance - amount)
      )
      const isSettled = nextRemainingBalance === 0
      const customerFromOutstanding =
        sale.outstanding && !sale.customer
          ? {
              customerName: sale.outstanding.customerName ?? "",
              customerPhone: sale.outstanding.customerPhone ?? "",
            }
          : undefined

      const updateFilter: Record<string, unknown> = {
        _id: sale._id.toString(),
        paymentStatus: "unpaid",
        ...approvedSaleFilter,
      }

      updatedSale = await Sale.findOneAndUpdate(
        updateFilter,
        {
          $push: {
            payments: {
              amount,
              paymentMethod: payload.paymentMethod,
              paidAt,
              receivedBy: session.userId,
              notes: payload.notes?.trim() ?? "",
            },
          },
          $set: {
            amountPaid,
            remainingBalance: nextRemainingBalance,
            ...(isSettled
              ? {
                  paymentStatus: "paid",
                  paymentMethod: payload.paymentMethod,
                  ...(customerFromOutstanding
                    ? { customer: customerFromOutstanding }
                    : {}),
                }
              : {}),
          },
          ...(isSettled ? { $unset: { outstanding: "" } } : {}),
        },
        { new: true, session: activeDbSession }
      )

      if (!updatedSale) {
        throw new Error("PAYMENT_WRITE_CONFLICT")
      }

      if (isSettled) {
        await Invoice.updateOne(
          { saleId: sale._id.toString(), deletedAt: null },
          { status: "paid" },
          { session: activeDbSession }
        )
      }
    })

    if (!updatedSale) {
      return NextResponse.json(
        { success: false, error: "Failed to record payment" },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, data: updatedSale })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid payment details" },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === "UNPAID_LOAN_NOT_FOUND") {
        return NextResponse.json(
          { success: false, error: "Unpaid loan sale not found" },
          { status: 404 }
        )
      }

      if (error.message === "PAYMENT_EXCEEDS_BALANCE") {
        return NextResponse.json(
          {
            success: false,
            error: "Payment amount cannot exceed the remaining loan balance",
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: "Failed to record payment" },
      { status: 400 }
    )
  } finally {
    await dbSession?.endSession()
  }
}
