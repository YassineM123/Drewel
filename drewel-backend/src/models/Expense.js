import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    category: { type: String, required: true, enum: ["group", "non-group"] },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    splitDescription: { type: String, required: true },
    // members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      // required: true,
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;
