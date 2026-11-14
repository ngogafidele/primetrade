import mongoose, { Schema } from "mongoose"

// Categories shown on the public website. Admins manage them from the
// products page. The slug is the category's web address and what products
// store in `website.category`; it is set once and never changes on rename.
const WebsiteCategorySchema = new Schema(
  {
    slug: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
)

WebsiteCategorySchema.index({ slug: 1 }, { unique: true })
WebsiteCategorySchema.index({ order: 1 })

export type WebsiteCategoryDocument = mongoose.InferSchemaType<
  typeof WebsiteCategorySchema
>

export const WebsiteCategory =
  (mongoose.models.WebsiteCategory as mongoose.Model<WebsiteCategoryDocument>) ||
  mongoose.model<WebsiteCategoryDocument>("WebsiteCategory", WebsiteCategorySchema)
