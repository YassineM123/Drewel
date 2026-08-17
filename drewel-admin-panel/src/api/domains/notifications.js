import apiClient from "../client";
import { compactParams, toPagination } from "../query";

/**
 * Admin notifications — /api/admin/notifications
 * Broadcast + history for the admin Push Notification surface. Never sends
 * recipient device tokens to the browser.
 */
export const getAdminNotifications = async (params, signal) => {
  const data = await apiClient.get("/admin/notifications", {
    params: compactParams(params),
    signal,
  });
  return {
    notifications: data.notifications || data.items || [],
    pagination: toPagination(data),
  };
};

/**
 * Broadcast a push + in-app notification. `recipients` targets user / driver /
 * both; `message` and optional `title`/`type` are validated server-side.
 */
export const sendAdminNotification = async (payload, signal) => {
  const data = await apiClient.post("/admin/notifications/send", payload, { signal });
  return data;
};

export const notificationsErrorMessage = (error, fallback = "Unable to send notification.") =>
  error?.response?.data?.message || error?.message || fallback;