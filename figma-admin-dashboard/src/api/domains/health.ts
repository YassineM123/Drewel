import apiClient from "../client";

export const getSystemHealth = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/health", { signal });
  return data.health || data;
};

export const healthErrorMessage = (error: unknown, fallback = "Unable to load system health."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;
