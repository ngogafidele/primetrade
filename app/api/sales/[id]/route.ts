import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { Invoice } from "@/lib/db/models/Invoice"
import { Product } from "@/lib/db/models/Product"
import { Sale } from "@/lib/db/models/Sale"
import { requireAdmin, requireAuth } from "@/lib/auth/middleware"
import { syncLowStockAlert } from "@/lib/db/alerts"
import { approvedSaleFilter } from "@/lib/db/sales-approval"
import { CreateSaleSchema } from "@/lib/db/validators/sale"

type SaleItemForRestock = {
  productId: { toString(): string }
  quantity: number
}

type SaleItemForApproval = SaleItemForRestock & {
  name?: string
}

type SaleItemForUpdate = SaleItemForRestock & {
  productId: { toString(): string }
}

function getQuantityMap(items: SaleItemForUpdate[]) {
  const quantities = new Map<string, number>()
  items.forEach((item) => {
    const productId = item.productId.toString()
    quantities.set(productId, (quantities.get(productId) ?? 0) + item.quantity)
  })
  return quantities
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const sale = await Sale.findById(id)

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: sale })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch sale" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const payload = await request.json().catch(() => null)
    if (payload?.items) {
      if (!session.isAdmin) {
        return NextResponse.json(
          { success: false, error: "Admin only" },
          { status: 403 }
        )
      }

      const updatePayload = CreateSaleSchema.parse(payload)
      const { id } = await context.params

      await connectToDatabase()
      const sale = await Sale.findById(id)

      if (!sale) {
        return NextResponse.json(
          { success: false, error: "Sale not found" },
          { status: 404 }
        )
      }

      const invoice = await Invoice.findOne({ saleId: sale._id })
      if (invoice) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cannot edit a sale that already has an invoice. Delete the invoice first.",
          },
          { status: 409 }
        )
      }

      const productIds = Array.from(
        new Set(updatePayload.items.map((item) => item.productId))
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
      const existingItems = sale.items as SaleItemForUpdate[]
      const wasApproved = (sale.approvalStatus ?? "approved") === "approved"
      const existingQuantities = wasApproved
        ? getQuantityMap(existingItems)
        : new Map<string, number>()
      const requestedQuantities = new Map<string, number>()
      updatePayload.items.forEach((item) => {
        requestedQuantities.set(
          item.productId,
          (requestedQuantities.get(item.productId) ?? 0) + item.quantity
        )
      })

      if (wasApproved) {
        for (const [productId, quantity] of requestedQuantities.entries()) {
          const product = productMap.get(productId)
          if (!product) {
            return NextResponse.json(
              { success: false, error: "One or more products not found" },
              { status: 404 }
            )
          }
          const available =
            product.quantity + (existingQuantities.get(productId) ?? 0)
          if (quantity > available) {
            return NextResponse.json(
              {
                success: false,
                error: `Insufficient stock for ${product.name}`,
              },
              { status: 400 }
            )
          }
        }
      }

      let totalAmount = 0
      const saleItems = updatePayload.items.map((item) => {
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

      const netStockChanges = new Map<string, number>()
      if (wasApproved) {
        const allProductIds = new Set([
          ...Array.from(existingQuantities.keys()),
          ...Array.from(requestedQuantities.keys()),
        ])
        allProductIds.forEach((productId) => {
          const previous = existingQuantities.get(productId) ?? 0
          const next = requestedQuantities.get(productId) ?? 0
          const change = previous - next
          if (change !== 0) {
            netStockChanges.set(productId, change)
          }
        })
      }

      const outstanding =
        updatePayload.paymentStatus === "unpaid" && updatePayload.outstanding
          ? {
              customerName: updatePayload.outstanding.customerName,
              customerPhone: updatePayload.outstanding.customerPhone,
              paymentDate: new Date(updatePayload.outstanding.paymentDate),
            }
          : undefined

      if (
        outstanding?.paymentDate &&
        Number.isNaN(outstanding.paymentDate.getTime())
      ) {
        return NextResponse.json(
          { success: false, error: "Payment date is invalid" },
          { status: 400 }
        )
      }

      const customer =
        updatePayload.paymentStatus === "paid" &&
        (updatePayload.customer?.customerName?.trim() ||
          updatePayload.customer?.customerPhone?.trim())
          ? {
              customerName: updatePayload.customer.customerName?.trim() ?? "",
              customerPhone: updatePayload.customer.customerPhone?.trim() ?? "",
            }
          : undefined

      const touchedProductIds = Array.from(netStockChanges.keys())
      const touchedProducts =
        touchedProductIds.length > 0
          ? await Product.find({ _id: { $in: touchedProductIds } })
          : []
      const touchedProductMap = new Map(
        touchedProducts.map((product) => [product._id.toString(), product])
      )
      const appliedChanges: Array<{ productId: string; change: number }> = []

      for (const [productId, change] of netStockChanges.entries()) {
        const result = await Product.updateOne(
          { _id: productId, ...(change < 0 ? { quantity: { $gte: -change } } : {}) },
          { $inc: { quantity: change } }
        )

        if (result.modifiedCount !== 1) {
          if (appliedChanges.length > 0) {
            await Product.bulkWrite(
              appliedChanges.map((entry) => ({
                updateOne: {
                  filter: { _id: entry.productId },
                  update: { $inc: { quantity: -entry.change } },
                },
              }))
            )
          }

          const product =
            touchedProductMap.get(productId) ?? productMap.get(productId)
          return NextResponse.json(
            {
              success: false,
              error: product
                ? `Insufficient stock for ${product.name}`
                : "One or more products not found",
            },
            { status: 400 }
          )
        }

        appliedChanges.push({ productId, change })
      }

      try {
        sale.set({
          items: saleItems,
          totalAmount,
          paymentStatus: updatePayload.paymentStatus,
          paymentMethod:
            updatePayload.paymentStatus === "paid"
              ? updatePayload.paymentMethod
              : undefined,
          notes: updatePayload.notes ?? "",
          customer,
          outstanding,
        })
        await sale.save()
      } catch (error) {
        if (appliedChanges.length > 0) {
          await Product.bulkWrite(
            appliedChanges.map((entry) => ({
              updateOne: {
                filter: { _id: entry.productId },
                update: { $inc: { quantity: -entry.change } },
              },
            }))
          )
        }
        throw error
      }

      try {
        await Promise.all(
          appliedChanges.map(async (entry) => {
            const product =
              touchedProductMap.get(entry.productId) ??
              productMap.get(entry.productId)
            if (!product) return
            await syncLowStockAlert({
              productId: product._id.toString(),
              name: product.name,
              sku: product.sku,
              quantity: product.quantity + entry.change,
              threshold: product.lowStockThreshold ?? 0,
            })
          })
        )
      } catch (error) {
        console.error("[Low Stock Alert Sync Error]", error)
      }

      return NextResponse.json({ success: true, data: sale })
    }

    if (payload?.approvalStatus === "approved") {
      if (!session.isAdmin) {
        return NextResponse.json(
          { success: false, error: "Admin only" },
          { status: 403 }
        )
      }

      const { id } = await context.params

      await connectToDatabase()
      const sale = await Sale.findOne({ _id: id, approvalStatus: "pending" })

      if (!sale) {
        return NextResponse.json(
          { success: false, error: "Pending sale not found" },
          { status: 404 }
        )
      }

      const saleItems = sale.items as SaleItemForApproval[]
      const requestedQuantities = new Map<string, number>()
      saleItems.forEach((item) => {
        const productId = item.productId.toString()
        const current = requestedQuantities.get(productId) ?? 0
        requestedQuantities.set(productId, current + item.quantity)
      })

      const productIds = Array.from(requestedQuantities.keys())
      const products = await Product.find({ _id: { $in: productIds } })
      const productMap = new Map(
        products.map((product) => [product._id.toString(), product])
      )

      for (const [productId, quantity] of requestedQuantities.entries()) {
        const product = productMap.get(productId)
        if (!product) {
          return NextResponse.json(
            { success: false, error: "One or more products not found" },
            { status: 404 }
          )
        }
        if (product.quantity < quantity) {
          return NextResponse.json(
            {
              success: false,
              error: `Insufficient stock for ${product.name}`,
            },
            { status: 400 }
          )
        }
      }

      const decrementedProducts: Array<{ productId: string; quantity: number }> =
        []

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
          return NextResponse.json(
            {
              success: false,
              error: product
                ? `Insufficient stock for ${product.name}`
                : "One or more products not found",
            },
            { status: 400 }
          )
        }

        decrementedProducts.push({ productId, quantity })
      }

      const approvedAt = new Date()

      try {
        await Sale.collection.updateOne(
          { _id: sale._id },
          {
            $set: {
              approvalStatus: "approved",
              approvedBy: session.userId,
              approvedAt,
            },
          }
        )
        sale.set({
          approvalStatus: "approved",
          approvedBy: session.userId,
          approvedAt,
        })
      } catch (error) {
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
        await Promise.all(
          Array.from(requestedQuantities.entries()).map(
            async ([productId, quantity]) => {
              const product = productMap.get(productId)
              if (!product) return
              await syncLowStockAlert({
                productId: product._id.toString(),
                name: product.name,
                sku: product.sku,
                quantity: product.quantity - quantity,
                threshold: product.lowStockThreshold ?? 0,
              })
            }
          )
        )
      } catch (error) {
        console.error("[Low Stock Alert Sync Error]", error)
      }

      const saleData =
        typeof sale.toObject === "function" ? sale.toObject() : sale

      return NextResponse.json({
        success: true,
        data: {
          ...saleData,
          approvalStatus: "approved",
          approvedBy: session.userId,
          approvedAt,
        },
      })
    }

    if (payload?.paymentStatus !== "paid") {
      return NextResponse.json(
        { success: false, error: "Only paid status updates are supported" },
        { status: 400 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const sale = await Sale.findOne({
      _id: id,
      paymentStatus: "unpaid",
      ...approvedSaleFilter,
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Loan sale not found" },
        { status: 404 }
      )
    }

    sale.set({
      paymentStatus: "paid",
      customer: sale.outstanding
        ? {
            customerName: sale.outstanding.customerName,
            customerPhone: sale.outstanding.customerPhone,
          }
        : undefined,
      outstanding: undefined,
    })
    await sale.save()

    return NextResponse.json({ success: true, data: sale })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to update sale" },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, session } = await requireAdmin(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const { id } = await context.params

    await connectToDatabase()
    const sale = await Sale.findById(id)

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found" },
        { status: 404 }
      )
    }

    const invoice = await Invoice.findOne({ saleId: sale._id })
    if (invoice) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete a sale that already has an invoice. Delete the invoice first.",
        },
        { status: 409 }
      )
    }

    const shouldRestock = (sale.approvalStatus ?? "approved") === "approved"
    const saleItems = sale.items as SaleItemForRestock[]
    const productIds = shouldRestock
      ? saleItems.map((item) => item.productId)
      : []
    const products = shouldRestock
      ? await Product.find({ _id: { $in: productIds } })
      : []
    const productMap = new Map(
      products.map((product) => [product._id.toString(), product])
    )

    if (shouldRestock && saleItems.length > 0) {
      await Product.bulkWrite(
        saleItems.map((item) => ({
          updateOne: {
            filter: { _id: item.productId },
            update: { $inc: { quantity: item.quantity } },
          },
        }))
      )
    }

    try {
      await sale.deleteOne()
    } catch (error) {
      if (shouldRestock && saleItems.length > 0) {
        await Product.bulkWrite(
          saleItems.map((item) => ({
            updateOne: {
              filter: { _id: item.productId },
              update: { $inc: { quantity: -item.quantity } },
            },
          }))
        )
      }
      throw error
    }

    try {
      if (shouldRestock) {
        await Promise.all(
          saleItems.map(async (item) => {
            const product = productMap.get(item.productId.toString())
            if (!product) return
            const newQuantity = product.quantity + item.quantity
            await syncLowStockAlert({
              productId: product._id.toString(),
              name: product.name,
              sku: product.sku,
              quantity: newQuantity,
              threshold: product.lowStockThreshold ?? 0,
            })
          })
        )
      }
    } catch (error) {
      console.error("[Low Stock Alert Sync Error]", error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete sale" },
      { status: 400 }
    )
  }
}
