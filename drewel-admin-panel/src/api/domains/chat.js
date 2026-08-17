import apiClient from "../client";
import { compactParams } from "../query";

/**
 * Chat metadata — GET /api/admin/chat/metadata
 * Backend returns conversation/thread counts, unread totals and message
 * volume without exposing message bodies.
 */
export const getChatMetadata = async (signal) => {
  const data = await apiClient.get("/admin/chat/metadata", { signal });
  return data.metadata || data;
};

/**
 * Admin conversation threads — GET /api/admin/chat/threads (paginated)
 * Aggregates personal + ride conversations for the admin communications page.
 */
export const getChatThreads = async (params, signal) => {
  const data = await apiClient.get("/admin/chat/threads", {
    params: compactParams(params),
    signal,
  });
  return data;
};

export const chatErrorMessage = (error, fallback = "Unable to load chat metadata.") =>
  error?.response?.data?.message || error?.message || fallback;