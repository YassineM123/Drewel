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

/** Activate/deactivate a banner — PATCH /api/banner/status/:id (audited) */
export const toggleBannerStatus = async (bannerId, active, signal) => {
  const data = await apiClient.patch(
    `/banner/status/${encodeURIComponent(bannerId)}`,
    { active },
    { signal },
  );
  return data.banner || data;
};

/** Record a banner impression (public analytics hook) — POST /api/banner/:id/impression */
export const recordBannerImpression = async (bannerId, signal) => {
  const data = await apiClient.post(`/banner/${encodeURIComponent(bannerId)}/impression`, null, { signal });
  return data;
};

/** Record a banner click (public analytics hook) — POST /api/banner/:id/click */
export const recordBannerClick = async (bannerId, signal) => {
  const data = await apiClient.post(`/banner/${encodeURIComponent(bannerId)}/click`, null, { signal });
  return data;
};

/**
 * Content audit trail — GET /api/admin/content-audits
 * Append-only log of content changes (banner created/updated/activated/
 * deactivated/deleted, conversation note_added).
 */
export const getContentAudits = async (params, signal) => {
  const data = await apiClient.get("/admin/content-audits", {
    params: compactParams(params),
    signal,
  });
  return { items: data.items || [], pagination: toPagination(data) };
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