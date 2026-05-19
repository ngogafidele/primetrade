import mongoose, { Schema } from "mongoose"

const ReturnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true, default: "pcs" },
    quantity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, required: true, min: 0, default: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const ReturnSchema = new Schema(
  {
    returnItems: { type: [ReturnItemSchema], required: true },
    replacementItems: { type: [ReturnItemSchema], default: [] },
    totalReturnAmount: { type: Number, required: true, min: 0 },
    totalReplacementAmount: { type: Number, required: true, min: 0, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
)

export type ReturnDocument = mongoose.InferSchemaType<typeof ReturnSchema>

export const ReturnTransaction =
  (mongoose.models.ReturnTransaction as mongoose.Model<ReturnDocument>) ||
  mongoose.model<ReturnDocument>("ReturnTransaction", ReturnSchema)
