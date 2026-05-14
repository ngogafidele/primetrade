import mongoose, { Schema } from "mongoose"

const ExpenseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, default: "" },
    vendor: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    incurredAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

export type ExpenseDocument = mongoose.InferSchemaType<typeof ExpenseSchema>

export const Expense =
  (mongoose.models.Expense as mongoose.Model<ExpenseDocument>) ||
  mongoose.model<ExpenseDocument>("Expense", ExpenseSchema)
