import express from "express";
import { requireSignIn, isAdmin } from "../middlewares/authMiddleware.js";
import {
  getPublicProfile,
  getDriverReviewsList,
  getRankings,
  getMyRanking,
  updateDriverProfileFields,
  toggleFavoriteDriver,
  triggerRankingRecalculation,
} from "../controllers/driverProfileController.js";

const router = express.Router();

router.get("/public/:driverId", getPublicProfile);
router.get("/public/:driverId/reviews", getDriverReviewsList);
router.get("/rankings", getRankings);
router.get("/rankings/my", requireSignIn, getMyRanking);
router.patch("/profile-fields", requireSignIn, updateDriverProfileFields);
router.post("/favorite", requireSignIn, toggleFavoriteDriver);
router.post("/rankings/recalculate", requireSignIn, isAdmin, triggerRankingRecalculation);

export default router;
