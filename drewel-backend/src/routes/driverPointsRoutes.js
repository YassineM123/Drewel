import express from "express";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import { pointsPurchaseRequestRateLimit } from "../middlewares/pointsRateLimit.js";
import {
  createPointPurchaseRequest,
  getMyPointsWallet,
  listActivePointPacks,
  listMyPointPurchaseRequests,
  listMyPointTransactions,
} from "../controllers/driverPointsController.js";

const router = express.Router();
router.use(requireSignIn);
router.get("/wallet", getMyPointsWallet);
router.get("/transactions", listMyPointTransactions);
router.get("/packs", listActivePointPacks);
router.post(
  "/purchase-requests",
  pointsPurchaseRequestRateLimit,
  createPointPurchaseRequest
);
router.get("/purchase-requests", listMyPointPurchaseRequests);

export default router;
