import express from "express";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import { messageRateLimit } from "../middlewares/marketplaceRateLimit.js";
import {
  conversationSummary,
  getConversationThread,
  listConversationThreads,
  readConversationThread,
} from "../controllers/conversationController.js";

const router = express.Router();
router.use(requireSignIn);
router.get("/", listConversationThreads);
router.get("/summary", conversationSummary);
router.get("/:rideId", getConversationThread);
router.post("/:rideId/read", messageRateLimit, readConversationThread);
export default router;
