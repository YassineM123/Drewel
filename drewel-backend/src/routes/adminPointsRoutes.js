import express from "express";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import {
  requirePointsAdjustment,
  requirePointsPurchaseRequestManagement,
  requirePointsRead,
  requirePointsOwner,
} from "../middlewares/pointsAuthorization.js";
import {
  pointsAdminAdjustmentRateLimit,
  pointsAdminReadRateLimit,
  pointsSettingsMutationRateLimit,
} from "../middlewares/pointsRateLimit.js";
import {
  createPointPack,
  creditVerifiedPointPurchaseRequest,
  creditDriverPoints,
  debitDriverPoints,
  getDriverPointDetails,
  getPointSettings,
  getPointsOverview,
  listDriverPointWallets,
  listPointPacks,
  listPointPurchaseRequests,
  listPointTransactions,
  updatePointPack,
  updatePointPurchaseRequest,
  updatePointSettings,
} from "../controllers/adminPointsController.js";
import { listPointsAdminAudits } from "../controllers/pointsAdminAuditController.js";

const router = express.Router();
router.use(requireSignIn);

router.get(
  "/overview",
  pointsAdminReadRateLimit,
  requirePointsRead,
  getPointsOverview
);
router.get(
  "/drivers",
  pointsAdminReadRateLimit,
  requirePointsRead,
  listDriverPointWallets
);
router.get(
  "/drivers/:driverId",
  pointsAdminReadRateLimit,
  requirePointsRead,
  getDriverPointDetails
);
router.get(
  "/transactions",
  pointsAdminReadRateLimit,
  requirePointsRead,
  listPointTransactions
);
router.get(
  "/audits",
  pointsAdminReadRateLimit,
  requirePointsRead,
  listPointsAdminAudits
);
router.get(
  "/purchase-requests",
  pointsAdminReadRateLimit,
  requirePointsPurchaseRequestManagement,
  listPointPurchaseRequests
);
router.patch(
  "/purchase-requests/:id",
  pointsAdminAdjustmentRateLimit,
  requirePointsPurchaseRequestManagement,
  updatePointPurchaseRequest
);
router.post(
  "/purchase-requests/:id/credit",
  pointsAdminAdjustmentRateLimit,
  requirePointsAdjustment,
  creditVerifiedPointPurchaseRequest
);
router.post(
  "/credit",
  pointsAdminAdjustmentRateLimit,
  requirePointsAdjustment,
  creditDriverPoints
);
router.post(
  "/debit",
  pointsAdminAdjustmentRateLimit,
  requirePointsAdjustment,
  debitDriverPoints
);
router.get("/settings", requirePointsRead, getPointSettings);
router.patch(
  "/settings",
  pointsSettingsMutationRateLimit,
  requirePointsOwner,
  updatePointSettings
);
router.get("/packs", requirePointsRead, listPointPacks);
router.post(
  "/packs",
  pointsSettingsMutationRateLimit,
  requirePointsOwner,
  createPointPack
);
router.patch(
  "/packs/:id",
  pointsSettingsMutationRateLimit,
  requirePointsOwner,
  updatePointPack
);

export default router;
