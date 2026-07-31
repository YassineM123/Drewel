import express from "express";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import { pointsOfferRateLimit } from "../middlewares/pointsRateLimit.js";
import {
  acceptOffer,
  cancelOffer,
  declineOffer,
  getTripOffer,
  listMyTripOffers,
  sendTripOffer,
} from "../controllers/tripOfferController.js";

const router = express.Router();
router.use(requireSignIn);
router.post("/", pointsOfferRateLimit, sendTripOffer);
router.get("/mine", listMyTripOffers);
router.get("/incoming", listMyTripOffers);
router.get("/:offerId", getTripOffer);
router.post("/:offerId/accept", pointsOfferRateLimit, acceptOffer);
router.post("/:offerId/decline", pointsOfferRateLimit, declineOffer);
router.post("/:offerId/cancel", pointsOfferRateLimit, cancelOffer);

export default router;
