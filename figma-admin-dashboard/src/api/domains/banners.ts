import apiClient from "../client";
import { compactParams, toPagination } from "../query";

export const getBanners = async (signal?: AbortSignal) => {
  const data = await apiClient.get("/banner/get-all", { signal });
  return data.banners || [];
};

export const getBanner = async (bannerId: string, signal?: AbortSignal) => {
  const data = await apiClient.get(`/banner/${encodeURIComponent(bannerId)}`, { signal });
  return data.banner || data;
};

export const addBanner = async (formData: FormData, signal?: AbortSignal) => {
  const data = await apiClient.post("/banner/add-banner", formData, {
    signal,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.banner || data;
};

export const updateBanner = async (bannerId: string, formData: FormData, signal?: AbortSignal) => {
  const data = await apiClient.put(
    `/banner/update/${encodeURIComponent(bannerId)}`,
    formData,
    { signal, headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.banner || data;
};

export const deleteBanner = async (bannerId: string, signal?: AbortSignal) => {
  const data = await apiClient.delete(`/banner/delete/${encodeURIComponent(bannerId)}`, { signal });
  return data;
};

export const toggleBannerStatus = async (bannerId: string, active: boolean, signal?: AbortSignal) => {
  const data = await apiClient.patch(
    `/banner/status/${encodeURIComponent(bannerId)}`,
    { active },
    { signal },
  );
  return data.banner || data;
};

export const recordBannerImpression = async (bannerId: string, signal?: AbortSignal) => {
  const data = await apiClient.post(`/banner/${encodeURIComponent(bannerId)}/impression`, null, { signal });
  return data;
};

export const recordBannerClick = async (bannerId: string, signal?: AbortSignal) => {
  const data = await apiClient.post(`/banner/${encodeURIComponent(bannerId)}/click`, null, { signal });
  return data;
};

export const getContentAudits = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const data = await apiClient.get("/admin/content-audits", {
    params: compactParams(params),
    signal,
  });
  return { items: data.items || [], pagination: toPagination(data) };
};

export const bannersErrorMessage = (error: unknown, fallback = "Unable to load banners."): string =>
  (error as Record<string, unknown>)?.response && ((error as Record<string, unknown>).response as Record<string, unknown>)?.data && (((error as Record<string, unknown>).response as Record<string, unknown>).data as Record<string, unknown>)?.message as string || (error as Record<string, unknown>)?.message as string || fallback;

export const getBannersPaged = async (params?: Record<string, unknown>, signal?: AbortSignal) => {
  const banners = await getBanners(signal);
  const page = Number(params?.page || 1);
  const limit = Number(params?.limit || banners.length || 1);
  const start = (page - 1) * limit;
  return {
    banners: banners.slice(start, start + limit),
    pagination: toPagination({ pagination: { page, limit, total: banners.length } }),
  };
};
