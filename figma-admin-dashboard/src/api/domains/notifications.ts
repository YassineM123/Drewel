import apiClient from "../client";
import { compactParams, toPagination } from "../query";

export const getAdminNotifications = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/notifications", {
    params: compactParams(params),
    signal,
  });
  return {
    notifications: data.notifications || data.items || [],
    pagination: toPagination(data),
  };
};

export const sendAdminNotification = async (payload: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.post("/admin/notifications/send", payload, { signal });
  return data;
};

export const notificationsErrorMessage = (error: unknown, fallback = "Unable to send notification."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;
