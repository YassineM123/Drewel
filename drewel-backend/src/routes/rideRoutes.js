import express from "express";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import { cancelRide, createDriverContact, confirmMission, createSafetyAction, getActiveRide, getRide, getRideMessageAudio, getRideRoute, listMyRides, listRideMessages, postRideLocation, sendRideMessage, sendRideVoiceMessage, submitRideReview, transitionRide, updateMessageReceipt } from "../controllers/rideController.js";
import { contactRateLimit, messageRateLimit, rideActionRateLimit, rideLocationRateLimit } from "../middlewares/marketplaceRateLimit.js";
import { chatAudioUpload, handleChatAudioUpload } from "../utils/chatAudioUpload.js";

const router = express.Router();
router.use(requireSignIn);
router.post("/contact", contactRateLimit, createDriverContact);
router.get("/active", getActiveRide);
router.get("/mine", listMyRides);
router.get("/:rideId", getRide);
router.post("/:rideId/confirm", contactRateLimit, confirmMission);
router.patch("/:rideId/status", rideActionRateLimit, transitionRide);
router.post("/:rideId/cancel", rideActionRateLimit, cancelRide);
router.post("/:rideId/review", rideActionRateLimit, submitRideReview);
router.get("/:rideId/route", getRideRoute);
router.post("/:rideId/location", rideLocationRateLimit, postRideLocation);
router.get("/:rideId/messages", listRideMessages);
router.post("/:rideId/messages", messageRateLimit, sendRideMessage);
router.post(
  "/:rideId/messages/voice",
  messageRateLimit,
  handleChatAudioUpload(chatAudioUpload.single("audio")),
  sendRideVoiceMessage
);
router.get("/:rideId/messages/:messageId/audio", getRideMessageAudio);
router.patch("/:rideId/messages/:messageId/receipt", updateMessageReceipt);
router.post("/:rideId/report", createSafetyAction("report"));
router.post("/:rideId/block", createSafetyAction("block"));
export default router;
