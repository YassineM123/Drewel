import apiClient from "../client";

export const getPointSettings = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/points/settings", { signal });
  return data.settings || data;
};

export const updatePointSettings = async (payload: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.patch(
    "/admin/points/settings",
    { ...payload, confirmation: true },
    { signal },
  );
  return data.settings || data;
};

export const getLegalContent = async (type: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`/account/legal/${encodeURIComponent(type)}`, { signal });
  return data.legal || data;
};

export const getAdminSettings = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/settings", { signal });
  return data.settings || data;
};

export const settingsErrorMessage = (error: unknown, fallback = "Unable to load settings."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;
