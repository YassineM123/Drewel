import express from "express";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import {
  createSupportReport,
  deleteSavedPlace,
  getLegalContent,
  getPreferences,
  listSavedPlaces,
  updatePreferences,
  upsertSavedPlace,
} from "../controllers/accountController.js";

const router = express.Router();

// Public legal documents: shown during pre-login signup consent.
router.get("/legal/:type", getLegalContent);

router.use(requireSignIn);
router.get("/saved-places", listSavedPlaces);
router.post("/saved-places", upsertSavedPlace);
router.put("/saved-places/:placeId", upsertSavedPlace);
router.patch("/saved-places/:placeId", upsertSavedPlace);
router.delete("/saved-places/:placeId", deleteSavedPlace);
router.post("/saved-places/:placeId/delete", deleteSavedPlace);
router.get("/preferences", getPreferences);
router.patch("/preferences", updatePreferences);
router.post("/support-reports", createSupportReport);

export default router;
