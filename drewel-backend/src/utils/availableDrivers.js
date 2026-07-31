export const AVAILABLE_DRIVER_FIELDS =
  "firstName lastName fullName profileImageUrl city vehicleType vehicleModel registration registrationVisible rating priceEstimate lat long isOnline availabilityStatus status updatedAt";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactCaseInsensitiveMatch = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed ? { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") } : null;
};

export const buildAvailableDriverFilter = (query = {}) => {
  const filter = {
    isOnline: true,
    availabilityStatus: { $ne: "Busy" },
    isApproved: true,
    isRestricted: false,
    isDeleted: { $ne: true },
    // Drivers created before the staged request workflow have neither status
    // field. Keep those already-approved accounts discoverable while explicit
    // pending/approved/rejected workflow records remain excluded.
    $or: [
      { status: "completed" },
      { status: null, profileRequestStatus: null },
    ],
  };

  const cityMatch = exactCaseInsensitiveMatch(query.city);
  if (cityMatch) filter.city = cityMatch;

  const vehicleTypeMatch = exactCaseInsensitiveMatch(query.vehicleType);
  if (vehicleTypeMatch) filter.vehicleType = vehicleTypeMatch;

  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.priceEstimate = {};
    if (Number.isFinite(minPrice) && minPrice >= 0) filter.priceEstimate.$gte = minPrice;
    if (Number.isFinite(maxPrice) && maxPrice >= 0) filter.priceEstimate.$lte = maxPrice;
    if (!Object.keys(filter.priceEstimate).length) delete filter.priceEstimate;
  }

  return filter;
};

export const parseDriverDiscoveryQuery = (query = {}) => {
  const availability = String(query.availability || "online").trim().toLowerCase();
  if (!["online", "available"].includes(availability)) {
    const error = new Error("availability must be online or available");
    error.statusCode = 400;
    error.code = "INVALID_DRIVER_FILTER";
    throw error;
  }
  const parseBounded = (name, min, max) => {
    if (query[name] === undefined || query[name] === "") return null;
    const value = Number(query[name]);
    if (!Number.isFinite(value) || value < min || value > max) {
      const error = new Error(`${name} must be between ${min} and ${max}`);
      error.statusCode = 400;
      error.code = "INVALID_DRIVER_FILTER";
      throw error;
    }
    return value;
  };
  const minPrice = parseBounded("minPrice", 0, 1_000_000);
  const maxPrice = parseBounded("maxPrice", 0, 1_000_000);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    const error = new Error("minPrice cannot exceed maxPrice");
    error.statusCode = 400;
    error.code = "INVALID_DRIVER_FILTER";
    throw error;
  }
  return {
    lat: parseBounded("lat", -90, 90),
    long: parseBounded("long", -180, 180),
    maxDistanceKm: parseBounded("maxDistanceKm", 0.1, 500),
    limit: Math.trunc(parseBounded("limit", 1, 100) ?? 50),
  };
};

export const distanceKmBetween = (lat1, long1, lat2, long2) => {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLong = radians(long2 - long1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
      Math.sin(dLong / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const toAvailableDriverDto = (driver, origin = {}) => {
  const value = typeof driver?.toObject === "function" ? driver.toObject() : driver;
  const hasOrigin = Number.isFinite(origin.lat) && Number.isFinite(origin.long);
  const hasDriverLocation = Number.isFinite(value?.lat) && Number.isFinite(value?.long);
  const distanceKm = hasOrigin && hasDriverLocation
    ? distanceKmBetween(origin.lat, origin.long, value.lat, value.long)
    : null;
  return {
    id: String(value._id),
    firstName: value.firstName || String(value.fullName || "").trim().split(/\s+/)[0] || "",
    fullName: value.fullName || [value.firstName, value.lastName].filter(Boolean).join(" ").trim(),
    profileImageUrl: value.profileImageUrl || "",
    city: value.city || "",
    vehicleType: value.vehicleType || "",
    vehicleModel: value.vehicleModel || "",
    registration: value.registrationVisible ? value.registration || "" : null,
    rating: Number.isFinite(value.rating) ? value.rating : null,
    priceEstimate: Number.isFinite(value.priceEstimate) ? value.priceEstimate : null,
    lat: value.lat,
    long: value.long,
    status: value.availabilityStatus === "Busy"
      ? "Busy"
      : value.isOnline ? "Online" : "Offline",
    availabilityStatus: value.availabilityStatus === "Busy"
      ? "Busy"
      : value.isOnline ? "Online" : "Offline",
    isAvailable: value.isOnline === true && value.availabilityStatus !== "Busy",
    distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
    updatedAt: value.updatedAt,
  };
};
