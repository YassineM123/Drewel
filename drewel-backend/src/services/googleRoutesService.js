import { RideTransitionError } from "./rideTransitionService.js";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const AVERAGE_CITY_SPEED_MPS = 8.5;

const point = (value) => ({
  location: { latLng: { latitude: value.lat, longitude: value.long } },
});

const validPoint = (value) =>
  Number.isFinite(value?.lat) &&
  value.lat >= -90 &&
  value.lat <= 90 &&
  Number.isFinite(value?.long) &&
  value.long >= -180 &&
  value.long <= 180;

const distanceMetersBetween = (a, b) => {
  const radius = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLong = toRadians(b.long - a.long);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLong / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

const encodePolyline = (points) => {
  let previousLat = 0;
  let previousLong = 0;
  let encoded = "";
  const encodeValue = (value) => {
    let shifted = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (shifted >= 0x20) {
      chunk += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
      shifted >>= 5;
    }
    return chunk + String.fromCharCode(shifted + 63);
  };
  for (const item of points) {
    const lat = Math.round(item.lat * 1e5);
    const long = Math.round(item.long * 1e5);
    encoded += encodeValue(lat - previousLat);
    encoded += encodeValue(long - previousLong);
    previousLat = lat;
    previousLong = long;
  }
  return encoded;
};

const basicRoute = ({ phase, origin, destination, provider = "straight_line" }) => {
  const distanceMeters = distanceMetersBetween(origin, destination);
  const durationSeconds = Math.max(60, Math.round(distanceMeters / AVERAGE_CITY_SPEED_MPS));
  return {
    phase,
    distanceMeters,
    duration: `${durationSeconds}s`,
    staticDuration: `${durationSeconds}s`,
    durationSeconds,
    encodedPolyline: encodePolyline([origin, destination]),
    steps: [
      {
        instruction:
          phase === "pickup"
            ? "Follow the live route to pickup"
            : "Follow the live route to destination",
        distanceMeters,
        durationSeconds,
      },
    ],
    provider,
    trafficAware: false,
    fallback: true,
    calculatedAt: new Date().toISOString(),
  };
};

const osrmRoute = async ({ phase, origin, destination, signal }) => {
  const url =
    `${OSRM_URL}/${origin.long},${origin.lat};${destination.long},${destination.lat}` +
    "?overview=full&geometries=polyline&steps=true";
  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal: signal || AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
  } catch {
    return basicRoute({ phase, origin, destination });
  }
  if (!response.ok) return basicRoute({ phase, origin, destination });
  const payload = await response.json().catch(() => null);
  const route = payload?.routes?.[0];
  if (!route?.geometry) return basicRoute({ phase, origin, destination });
  const durationSeconds = Math.max(0, Math.round(Number(route.duration) || 0));
  const distanceMeters = Math.max(0, Math.round(Number(route.distance) || 0));
  return {
    phase,
    distanceMeters,
    duration: `${durationSeconds}s`,
    staticDuration: `${durationSeconds}s`,
    durationSeconds,
    encodedPolyline: route.geometry,
    steps: (route.legs || []).flatMap((leg) =>
      (leg.steps || []).map((step) => ({
        instruction: step.maneuver?.modifier
          ? `${step.maneuver.type || "Continue"} ${step.maneuver.modifier}`
          : step.name
            ? `Continue on ${step.name}`
            : "Continue",
        maneuver: step.maneuver?.type || "",
        distanceMeters: Math.round(Number(step.distance) || 0),
        durationSeconds: Math.round(Number(step.duration) || 0),
      }))
    ),
    provider: "osrm",
    trafficAware: false,
    fallback: true,
    calculatedAt: new Date().toISOString(),
  };
};

export const computeRideRoute = async ({ ride, phase, driverLocation, signal }) => {
  const liveDriverLocation = driverLocation || ride.lastDriverLocation;
  const origin =
    phase === "pickup"
      ? liveDriverLocation
      : liveDriverLocation || ride.pickup;
  const destination = phase === "pickup" ? ride.pickup : ride.destination;
  if (!validPoint(origin)) {
    throw new RideTransitionError("Driver location is unavailable", 409, "DRIVER_LOCATION_UNAVAILABLE");
  }
  if (!validPoint(destination)) {
    throw new RideTransitionError("Route destination is unavailable", 409, "ROUTE_DESTINATION_UNAVAILABLE");
  }
  const apiKey = String(process.env.GOOGLE_ROUTES_API_KEY || "").trim();
  if (!apiKey) {
    return osrmRoute({ phase, origin, destination, signal });
  }
  let response;
  try {
    response = await fetch(ROUTES_URL, {
      method: "POST",
      signal: signal || AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.navigationInstruction,routes.legs.steps.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: point(origin),
        destination: point(destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE_OPTIMAL",
        computeAlternativeRoutes: false,
        languageCode: "en",
        units: "METRIC",
      }),
    });
  } catch {
    return osrmRoute({ phase, origin, destination, signal });
  }
  if (!response.ok) {
    return osrmRoute({ phase, origin, destination, signal });
  }
  const payload = await response.json();
  const route = payload.routes?.[0];
  if (!route) {
    return osrmRoute({ phase, origin, destination, signal });
  }
  return {
    phase,
    distanceMeters: route.distanceMeters,
    duration: route.duration,
    staticDuration: route.staticDuration,
    encodedPolyline: route.polyline?.encodedPolyline || "",
    legs: route.legs || [],
    steps: (route.legs || []).flatMap((leg) => leg.steps || []),
    provider: "google_routes",
    trafficAware: true,
    fallback: false,
    calculatedAt: new Date().toISOString(),
  };
};
