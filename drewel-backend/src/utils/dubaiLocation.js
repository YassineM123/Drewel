import { readFileSync } from "node:fs";
import { canonicalLabelKey } from "./canonicalLabels.js";

export const UAE_SERVICE_AREA = "uae";
export const TUNISIA_TEST_SERVICE_AREA = "tunisia-test";
// Compatibility export for existing consumers while the module is renamed in
// a later cleanup. It now represents the UAE-wide marketplace boundary.
export const DUBAI_SERVICE_AREA = UAE_SERVICE_AREA;

const uaeBoundaryCollection = JSON.parse(readFileSync(
  new URL("../data/uae-adm0.geojson", import.meta.url),
  "utf8"
));
const uaeBoundaryFeature = uaeBoundaryCollection?.features?.[0];
if (uaeBoundaryFeature?.properties?.shapeID !== "71949806B80265631352184" ||
    uaeBoundaryFeature?.geometry?.type !== "MultiPolygon") {
  throw new Error("Pinned UAE ADM0 boundary is invalid");
}
export const UAE_SERVICE_MULTIPOLYGON = uaeBoundaryFeature.geometry.coordinates;
export const DUBAI_SERVICE_MULTIPOLYGON = UAE_SERVICE_MULTIPOLYGON;

// Deliberately runtime-gated and account-gated. This is a test geofence, not a
// claim that the rectangular bounds are a production-grade Tunisia boundary.
// The allowlists keep accidentally enabling the flag from opening a second
// public marketplace.
const TUNISIA_TEST_BOUNDS = Object.freeze({
  minLat: 30.2,
  maxLat: 37.6,
  minLong: 7.4,
  maxLong: 11.7,
});

const envEnabled = (name) => /^(1|true|yes|on)$/i.test(String(process.env[name] || "").trim());
const envIdSet = (name) => new Set(
  String(process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

export const getTunisiaTestActorIds = (actorType) => {
  const variable = actorType === "driver"
    ? "DREWEL_TUNISIA_TEST_DRIVER_IDS"
    : "DREWEL_TUNISIA_TEST_USER_IDS";
  return isTunisiaTestModeEnabled() ? [...envIdSet(variable)] : [];
};

export const isTunisiaTestModeEnabled = () => envEnabled("DREWEL_TUNISIA_TEST_MODE");

export const isTunisiaTestActorAllowed = (actorId, actorType) => {
  if (!isTunisiaTestModeEnabled() || !actorId) return false;
  return getTunisiaTestActorIds(actorType).includes(String(actorId));
};

export const isInsideTunisiaTestGeofence = (lat, long, accuracyM = 0) => {
  const latitudePadding = Number(accuracyM) / 111_320;
  const longitudePadding = Number(accuracyM) /
    (111_320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return lat - latitudePadding >= TUNISIA_TEST_BOUNDS.minLat &&
    lat + latitudePadding <= TUNISIA_TEST_BOUNDS.maxLat &&
    long - longitudePadding >= TUNISIA_TEST_BOUNDS.minLong &&
    long + longitudePadding <= TUNISIA_TEST_BOUNDS.maxLong;
};

const runtimeNumber = (name, fallback, min, max) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
};

// Runtime getters are intentional: loadEnv executes after ESM dependency loading.
export const getDriverLocationMaxAgeMs = () =>
  runtimeNumber("DRIVER_LOCATION_MAX_AGE_MS", 45_000, 15_000, 300_000);
export const getDriverLocationMaxFixAgeMs = () =>
  runtimeNumber("DRIVER_LOCATION_MAX_FIX_AGE_MS", 60_000, 15_000, 300_000);
export const getDriverLocationFutureSkewMs = () =>
  runtimeNumber("DRIVER_LOCATION_FUTURE_SKEW_MS", 30_000, 0, 60_000);
export const getMarketplaceLocationMaxAccuracyM = () =>
  runtimeNumber("MARKETPLACE_LOCATION_MAX_ACCURACY_METERS", 5_000, 10, 10_000);
export const getTunisiaTestLocationMaxAccuracyM = () =>
  runtimeNumber(
    "DREWEL_TUNISIA_TEST_LOCATION_MAX_ACCURACY_METERS",
    50_000,
    100,
    100_000
  );
export const getServiceAreaLocationMaxAccuracyM = (serviceArea) =>
  serviceArea === TUNISIA_TEST_SERVICE_AREA
    ? getTunisiaTestLocationMaxAccuracyM()
    : getMarketplaceLocationMaxAccuracyM();

export const validateCoordinates = (lat, long) => {
  if (!Number.isFinite(lat) || !Number.isFinite(long) || lat < -90 || lat > 90 || long < -180 || long > 180) {
    const error = new Error("lat and long must be valid GPS coordinates");
    error.statusCode = 400;
    error.code = "INVALID_COORDINATES";
    throw error;
  }
  return { lat, long };
};

const pointOnSegment = ([x, y], [x1, y1], [x2, y2]) => {
  const cross = (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1);
  if (Math.abs(cross) > 1e-10) return false;
  return x >= Math.min(x1, x2) && x <= Math.max(x1, x2) &&
    y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
};

export const pointInPolygon = (long, lat, polygon) => {
  if (!polygon) return pointInMultiPolygon(long, lat);
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (pointOnSegment([long, lat], polygon[j], polygon[i])) return true;
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > lat !== yj > lat &&
      long < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

const pointInPolygonWithHoles = (long, lat, rings) =>
  pointInPolygon(long, lat, rings[0]) &&
  !rings.slice(1).some((hole) => pointInPolygon(long, lat, hole));

export const pointInMultiPolygon = (long, lat, multiPolygon = DUBAI_SERVICE_MULTIPOLYGON) =>
  multiPolygon.some((polygon) => pointInPolygonWithHoles(long, lat, polygon));

const distanceToSegmentMeters = (long, lat, [long1, lat1], [long2, lat2]) => {
  const earthRadiusM = 6_371_000;
  const radians = Math.PI / 180;
  const cosLat = Math.cos(lat * radians);
  const x1 = (long1 - long) * radians * earthRadiusM * cosLat;
  const y1 = (lat1 - lat) * radians * earthRadiusM;
  const x2 = (long2 - long) * radians * earthRadiusM * cosLat;
  const y2 = (lat2 - lat) * radians * earthRadiusM;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / lengthSquared));
  return Math.hypot(x1 + t * dx, y1 + t * dy);
};

export const distanceToUaeBoundaryMeters = (long, lat) => {
  let minimum = Number.POSITIVE_INFINITY;
  for (const polygon of DUBAI_SERVICE_MULTIPOLYGON) {
    for (const ring of polygon) {
      for (let index = 1; index < ring.length; index += 1) {
        minimum = Math.min(minimum, distanceToSegmentMeters(long, lat, ring[index - 1], ring[index]));
      }
    }
  }
  return minimum;
};

// Geofencing removed: the marketplace is worldwide, so any valid GPS fix
// belongs to the single UAE_SERVICE_AREA bucket used by discovery/matching.
export const serviceAreaForCoordinates = (lat, long) => {
  validateCoordinates(lat, long);
  return UAE_SERVICE_AREA;
};

export const distanceToDubaiBoundaryMeters = distanceToUaeBoundaryMeters;

const validateRecordedAt = (recordedAt, now) => {
  if (recordedAt === undefined || recordedAt === null || recordedAt === "") {
    const error = new Error("recordedAt is required for every GPS fix");
    error.statusCode = 400;
    error.code = "LOCATION_TIMESTAMP_REQUIRED";
    throw error;
  }
  const fixTime = recordedAt instanceof Date ? recordedAt : new Date(recordedAt);
  if (!Number.isFinite(fixTime.getTime())) {
    const error = new Error("recordedAt must be a valid timestamp");
    error.statusCode = 400;
    error.code = "INVALID_LOCATION_TIMESTAMP";
    throw error;
  }
  const ageMs = now.getTime() - fixTime.getTime();
  if (ageMs > getDriverLocationMaxFixAgeMs()) {
    const error = new Error("GPS fix is too old");
    error.statusCode = 422;
    error.code = "STALE_LOCATION_FIX";
    throw error;
  }
  if (ageMs < -getDriverLocationFutureSkewMs()) {
    const error = new Error("GPS fix timestamp is in the future");
    error.statusCode = 422;
    error.code = "FUTURE_LOCATION_FIX";
    throw error;
  }
  return fixTime;
};

export const buildDriverLocationUpdate = (
  { lat, long, accuracyM, recordedAt, heading, speed },
  now = new Date(),
  context = {}
) => {
  validateCoordinates(lat, long);
  const fixTime = validateRecordedAt(recordedAt, now);
  const accuracy = Number(accuracyM);
  if (accuracyM === undefined || accuracyM === null) {
    const error = new Error("accuracyM is required for every GPS fix");
    error.statusCode = 400;
    error.code = "LOCATION_ACCURACY_REQUIRED";
    throw error;
  }
  if (!Number.isFinite(accuracy) || accuracy < 0) {
    const error = new Error("accuracyM must be a non-negative number");
    error.statusCode = 400;
    error.code = "INVALID_LOCATION_ACCURACY";
    throw error;
  }
  const currentServiceArea = serviceAreaForCoordinates(lat, long, accuracy, {
    ...context,
    actorType: "driver",
  });
  const maxAccuracyM = getServiceAreaLocationMaxAccuracyM(currentServiceArea);
  if (accuracy > maxAccuracyM) {
    const error = new Error(`accuracyM must be between 0 and ${maxAccuracyM} meters`);
    error.statusCode = 400;
    error.code = "INVALID_LOCATION_ACCURACY";
    throw error;
  }
  return {
    lat,
    long,
    ...(Number.isFinite(Number(heading)) ? { heading: Number(heading) } : {}),
    ...(Number.isFinite(Number(speed)) ? { speed: Number(speed) } : {}),
    currentLocation: { type: "Point", coordinates: [long, lat] },
    // Discovery freshness follows the GPS measurement, not heartbeat receipt.
    // Re-sending a cached fix therefore cannot keep a driver discoverable.
    locationUpdatedAt: fixTime,
    currentServiceArea,
    locationAccuracyM: accuracy,
  };
};

export const discoveryRoom = (serviceArea, vehicleType) => {
  const vehicle = canonicalLabelKey(vehicleType) || "all";
  return `discovery:${serviceArea}:${vehicle}`;
};
