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
 * Supports q (search), status, unread=true, reported=true filters.
 */
export const getChatThreads = async (params, signal) => {
  const data = await apiClient.get("/admin/chat/threads", {
    params: compactParams(params),
    signal,
  });
  return data;
};

/**
 * Authorized message inspection — GET /api/admin/chat/threads/:id/messages
 * Returns the message list (text, sender role, status, timestamps) plus the
 * conversation metadata and any linked support reports. Admins only.
 */
export const getConversationMessages = async (threadId, params, signal) => {
  const data = await apiClient.get(
    `/admin/chat/threads/${encodeURIComponent(threadId)}/messages`,
    { params: compactParams(params), signal },
  );
  return data;
};

/**
 * Internal admin note — POST /api/admin/chat/threads/:id/note { note }
 * Audited; the note is never sent to ride participants.
 */
export const addConversationNote = async (threadId, note, signal) => {
  const data = await apiClient.post(
    `/admin/chat/threads/${encodeURIComponent(threadId)}/note`,
    { note },
    { signal },
  );
  return data;
};

export const chatErrorMessage = (error, fallback = "Unable to load chat metadata.") =>
  error?.response?.data?.message || error?.message || fallback;