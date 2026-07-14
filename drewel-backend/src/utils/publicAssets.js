import path from "path";
import { getAllowedOrigins } from "./allowedOrigins.js";

export const DEFAULT_PROFILE_IMAGE_URL =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

const INTERNAL_ASSET_ROUTES = new Map([
  ["/api/users/get-image/", "user"],
  ["/api/banner/get-image/", "banner"],
]);

const configuredOrigin = () => {
  const configured = String(process.env.PUBLIC_API_URL || "").trim();
  if (!configured) return "";
  const url = new URL(configured);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("PUBLIC_API_URL must use http or https");
  }
  return url.origin;
};

export const validatePublicAssetConfig = () => {
  const origin = configuredOrigin();
  if (!origin && process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_API_URL is required when NODE_ENV=production");
  }
  for (const candidate of String(process.env.LEGACY_ASSET_ORIGINS || "").split(",")) {
    if (!candidate.trim()) continue;
    const url = new URL(candidate.trim());
    if (!new Set(["http:", "https:"]).has(url.protocol)) {
      throw new Error("LEGACY_ASSET_ORIGINS must contain absolute http(s) URLs");
    }
  }
  return origin;
};

export const getPublicOrigin = (req) => {
  const configured = configuredOrigin();
  if (configured) return configured;

  const protocol = req.protocol === "https" ? "https" : "http";
  const host = String(req.get("host") || "").trim();
  if (!host || !/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    throw new Error("Unable to determine a safe public API origin");
  }
  const requestHostname = host.replace(/:\d{1,5}$/, "").toLowerCase();
  const allowedHostnames = new Set(["localhost", "127.0.0.1"]);
  for (const origin of getAllowedOrigins()) {
    try {
      allowedHostnames.add(new URL(origin).hostname.toLowerCase());
    } catch {
      // CORS configuration validation is handled by its own caller. Invalid
      // entries are never promoted to trusted public asset hosts here.
    }
  }
  if (!allowedHostnames.has(requestHostname)) {
    throw new Error("Request host is not trusted for public asset URLs");
  }
  return `${protocol}://${host}`;
};

export const getPublicAssetReference = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  let parsed;
  try {
    parsed = new URL(value, "http://internal.invalid");
  } catch {
    return null;
  }

  const isRelative = value.trim().startsWith("/");
  if (!isRelative && !new Set(["http:", "https:"]).has(parsed.protocol)) return null;

  const pathname = parsed.pathname;

  for (const [routePrefix, type] of INTERNAL_ASSET_ROUTES) {
    if (!pathname.startsWith(routePrefix)) continue;
    try {
      const fileName = path.basename(decodeURIComponent(pathname.slice(routePrefix.length)));
      if (!fileName || fileName === "." || fileName === "..") return null;
      // These routes are owned by this API and files are addressed only by a
      // sanitized basename. Recognize their legacy absolute URLs regardless of
      // the old host so records saved behind a previous IP/port are upgraded to
      // PUBLIC_API_URL in responses. Arbitrary external image URLs are left as-is.
      return { type, routePrefix, fileName };
    } catch {
      return null;
    }
  }
  return null;
};

export const buildPublicAssetUrl = (req, routePrefix, fileName) =>
  `${getPublicOrigin(req)}${routePrefix}${encodeURIComponent(path.basename(fileName || ""))}`;

export const normalizePublicAssetUrl = (req, value) => {
  const reference = getPublicAssetReference(value);
  return reference
    ? buildPublicAssetUrl(req, reference.routePrefix, reference.fileName)
    : value;
};

// This response-only transform normalizes legacy HTTP origins without changing
// database records or adding any new public file access.
export const normalizePublicAssetReferences = (req, value, seen = new WeakSet()) => {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  const source = typeof value.toJSON === "function" ? value.toJSON() : value;
  if (source == null || typeof source !== "object") return source;
  if (Array.isArray(source)) {
    return source.map((item) => normalizePublicAssetReferences(req, item, seen));
  }

  const normalized = {};
  for (const [key, item] of Object.entries(source)) {
    normalized[key] =
      typeof item === "string" && getPublicAssetReference(item)
        ? normalizePublicAssetUrl(req, item)
        : normalizePublicAssetReferences(req, item, seen);
  }
  return normalized;
};

export const normalizeAssetResponses = (req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => sendJson(normalizePublicAssetReferences(req, body));
  next();
};
