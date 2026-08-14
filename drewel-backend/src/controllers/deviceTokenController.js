import mongoose from "mongoose";
import { resolvePrincipal } from "../services/rideCommunicationPolicy.js";
import {
  getActiveDeviceTokens,
  registerDeviceToken,
  unregisterDeviceToken,
} from "../services/notificationService.js";

const DEVICE_PLATFORMS = ["android", "ios", "web", "unknown"];

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({
    success: false,
    code: error.code || "INTERNAL_ERROR",
    message: error.statusCode ? error.message : "Internal server error",
  });

/**
 * Registers the push token for the signed-in principal. The recipient is
 * always derived from the authenticated session — a client can never register
 * a token for another user.
 */
export const register = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { token, platform = "unknown", deviceId = "", appVersion = "" } = req.body || {};
    const normalizedPlatform = DEVICE_PLATFORMS.includes(String(platform).toLowerCase())
      ? String(platform).toLowerCase()
      : "unknown";
    const result = await registerDeviceToken({
      userId: principal.id,
      userType: principal.role,
      token: String(token || ""),
      platform: normalizedPlatform,
      deviceId: String(deviceId || ""),
      appVersion: String(appVersion || ""),
    });
    if (!result.registered) {
      return res.status(400).json({
        success: false,
        code: result.reason || "TOKEN_REGISTRATION_FAILED",
        message: "Unable to register this device for notifications",
      });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

export const unregister = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const { token } = req.body || {};
    const result = await unregisterDeviceToken({
      userId: principal.id,
      token: String(token || ""),
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

export const listMine = async (req, res) => {
  try {
    const principal = await resolvePrincipal(req.user?._id);
    const tokens = await getActiveDeviceTokens(principal.id);
    return res.status(200).json({
      success: true,
      tokens: tokens.map((entry) => ({
        id: String(entry._id),
        platform: entry.platform,
        deviceId: entry.deviceId,
        lastUsedAt: entry.lastUsedAt,
        tokenTail: String(entry.token).slice(-8),
      })),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const adminList = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ success: false, message: "Valid user ID required" });
    }
    const tokens = await getActiveDeviceTokens(req.params.userId);
    return res.status(200).json({
      success: true,
      tokens: tokens.map((entry) => ({
        id: String(entry._id),
        platform: entry.platform,
        deviceId: entry.deviceId,
        lastUsedAt: entry.lastUsedAt,
        tokenTail: String(entry.token).slice(-8),
      })),
    });
  } catch (error) {
    return sendError(res, error);
  }
};
