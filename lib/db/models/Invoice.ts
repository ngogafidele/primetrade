import mongoose, { Schema } from "mongoose"

const InvoiceItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    sku: { type: String, default: "", trim: true },
    unit: { type: String, required: true, default: "pcs", trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const InvoiceSchema = new Schema(
  {
    saleId: { type: Schema.Types.ObjectId, ref: "Sale" },
    proformaId: { type: Schema.Types.ObjectId, ref: "Proforma" },
    sourceType: {
      type: String,
      enum: ["sale", "proforma"],
      default: "sale",
    },
    invoiceNumber: { type: String, required: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    items: { type: [InvoiceItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    issuedAt: { type: Date, default: Date.now },
    dueDate: { type: Date },
  },
  { timestamps: true }
)

InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true })
InvoiceSchema.index({ saleId: 1 })
InvoiceSchema.index({ proformaId: 1 })

export type InvoiceDocument = mongoose.InferSchemaType<typeof InvoiceSchema>

export const Invoice =
  (mongoose.models.Invoice as mongoose.Model<InvoiceDocument>) ||
  mongoose.model<InvoiceDocument>("Invoice", InvoiceSchema)
