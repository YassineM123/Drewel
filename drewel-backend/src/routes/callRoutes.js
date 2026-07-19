import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireSignIn } from "../middlewares/authMiddleware.js";
import { actOnCall, getCall, initiate, token } from "../controllers/callController.js";

const router = express.Router();
router.use(requireSignIn);
const callLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?._id || "anonymous"}:${ipKeyGenerator(req.ip)}`,
  message: { success: false, code: "CALL_RATE_LIMITED", message: "Too many call requests" },
});
router.post("/initiate", callLimiter, initiate);
router.get("/:callId", getCall);
router.post("/:callId/accept", callLimiter, actOnCall("accept"));
router.post("/:callId/connected", callLimiter, actOnCall("connected"));
router.post("/:callId/decline", callLimiter, actOnCall("decline"));
router.post("/:callId/cancel", callLimiter, actOnCall("cancel"));
router.post("/:callId/end", callLimiter, actOnCall("end"));
router.post("/:callId/token", callLimiter, token);
export default router;
