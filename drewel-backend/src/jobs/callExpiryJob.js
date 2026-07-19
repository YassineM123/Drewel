import { io } from "../socket/index.js";
import { expireMissedCalls } from "../services/callSessionService.js";

export const runCallExpirySweep = async () => {
  const expiredCalls = await expireMissedCalls();
  for (const call of expiredCalls) {
    const payload = { callId: String(call._id), rideId: String(call.rideId), status: call.status, stateVersion: call.stateVersion };
    io.to(String(call.callerId)).to(String(call.receiverId)).emit("call:state", payload);
  }
  return expiredCalls.length;
};

export const startCallExpiryWatchdog = () => {
  const intervalMs = Math.min(60_000, Math.max(5_000, Number.parseInt(process.env.CALL_EXPIRY_SWEEP_INTERVAL_MS || "10000", 10) || 10_000));
  const timer = setInterval(() => {
    runCallExpirySweep().catch((error) => console.error("Call expiry sweep failed", error.message));
  }, intervalMs);
  timer.unref?.();
  return timer;
};
