import mongoose, { Schema } from "mongoose"

const StockAdjustmentSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    quantityChange: { type: Number, required: true },
    reason: { type: String, required: true },
    adjustedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

export type StockAdjustmentDocument =
  mongoose.InferSchemaType<typeof StockAdjustmentSchema>

export const StockAdjustment =
  (mongoose.models.StockAdjustment as mongoose.Model<StockAdjustmentDocument>) ||
  mongoose.model<StockAdjustmentDocument>(
    "StockAdjustment",
    StockAdjustmentSchema
  )
