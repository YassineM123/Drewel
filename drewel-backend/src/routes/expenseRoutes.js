import express from "express";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import {
  addExpense,
  deleteExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
} from "../controllers/expenseController.js";

const router = express.Router();

router.post("/add-expense", requireSignIn, addExpense);
router.get("/get-all", requireSignIn, getAllExpenses);
router.get("/:id", getExpenseById);
router.post("/update/:id", requireSignIn, updateExpense);
router.post("/delete/:id", requireSignIn, deleteExpense);

export default router;
