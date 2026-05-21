import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { requireAuth } from "@/lib/auth/middleware"
import { CreateSaleSchema } from "@/lib/db/validators/sale"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { approvedSaleFilter } from "@/lib/db/sales-approval"

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    await connectToDatabase()
    const sales = await Sale.find(approvedSaleFilter).sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: sales })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch sales" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const payload = CreateSaleSchema.parse(await request.json())

    await connectToDatabase()

    const productIds = Array.from(
      new Set(payload.items.map((item) => item.productId))
    )
    const products = await Product.find({ _id: { $in: productIds } })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more products not found" },
        { status: 404 }
      )
    }

    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    )

    const requestedQuantities = new Map<string, number>()
    payload.items.forEach((item) => {
      const current = requestedQuantities.get(item.productId) ?? 0
      requestedQuantities.set(item.productId, current + item.quantity)
    })

    for (const [productId, quantity] of requestedQuantities.entries()) {
      const product = productMap.get(productId)
      if (!product) {
        throw new Error("Product not found")
      }
      if (product.quantity < quantity) {
        throw new Error(`Insufficient stock for ${product.name}`)
      }
    }

    let totalAmount = 0
    const saleItems = payload.items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) {
        throw new Error("Product not found")
      }

      const lineTotal = item.sellingPrice * item.quantity
      totalAmount += lineTotal

      return {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit ?? "pcs",
        quantity: item.quantity,
        basePrice: product.costPrice ?? product.price,
        sellingPrice: item.sellingPrice,
        lineTotal,
      }
    })

    const shouldApproveImmediately = session.isAdmin
    const approvalStatus = shouldApproveImmediately ? "approved" : "pending"
    const approvedAt = shouldApproveImmediately ? new Date() : undefined
    const decrementedProducts: Array<{
      productId: string
      quantity: number
    }> = []

    if (shouldApproveImmediately) {
      for (const [productId, quantity] of requestedQuantities.entries()) {
        const result = await Product.updateOne(
          { _id: productId, quantity: { $gte: quantity } },
          { $inc: { quantity: -quantity } }
        )

        if (result.modifiedCount !== 1) {
          if (decrementedProducts.length > 0) {
            await Product.bulkWrite(
              decrementedProducts.map((entry) => ({
                updateOne: {
                  filter: { _id: entry.productId },
                  update: { $inc: { quantity: entry.quantity } },
                },
              }))
            )
          }

          const product = productMap.get(productId)
          throw new Error(
            product
              ? `Insufficient stock for ${product.name}`
              : "One or more products not found"
          )
        }

        decrementedProducts.push({ productId, quantity })
      }
    }

    let sale
    let customer:
      | {
          customerName: string
          customerPhone: string
        }
      | undefined
    try {
      const outstanding =
        payload.paymentStatus === "unpaid" && payload.outstanding
          ? {
              customerName: payload.outstanding.customerName,
              customerPhone: payload.outstanding.customerPhone,
              paymentDate: new Date(payload.outstanding.paymentDate),
            }
          : undefined

      if (
        outstanding?.paymentDate &&
        Number.isNaN(outstanding.paymentDate.getTime())
      ) {
        throw new Error("Payment date is invalid")
      }

      customer =
        payload.paymentStatus === "paid" &&
        (payload.customer?.customerName?.trim() ||
          payload.customer?.customerPhone?.trim())
          ? {
              customerName: payload.customer.customerName?.trim() ?? "",
              customerPhone: payload.customer.customerPhone?.trim() ?? "",
            }
          : undefined

      sale = await Sale.create({
        items: saleItems,
        totalAmount,
        paymentStatus: payload.paymentStatus,
        paymentMethod:
          payload.paymentStatus === "paid" ? payload.paymentMethod : undefined,
        approvalStatus,
        approvedBy: shouldApproveImmediately ? session.userId : undefined,
        approvedAt,
        createdBy: session.userId,
        notes: payload.notes ?? "",
        customer,
        outstanding,
      })
      await Sale.collection.updateOne(
        { _id: sale._id },
        {
          $set: {
            approvalStatus,
            ...(customer ? { customer } : {}),
            ...(shouldApproveImmediately
              ? { approvedBy: session.userId, approvedAt }
              : {}),
          },
        }
      )
    } catch (error) {
      if (sale?._id) {
        await Sale.collection.deleteOne({ _id: sale._id })
      }
      if (decrementedProducts.length > 0) {
        await Product.bulkWrite(
          decrementedProducts.map((entry) => ({
            updateOne: {
              filter: { _id: entry.productId },
              update: { $inc: { quantity: entry.quantity } },
            },
          }))
        )
      }
      throw error
    }

    try {
      if (shouldApproveImmediately) {
        await Promise.all(
          Array.from(requestedQuantities.entries()).map(
            async ([productId, quantity]) => {
              const product = productMap.get(productId)
              if (!product) return
              const newQuantity = product.quantity - quantity
              await syncLowStockAlert({
                productId: product._id.toString(),
                name: product.name,
                sku: product.sku,
                quantity: newQuantity,
                threshold: product.lowStockThreshold ?? 0,
              })
            }
          )
        )
      }
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    const saleData =
      typeof sale.toObject === "function" ? sale.toObject() : sale

    return NextResponse.json(
      {
        success: true,
        data: {
          ...saleData,
          approvalStatus,
          customer,
          approvedBy: shouldApproveImmediately ? session.userId : undefined,
          approvedAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create sale"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
