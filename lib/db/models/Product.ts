import mongoose, { Schema } from "mongoose"

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true, default: "pcs" },
    quantity: { type: Number, required: true, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 0 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0 },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    deletedReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
)

ProductSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
)
ProductSchema.index({ deletedAt: 1 })
ProductSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { deletedAt: null },
  }
)

export type ProductDocument = mongoose.InferSchemaType<typeof ProductSchema>

export const Product =
  (mongoose.models.Product as mongoose.Model<ProductDocument>) ||
  mongoose.model<ProductDocument>("Product", ProductSchema)
