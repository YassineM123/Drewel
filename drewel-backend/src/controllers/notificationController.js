import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import {
  dispatchNotification,
  emitNotificationNew,
  isActionableType,
  pushPriorityForType,
} from "../services/notificationService.js";

const VALID_FILTERS = ["all", "rides", "messages", "system"];
const TYPE_GROUPS = {
  rides: /^(RIDE_|OFFER|TRIP_OFFER|NEW_RIDE|DRIVER_ARRIVED)/,
  messages: /^(RIDE_MESSAGE|CHAT)/,
  system: /^(GENERAL|SYSTEM|POINTS|DOCUMENT|DRIVER_ACCOUNT|ACCOUNT|SECURITY)/,
};

const groupForType = (type) => {
  const t = String(type || "").toUpperCase();
  if (TYPE_GROUPS.rides.test(t)) return "rides";
  if (TYPE_GROUPS.messages.test(t)) return "messages";
  return "system";
};

export const sendNotification = async (userId, message) => {
  if (!userId || !message) {
    return { success: false, message: "User ID and message are required" };
  }
  try {
    const notification = await dispatchNotification({
      recipientId: userId,
      recipientType: "user",
      type: "GENERAL",
      message: String(message),
      deepLink: "drewel://notifications",
    });
    if (!notification) {
      return { success: false, message: "Failed to send notification" };
    }
    return { success: true, message: "Notification sent successfully", notification };
  } catch (error) {
    console.error("Error sending notification:", error);
    return {
      success: false,
      message: "Failed to send notification",
      error: error.message,
    };
  }
};

export const getNotifications = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res
      .status(200)
      .json({ success: false, message: "User ID is required" });
  }
  try {
    const filterValue = String(req.query.filter || "all").trim().toLowerCase();
    const filter =
      VALID_FILTERS.includes(filterValue) ? filterValue : "all";
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || "50", 10) || 50));

    const baseFilter = { userId, isValid: true };
    if (filter !== "all") {
      const types = await Notification.distinct("type", baseFilter);
      const groupTypes = types.filter((type) => groupForType(type) === filter);
      baseFilter.type = { $in: groupTypes };
    }

    const [notifications, total, unreadCount, latestUnread] = await Promise.all([
      Notification.find(baseFilter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(baseFilter),
      Notification.countDocuments({ userId, isValid: true, read: false }),
      Notification.findOne({ userId, isValid: true, read: false }).sort({
        createdAt: -1,
      }),
    ]);

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      lastUnreadAt: latestUnread?.createdAt ?? null,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.user?._id,
      isValid: true,
      read: false,
    });
    return res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread count",
      error: error.message,
    });
  }
};

export const markAsRead = async (req, res) => {
  const { notificationId } = req.params;
  if (!notificationId || mongoose.Types.ObjectId.isValid(notificationId) === false) {
    return res.status(200).json({
      success: false,
      message: "Please provide a valid notification ID",
    });
  }
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res
        .status(200)
        .json({ success: false, message: "Notification not found" });
    }
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isValid: true,
      read: false,
    });
    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
      unreadCount,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isValid: true, read: false },
      { read: true, readAt: new Date() }
    );
    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      unreadCount: 0,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

export const clearNotification = async (req, res) => {
  const { notificationId } = req.params;
  if (!notificationId || mongoose.Types.ObjectId.isValid(notificationId) === false) {
    return res.status(200).json({
      success: false,
      message: "Please provide a valid notification ID",
    });
  }
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: req.user._id },
      { isValid: false },
      { new: true }
    );
    if (!notification) {
      return res
        .status(200)
        .json({ success: false, message: "Notification not found" });
    }
    return res.status(200).json({ success: true, message: "Notification cleared" });
  } catch (error) {
    console.error("Error clearing notification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear notification",
      error: error.message,
    });
  }
};

export { emitNotificationNew, isActionableType, pushPriorityForType, groupForType };
