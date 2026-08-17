import apiClient from "../client";
import { compactParams, toPagination } from "../query";

/**
 * Sponsor banners — /api/banner/* (CRUD).
 * The backend keeps banners in their own router; the admin panel manages them
 * through the authenticated banner endpoints.
 */
export const getBanners = async (signal) => {
  const data = await apiClient.get("/banner/get-all", { signal });
  return data.banners || [];
};

export const getBanner = async (bannerId, signal) => {
  const data = await apiClient.get(`/banner/${encodeURIComponent(bannerId)}`, { signal });
  return data.banner || data;
};

/** Add a banner (multipart image) — POST /api/banner/add-banner */
export const addBanner = async (formData, signal) => {
  const data = await apiClient.post("/banner/add-banner", formData, {
    signal,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.banner || data;
};

/** Update a banner (multipart image optional) — PUT /api/banner/update/:id */
export const updateBanner = async (bannerId, formData, signal) => {
  const data = await apiClient.put(
    `/banner/update/${encodeURIComponent(bannerId)}`,
    formData,
    { signal, headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.banner || data;
};

export const deleteBanner = async (bannerId, signal) => {
  const data = await apiClient.delete(`/banner/delete/${encodeURIComponent(bannerId)}`, { signal });
  return data;
};

export const bannersErrorMessage = (error, fallback = "Unable to load banners.") =>
  error?.response?.data?.message || error?.message || fallback;

/** Retained for compatibility with list-shaped callers. */
export const getBannersPaged = async (params, signal) => {
  const banners = await getBanners(signal);
  const page = Number(params?.page || 1);
  const limit = Number(params?.limit || banners.length || 1);
  const start = (page - 1) * limit;
  return {
    banners: banners.slice(start, start + limit),
    pagination: toPagination({ pagination: { page, limit, total: banners.length } }),
  };
};