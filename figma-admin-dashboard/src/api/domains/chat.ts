import apiClient from "../client";
import { compactParams } from "../query";

export const getChatMetadata = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/chat/metadata", { signal });
  return data.metadata || data;
};

export const getChatThreads = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/chat/threads", {
    params: compactParams(params),
    signal,
  });
  return data;
};

export const getConversationMessages = async (threadId: string, params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get(
    `/admin/chat/threads/${encodeURIComponent(threadId)}/messages`,
    { params: compactParams(params), signal },
  );
  return data;
};

export const addConversationNote = async (threadId: string, note: string, signal?: AbortSignal) => {
  const data = await apiClient.post(
    `/admin/chat/threads/${encodeURIComponent(threadId)}/note`,
    { note },
    { signal },
  );
  return data;
};

export const chatErrorMessage = (error: unknown, fallback = "Unable to load chat metadata."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;
