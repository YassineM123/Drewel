import apiClient from "../client";
import { buildListParams, compactParams, toPagination } from "../query";

export const getDrivers = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/drivers", {
    params: compactParams(buildListParams(params)),
    signal,
  });
  return { drivers: data.drivers || [], pagination: toPagination(data) };
};

export const getDriverDetail = async (driverId: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`/admin/driver/${encodeURIComponent(driverId)}`, { signal });
  return data.driver || data;
};

export const getOnlineDrivers = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/drivers/online", { signal });
  return data.drivers || [];
};

export const getDriversWithLocation = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/drivers/location", { signal });
  return data.drivers || [];
};

export const updateDriverStatus = async (driverId: string, payload: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.put(
    `/admin/driver/${encodeURIComponent(driverId)}/status`,
    payload,
    { signal },
  );
  return data.driver || data;
};

export const updateDriverRestriction = async (driverId: string, action: string, payload: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.post(
    `/admin/driver/${encodeURIComponent(driverId)}/${action}`,
    { ...payload, confirmation: true },
    { signal },
  );
  return data.driver || data;
};

export const addDriver = async (formData: FormData, signal?: AbortSignal) => {
  const data = await apiClient.post("/driver/addDriver", formData, {
    signal,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.driver || data;
};

export const driversErrorMessage = (error: unknown, fallback = "Unable to load drivers."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;
