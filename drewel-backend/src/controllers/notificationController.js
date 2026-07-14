import mongoose, { mongo } from "mongoose";
import Notification from "../models/Notification.js";

export const sendNotification = async (userId, message) => {
  if (!userId || !message) {
    return { success: false, message: "User ID and message are required" };
  }

  try {
    const notification = new Notification({ userId, message });
    await notification.save();

    return {
      success: true,
      message: "Notification sent successfully",
      notification,
    };
  } catch (error) {
    console.error("Error sending notification:", error);
    return {
      success: false,
      message: "Failed to send notification",
      error: error.message,
    };
  }
};
// sendNotification("682712d9fffb7002f1531bc0", "Test notification");

export const getNotifications = async (req, res) => {
  const userId = req.user._id;
  if (!userId) {
    return res
      .status(200)
      .json({ success: false, message: "User ID is required" });
  }
  if (userId && mongoose.Types.ObjectId.isValid(userId) === false) {
    return res
      .status(200)
      .json({ success: false, message: "Please provide a valid user ID" });
  }
  try {
    const notifications = await Notification.find({ userId, isValid: true }).sort({
      createdAt: -1,
    });
    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

export const markAsRead = async (req, res) => {
  const { notificationId } = req.params;

  if (
    !notificationId ||
    mongoose.Types.ObjectId.isValid(notificationId) === false
  ) {
    return res.status(200).json({
      success: false,
      message: "Please provide a valid notification ID",
    });
  }
  if (
    notificationId &&
    mongoose.Types.ObjectId.isValid(notificationId) === false
  ) {
    return res.status(200).json({
      success: false,
      message: "Please provide a valid notification ID",
    });
  }
  try {
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res
        .status(200)
        .json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
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
