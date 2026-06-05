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

const SaleCustomerSchema = new Schema(
  {
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
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
    approvalStatus: {
      type: String,
      enum: ["pending", "approved"],
      required: true,
      default: "approved",
    },
    saleDate: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "" },
    customer: { type: SaleCustomerSchema, default: undefined },
    outstanding: { type: OutstandingDetailsSchema, default: undefined },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedReason: { type: String, default: "", trim: true },
  },
  { timestamps: true }
)

SaleSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 })

export type SaleDocument = mongoose.InferSchemaType<typeof SaleSchema>

export const Sale =
  (mongoose.models.Sale as mongoose.Model<SaleDocument>) ||
  mongoose.model<SaleDocument>("Sale", SaleSchema)
