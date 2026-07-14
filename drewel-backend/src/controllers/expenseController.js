import mongoose from "mongoose";
import { checkRequiredFields } from "../helpers/requiredFields.js";
import Expense from "../models/Expense.js";

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
      if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(200).send({
          success: false,
          message: "Please provide a valid groupId",
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
    const expenses = await Expense.find()
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
    const expense = await Expense.findById(req.params.id)
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
    res.status(500).json({ message: err.message });
  }
};

// Update an expense
export const updateExpense = async (req, res) => {
  try {
    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedExpense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.status(200).json(updatedExpense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete an expense
export const deleteExpense = async (req, res) => {
  try {
    const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
    if (!deletedExpense) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Expense deleted", deletedExpense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
