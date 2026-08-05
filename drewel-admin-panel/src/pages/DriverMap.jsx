import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import PropTypes from "prop-types";
import { useSocket } from "../context/SocketContext";
import { getDriversWithLocation } from "../utils/api";

const STATUS_COLORS = {
  Online: "#28a745",
  Busy: "#ffc107",
  Offline: "#6c757d",
};

const CENTER = [24.4539, 54.3773];

const buildDriverIcon = (driver) => {
  const status = driver.availabilityStatus || (driver.isOnline ? "Online" : "Offline");
  const color = STATUS_COLORS[status] || STATUS_COLORS.Offline;
  const initial = (
    (driver.fullName || `${driver.firstName || ""} ${driver.lastName || ""}`).trim() ||
    "D"
  )
    .charAt(0)
    .toUpperCase();
  return L.divIcon({
    className: "driver-map-marker",
    html: `<div class="driver-marker-pin" style="border-color:${color}"><span>${initial}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
};

const FitBounds = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (!bounds || bounds.length === 0) return;
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [bounds, map]);
  return null;
};

FitBounds.propTypes = {
  bounds: PropTypes.object,
};

const hasValidLocation = (driver) => {
  const lat = Number(driver.lat);
  const long = Number(driver.long);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(long) &&
    lat !== 0 &&
    long !== 0 &&
    lat >= -90 &&
    lat <= 90 &&
    long >= -180 &&
    long <= 180
  );
};

const statusLabel = (driver) =>
  driver.availabilityStatus || (driver.isOnline ? "Online" : "Offline");

const DriverMap = () => {
  const { socket, isConnected } = useSocket();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);
  const fetchInFlight = useRef(false);

  const fetchDrivers = async (silent = false) => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      if (!silent) {
        setLoading(true);
        setLoadError("");
      }
      const list = await getDriversWithLocation();
      setDrivers(list);
      setLastUpdate(new Date());
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to load driver locations.";
      if (!silent) setLoadError(message);
    } finally {
      fetchInFlight.current = false;
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit("driver-map:track", { on: true });

    const onLocation = (update) => {
      const driverId = String(update?.driverId);
      if (!driverId) return;
      setDrivers((prev) => {
        const index = prev.findIndex((driver) => String(driver._id) === driverId);
        if (index === -1) return prev;
        const next = prev.slice();
        next[index] = {
          ...next[index],
          lat: update.lat,
          long: update.long,
          locationUpdatedAt: update.locationUpdatedAt,
          availabilityStatus: update.availabilityStatus,
          isOnline: update.isOnline,
        };
        return next;
      });
      setLastUpdate(new Date());
    };

    const onAvailability = (update) => {
      const driverId = String(update?.driverId);
      if (!driverId) return;
      setDrivers((prev) => {
        const index = prev.findIndex((driver) => String(driver._id) === driverId);
        if (index === -1) return prev;
        const next = prev.slice();
        next[index] = {
          ...next[index],
          availabilityStatus: update.status || "Offline",
          isOnline: Boolean(update.isAvailable),
        };
        return next;
      });
    };

    socket.on("driver:location", onLocation);
    socket.on("driver:availability", onAvailability);

    return () => {
      socket.emit("driver-map:track", { on: false });
      socket.off("driver:location", onLocation);
      socket.off("driver:availability", onAvailability);
    };
  }, [socket, isConnected]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchDrivers(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleDrivers = useMemo(() => drivers.filter(hasValidLocation), [drivers]);

  const bounds = useMemo(() => {
    if (visibleDrivers.length === 0) return null;
    return L.latLngBounds(visibleDrivers.map((driver) => [driver.lat, driver.long]));
  }, [visibleDrivers]);

  const counts = useMemo(() => {
    return visibleDrivers.reduce(
      (acc, driver) => {
        const status = statusLabel(driver);
        if (status === "Busy") acc.busy += 1;
        else if (status === "Online") acc.online += 1;
        else acc.offline += 1;
        return acc;
      },
      { online: 0, busy: 0, offline: 0 }
    );
  }, [visibleDrivers]);

  return (
    <main className="app-content">
      <div className="app-title tile p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h1>Driver Live Map</h1>
          <p className="mb-0">
            {visibleDrivers.length} driver(s) shown · last update{" "}
            {lastUpdate ? lastUpdate.toLocaleTimeString() : "—"}
            {isConnected ? (
              <span className="text-success ms-2">● Live</span>
            ) : (
              <span className="text-danger ms-2">● Socket disconnected</span>
            )}
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <span>
            <span className="driver-legend-dot" style={{ background: STATUS_COLORS.Online }} />
            Online ({counts.online})
          </span>
          <span>
            <span className="driver-legend-dot" style={{ background: STATUS_COLORS.Busy }} />
            Busy ({counts.busy})
          </span>
          <span>
            <span className="driver-legend-dot" style={{ background: STATUS_COLORS.Offline }} />
            Offline ({counts.offline})
          </span>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => fetchDrivers(false)}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-danger text-center mt-3" role="alert">
          <div>{loadError}</div>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm mt-2"
            onClick={() => fetchDrivers(false)}
          >
            Retry
          </button>
        </div>
      )}

      <div className="tile mt-3 p-0 overflow-hidden" style={{ minHeight: 480 }}>
        {loading ? (
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ minHeight: 480 }}
          >
            <div className="loader" />
          </div>
        ) : (
          <MapContainer
            center={CENTER}
            zoom={11}
            style={{ height: 640, width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds bounds={bounds} />
            {visibleDrivers.map((driver) => (
              <Marker
                key={String(driver._id)}
                position={[driver.lat, driver.long]}
                icon={buildDriverIcon(driver)}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>
                      {driver.fullName ||
                        `${driver.firstName || ""} ${driver.lastName || ""}`.trim() ||
                        "Driver"}
                    </strong>
                    <div className="text-muted small">
                      {driver.vehicleType || "Unknown vehicle"}
                      {driver.vehicleModel ? ` · ${driver.vehicleModel}` : ""}
                      {driver.registration ? ` · ${driver.registration}` : ""}
                    </div>
                    <div>
                      <span
                        className={`badge ${
                          statusLabel(driver) === "Online"
                            ? "badge-success"
                            : statusLabel(driver) === "Busy"
                              ? "badge-warning"
                              : "badge-secondary"
                        }`}
                      >
                        {statusLabel(driver)}
                      </span>
                    </div>
                    <div className="small mt-1">{driver.whatsappNumber || driver.phone || ""}</div>
                    <div className="small text-muted">
                      {driver.locationUpdatedAt
                        ? `Updated ${new Date(driver.locationUpdatedAt).toLocaleTimeString()}`
                        : "No location update yet"}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </main>
  );
};

export default DriverMap;
