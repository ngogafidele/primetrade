import mongoose, { Schema } from "mongoose"

const ProductSupplySchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    supplierName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    suppliedAt: { type: Date, required: true, default: Date.now },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
)

ProductSupplySchema.index({ productId: 1, suppliedAt: -1 })
ProductSupplySchema.index({ supplierName: 1 })

export type ProductSupplyDocument =
  mongoose.InferSchemaType<typeof ProductSupplySchema>

export const ProductSupply =
  (mongoose.models.ProductSupply as mongoose.Model<ProductSupplyDocument>) ||
  mongoose.model<ProductSupplyDocument>("ProductSupply", ProductSupplySchema)
