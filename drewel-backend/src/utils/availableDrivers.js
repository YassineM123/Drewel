import {
  DUBAI_SERVICE_AREA,
  TUNISIA_TEST_SERVICE_AREA,
  getTunisiaTestActorIds,
  getDriverLocationFutureSkewMs,
  getDriverLocationMaxAgeMs,
  getMarketplaceLocationMaxAccuracyM,
  getServiceAreaLocationMaxAccuracyM,
} from "./dubaiLocation.js";

export const AVAILABLE_DRIVER_FIELDS =
  "firstName lastName fullName profileImageUrl city vehicleType vehicleModel registration registrationVisible rating priceEstimate lat long currentLocation currentServiceArea locationUpdatedAt isOnline availabilityStatus status updatedAt";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactCaseInsensitiveMatch = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed ? { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") } : null;
};

export const buildAvailableDriverFilter = (query = {}) => {
  const filter = {
    isOnline: true,
    availabilityStatus: "Online",
    activeRideId: null,
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

export const buildFreshDubaiMarketplaceAvailabilityFilter = (
  query = {},
  now = new Date()
) => {
  const filter = buildAvailableDriverFilter(query);
  delete filter.city;
  return {
    ...filter,
    currentServiceArea: DUBAI_SERVICE_AREA,
    "currentLocation.type": "Point",
    locationUpdatedAt: {
      $gte: new Date(now.getTime() - getDriverLocationMaxAgeMs()),
      $lte: new Date(now.getTime() + getDriverLocationFutureSkewMs()),
    },
    locationAccuracyM: { $gte: 0, $lte: getMarketplaceLocationMaxAccuracyM() },
  };
};

export const buildFreshMarketplaceAvailabilityFilter = (
  query = {},
  now = new Date(),
  serviceArea = DUBAI_SERVICE_AREA
) => ({
  ...buildFreshDubaiMarketplaceAvailabilityFilter(query, now),
  currentServiceArea: serviceArea,
  locationAccuracyM: {
    $gte: 0,
    $lte: getServiceAreaLocationMaxAccuracyM(serviceArea),
  },
});

// Admin visibility mirrors the production marketplace, with one isolated
// exception: when Tunisia test mode is enabled, only explicitly allowlisted
// test drivers are added. UAE drivers remain visible through the normal branch.
export const buildFreshAdminMarketplaceAvailabilityFilter = (
  query = {},
  now = new Date()
) => {
  const uaeFilter = buildFreshDubaiMarketplaceAvailabilityFilter(query, now);
  const testDriverIds = getTunisiaTestActorIds("driver");
  if (!testDriverIds.length) return uaeFilter;

  return {
    $or: [
      uaeFilter,
      {
        ...buildFreshMarketplaceAvailabilityFilter(
          query,
          now,
          TUNISIA_TEST_SERVICE_AREA
        ),
        _id: { $in: testDriverIds },
      },
    ],
  };
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

export const buildDubaiDiscoveryAggregation = (
  query,
  options,
  now = new Date(),
  serviceArea = DUBAI_SERVICE_AREA
) => {
  const filter = buildFreshMarketplaceAvailabilityFilter(query, now, serviceArea);
  return [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [options.long, options.lat] },
        key: "currentLocation",
        distanceField: "distanceMeters",
        spherical: true,
        query: filter,
        ...(options.maxDistanceKm !== null ? { maxDistance: options.maxDistanceKm * 1000 } : {}),
      },
    },
    { $sort: { distanceMeters: 1, _id: 1 } },
    { $limit: options.limit },
    { $project: Object.fromEntries(AVAILABLE_DRIVER_FIELDS.split(/\s+/).map((field) => [field, 1]).concat([["distanceMeters", 1]])) },
  ];
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
  const aggregateDistance = Number(value?.distanceMeters);
  const isAvailable = value?.isOnline === true && value?.availabilityStatus === "Online";
  const distanceKm = Number.isFinite(aggregateDistance) ? aggregateDistance / 1000 : hasOrigin && hasDriverLocation
    ? distanceKmBetween(origin.lat, origin.long, value.lat, value.long)
    : null;
  return {
    id: String(value._id),
    firstName: value.firstName || String(value.fullName || "").trim().split(/\s+/)[0] || "",
    fullName: value.fullName || [value.firstName, value.lastName].filter(Boolean).join(" ").trim(),
    profileImageUrl: value.profileImageUrl || "",
    city: value.city || "",
    currentServiceArea: value.currentServiceArea || null,
    vehicleType: value.vehicleType || "",
    vehicleModel: value.vehicleModel || "",
    registration: value.registrationVisible ? value.registration || "" : null,
    rating: Number.isFinite(value.rating) ? value.rating : null,
    priceEstimate: Number.isFinite(value.priceEstimate) ? value.priceEstimate : null,
    lat: value.lat,
    long: value.long,
    status: value.availabilityStatus === "Busy" ? "Busy" : isAvailable ? "Online" : "Offline",
    availabilityStatus: value.availabilityStatus === "Busy" ? "Busy" : isAvailable ? "Online" : "Offline",
    isAvailable,
    distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
    updatedAt: value.updatedAt,
    locationUpdatedAt: value.locationUpdatedAt,
  };
};
