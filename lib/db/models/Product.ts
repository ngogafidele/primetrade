import mongoose, { Schema } from "mongoose"

const ProductImageSchema = new Schema({
  // Object key in the R2 bucket; the public URL is built from R2_PUBLIC_BASE_URL.
  key: { type: String, required: true },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
  alt: { type: String, trim: true, default: "" },
})

const ProductSpecSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
)

// What the public website may show for this product. Every active product is
// on the website unless an admin hides it (isHidden). Prices, cost and stock
// are never part of this.
const ProductWebsiteSchema = new Schema(
  {
    isHidden: { type: Boolean, default: false },
    category: { type: String, trim: true, default: "" },
    brand: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    specs: { type: [ProductSpecSchema], default: [] },
    images: { type: [ProductImageSchema], default: [] },
  },
  { _id: false }
)

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
    website: { type: ProductWebsiteSchema, default: () => ({}) },
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
ProductSchema.index({ "website.isHidden": 1 })
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
