import mongoose from "mongoose";
import { checkRequiredFields } from "../helpers/requiredFields.js";
import Expense from "../models/Expense.js";
import Group from "../models/Group.js";

const editableExpenseFields = [
  "title",
  "amount",
  "category",
  "description",
  "splitDescription",
  "groupId",
  "date",
];

const accessibleGroupIdsFor = (userId) =>
  Group.find({ $or: [{ createdBy: userId }, { members: userId }] }).distinct("_id");

const canAccessGroup = (groupId, userId) =>
  Group.exists({
    _id: groupId,
    $or: [{ createdBy: userId }, { members: userId }],
  });

const readExpenseFilter = async (userId, expenseId = null) => {
  const groupIds = await accessibleGroupIdsFor(userId);
  return {
    ...(expenseId ? { _id: expenseId } : {}),
    $or: [{ paidBy: userId }, { groupId: { $in: groupIds } }],
  };
};

const validateExpenseGroupAccess = async ({ category, groupId, userId }) => {
  if (category !== "group") return { ok: true, groupId: null };
  if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
    return { ok: false, message: "Please provide a valid groupId" };
  }
  if (!(await canAccessGroup(groupId, userId))) {
    return { ok: false, status: 403, message: "You are not authorized to use this group" };
  }
  return { ok: true, groupId };
};

// Create a new expense
export const addExpense = async (req, res) => {
  try {
    const {
      title,
      amount,
      category,
      description,
      splitDescription,
      groupId,
      date,
    } = req.body || {};

    const { isValid, missingFields } = checkRequiredFields(
      [
        "title",
        "amount",
        "category",
        "description",
        "date",
        "splitDescription",
      ],
      req.body || {}
    );
    if (!isValid) {
      return res.status(200).send({
        success: false,
        message: `${missingFields.join(", ")} is required`,
      });
    }
    if (!["group", "non-group"].includes(category)) {
      return res.status(200).send({
        success: false,
        message: "Category must be either group or non-group",
      });
    }
    if (isNaN(amount) || amount < 0) {
      return res.status(200).send({
        success: false,
        message: "Amount must be a non-negative number",
      });
    }

    if (category === "group") {
      const groupAccess = await validateExpenseGroupAccess({
        category,
        groupId,
        userId: req.user._id,
      });
      if (!groupAccess.ok) {
        return res.status(groupAccess.status || 400).send({
          success: false,
          message: groupAccess.message,
        });
      }
    }

    const paidBy = req.user._id;
    const expense = new Expense({
      paidBy,
      title,
      amount,
      category,
      description,
      groupId: groupId ?? null,
      splitDescription,
      date,
    });
    const savedExpense = await expense.save();
    res.status(200).json({
      success: true,
      message: `expense for ${title} has been added`,
      expense: savedExpense,
    });
  } catch (err) {
    console.log("err: ", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllExpenses = async (req, res) => {
  try {
    const filter = await readExpenseFilter(req.user._id);
    const expenses = await Expense.find(filter)
      .populate([
        { path: "paidBy", select: "fullName email" },
        {
          path: "groupId",
          select: "name members",
          populate: { path: "members", select: "fullName email" }, // <-- Nested populate
        },
      ])
      .select("-createdAt -updatedAt -__v");

    res.status(200).json({
      success: true,
      message: "All expenses fetched successfully",
      expenses: expenses,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get a single expense by ID
export const getExpenseById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Valid expense ID required" });
    }
    const filter = await readExpenseFilter(req.user._id, req.params.id);
    const expense = await Expense.findOne(filter)
      .populate([
        { path: "paidBy", select: "fullName email" },
        {
          path: "groupId",
          select: "name members",
          populate: { path: "members", select: "fullName email" }, // <-- Nested populate
        },
      ])
      .select("-createdAt -updatedAt -__v");
    if (!expense) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }
    res.status(200).json({
      success: true,
      message: `${expense?.title} is fetched`,
      expense,
    });
  } catch (err) {
    console.error("Failed to fetch expense:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update an expense
export const updateExpense = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Valid expense ID required" });
    }

    const existingExpense = await Expense.findOne({
      _id: req.params.id,
      paidBy: req.user._id,
    }).lean();
    if (!existingExpense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    const updates = Object.fromEntries(
      editableExpenseFields
        .filter((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field))
        .map((field) => [field, req.body[field]])
    );
    const nextCategory = updates.category ?? existingExpense.category;
    const nextGroupId = Object.prototype.hasOwnProperty.call(updates, "groupId")
      ? updates.groupId
      : existingExpense.groupId;
    const groupAccess = await validateExpenseGroupAccess({
      category: nextCategory,
      groupId: nextGroupId,
      userId: req.user._id,
    });
    if (!groupAccess.ok) {
      return res.status(groupAccess.status || 400).json({
        success: false,
        message: groupAccess.message,
      });
    }
    updates.groupId = groupAccess.groupId;

    if (Object.prototype.hasOwnProperty.call(updates, "amount")) {
      const amount = Number(updates.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ success: false, message: "Amount must be a non-negative number" });
      }
      updates.amount = amount;
    }

    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: req.params.id, paidBy: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updatedExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.status(200).json({ success: true, expense: updatedExpense });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Delete an expense
export const deleteExpense = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Valid expense ID required" });
    }
    const deletedExpense = await Expense.findOneAndDelete({
      _id: req.params.id,
      paidBy: req.user._id,
    });
    if (!deletedExpense) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Expense deleted", deletedExpense });
  } catch (err) {
    console.error("Failed to delete expense:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
