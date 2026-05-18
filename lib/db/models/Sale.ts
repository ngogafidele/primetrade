import mongoose, { Schema } from "mongoose"

const SaleItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true, default: "pcs" },
    quantity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const OutstandingDetailsSchema = new Schema(
  {
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    paymentDate: { type: Date, required: true },
  },
  { _id: false }
)

const SaleSchema = new Schema(
  {
    items: { type: [SaleItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      required: true,
      default: "paid",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "mobile-money", "bank"],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "" },
    outstanding: { type: OutstandingDetailsSchema, default: undefined },
  },
  { timestamps: true }
)

export type SaleDocument = mongoose.InferSchemaType<typeof SaleSchema>

export const Sale =
  (mongoose.models.Sale as mongoose.Model<SaleDocument>) ||
  mongoose.model<SaleDocument>("Sale", SaleSchema)
