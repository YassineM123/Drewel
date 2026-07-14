import { API_URL } from "./api";

export const normalizeAssetUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return "";

  const source = value.trim();
  if (["undefined", "null", "n/a"].includes(source.toLowerCase())) return "";
  if (/^(?:data|blob):/i.test(source) || typeof window === "undefined") return source;

  try {
    const apiOrigin = new URL(API_URL, window.location.origin).origin;
    const apiUrl = new URL(apiOrigin);
    const assetUrl = new URL(source, apiOrigin);
    const isApiAsset = assetUrl.pathname.startsWith("/api/");
    const isKnownHost =
      assetUrl.hostname === apiUrl.hostname || assetUrl.hostname === window.location.hostname;

    if (isApiAsset && isKnownHost) {
      assetUrl.protocol = apiUrl.protocol;
      assetUrl.host = apiUrl.host;
    } else if (
      window.location.protocol === "https:" &&
      assetUrl.protocol === "http:" &&
      assetUrl.hostname === window.location.hostname
    ) {
      assetUrl.protocol = "https:";
    }

    return assetUrl.toString();
  } catch {
    return source;
  }
};

export const isTrustedApiAssetUrl = (value) => {
  if (typeof window === "undefined") return false;
  const normalized = normalizeAssetUrl(value);
  if (!normalized || /^(?:data|blob):/i.test(normalized)) return false;

  try {
    const apiOrigin = new URL(API_URL, window.location.origin).origin;
    const assetUrl = new URL(normalized);
    return assetUrl.origin === apiOrigin && assetUrl.pathname.startsWith("/api/");
  } catch {
    return false;
  }
};
