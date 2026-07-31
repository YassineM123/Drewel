import { RideTransitionError } from "./rideTransitionService.js";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const point = (value) => ({
  location: { latLng: { latitude: value.lat, longitude: value.long } },
});

export const computeRideRoute = async ({ ride, phase, driverLocation, signal }) => {
  const apiKey = String(process.env.GOOGLE_ROUTES_API_KEY || "").trim();
  if (!apiKey) {
    throw new RideTransitionError("Google Routes is not configured", 503, "ROUTES_NOT_CONFIGURED");
  }
  const origin =
    phase === "pickup"
      ? driverLocation || ride.lastDriverLocation
      : ride.pickup;
  const destination = phase === "pickup" ? ride.pickup : ride.destination;
  if (!Number.isFinite(origin?.lat) || !Number.isFinite(origin?.long)) {
    throw new RideTransitionError("Driver location is unavailable", 409, "DRIVER_LOCATION_UNAVAILABLE");
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
    throw new RideTransitionError("Route provider is temporarily unavailable", 502, "ROUTES_PROVIDER_FAILED");
  }
  if (!response.ok) {
    throw new RideTransitionError("Route provider is temporarily unavailable", 502, "ROUTES_PROVIDER_FAILED");
  }
  const payload = await response.json();
  const route = payload.routes?.[0];
  if (!route) {
    throw new RideTransitionError("No route is available", 404, "ROUTE_NOT_FOUND");
  }
  return {
    phase,
    distanceMeters: route.distanceMeters,
    duration: route.duration,
    staticDuration: route.staticDuration,
    encodedPolyline: route.polyline?.encodedPolyline || "",
    legs: route.legs || [],
    steps: (route.legs || []).flatMap((leg) => leg.steps || []),
    trafficAware: true,
    calculatedAt: new Date().toISOString(),
  };
};
