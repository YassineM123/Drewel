import express from "express";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import { createRideRequest, createSafetyAction, getActiveRide, getRide, listMyRides, listRideCalls, listRideMessages, sendRideMessage, transitionRide, updateMessageReceipt } from "../controllers/rideController.js";

const router = express.Router();
router.use(requireSignIn);
router.post("/", createRideRequest);
router.get("/active", getActiveRide);
router.get("/mine", listMyRides);
router.get("/:rideId", getRide);
router.patch("/:rideId/status", transitionRide);
router.get("/:rideId/calls", listRideCalls);
router.get("/:rideId/messages", listRideMessages);
router.post("/:rideId/messages", sendRideMessage);
router.patch("/:rideId/messages/:messageId/receipt", updateMessageReceipt);
router.post("/:rideId/report", createSafetyAction("report"));
router.post("/:rideId/block", createSafetyAction("block"));
export default router;
