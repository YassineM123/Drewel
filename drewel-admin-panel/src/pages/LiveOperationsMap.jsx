import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import {
  AlertTriangle, CircleDollarSign, Crosshair, Eye, History,
  MessageSquare, Navigation, RefreshCw, Search, SlidersHorizontal, UserRound,
} from "lucide-react";
import {
  getLiveOperationsMap,
  operationalErrorMessage,
  searchLiveOperationsMap,
} from "../api/domains/operational";
import { useSocket } from "../context/SocketContext";
import { Button, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from "../components/ui";
import SafeImage from "../components/SafeImage";

const DEFAULT_CENTER = [25.2048, 55.2708];
const STATUS_COLORS = {
  available: "#15803d",
  on_ride: "#be1b2c",
  busy: "#d97706",
  online: "#2563eb",
  offline: "#94a3b8",
};

const formatStatus = (value) => String(value || "unknown").replaceAll("_", " ");
const formatAge = (value) => {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time)) return "No GPS";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
};
const money = (value) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString()} AED` : "N/A";
const points = (value) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString()} pts` : "0 pts";
const title = (value) => String(value || "N/A");

const markerIcon = (driver, selected) => {
  const color = driver.gpsFreshness === "live"
    ? STATUS_COLORS[driver.availabilityStatus] || STATUS_COLORS.online
    : STATUS_COLORS.offline;
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: "live-map-driver-marker",
    html: `<span style="width:${size}px;height:${size}px;border-color:${color};background:${color}"><span>${driver.availabilityStatus === "on_ride" ? "R" : "D"}</span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const pointIcon = (label, color) => L.divIcon({
  className: "live-map-point-marker",
  html: `<span style="background:${color}">${label}</span>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapController({ selectedDriver, selectedRide, follow, onManualMove }) {
  const map = useMap();
  useMapEvents({ dragstart: onManualMove, zoomstart: onManualMove });
  useEffect(() => {
    const location = selectedDriver?.location;
    if (location) map.flyTo([location.lat, location.long], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [map, selectedDriver?.id]);
  useEffect(() => {
    const location = selectedDriver?.location;
    if (follow && location) map.setView([location.lat, location.long], Math.max(map.getZoom(), 15), { animate: true });
  }, [follow, map, selectedDriver?.location?.lat, selectedDriver?.location?.long]);
  useEffect(() => {
    if (!selectedRide || selectedDriver?.location) return;
    const point = selectedRide.pickup || selectedRide.destination;
    if (Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.long))) {
      map.flyTo([point.lat, point.long], 13, { duration: 0.8 });
    }
  }, [map, selectedRide?.id, selectedDriver?.location]);
  return null;
}

export default function LiveOperationsMap() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { socket, isConnected } = useSocket();
  const [snapshot, setSnapshot] = useState({ drivers: [], rides: [], alerts: [], totals: {}, settings: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState(params.get("driverId") || "");
  const [selectedRideId, setSelectedRideId] = useState(params.get("rideId") || "");
  const [filters, setFilters] = useState({ status: "all", vehicle: "all", lowPoints: false });
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [follow, setFollow] = useState(false);
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const data = await getLiveOperationsMap({}, controller.signal);
      setSnapshot(data);
      const requestedRide = params.get("rideId");
      if (requestedRide) setSelectedRideId(requestedRide);
      const requestedDriver = params.get("driverId") || data.rides.find((ride) => ride.id === requestedRide)?.driverId;
      if (requestedDriver) setSelectedDriverId(requestedDriver);
    } catch (err) {
      if (err?.code !== "ERR_CANCELED") setError(operationalErrorMessage(err, "Unable to load live operations."));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  useEffect(() => {
    if (!socket || !isConnected) return undefined;
    socket.emit("driver-map:track", { on: true });
    const onDriverLocation = (event) => {
      const driverId = String(event?.driverId || "");
      if (!driverId) return;
      setSnapshot((current) => ({
        ...current,
        drivers: current.drivers.map((driver) => String(driver.id) === driverId ? {
          ...driver,
          isOnline: Boolean(event.isOnline),
          rawAvailabilityStatus: event.availabilityStatus || driver.rawAvailabilityStatus,
          availabilityStatus: driver.currentRideId ? "on_ride" : event.availabilityStatus === "Busy" ? "busy" : event.isOnline ? "available" : "offline",
          gpsFreshness: "live",
          lastLocationAt: event.locationUpdatedAt,
          location: {
            lat: Number(event.lat),
            long: Number(event.long),
            heading: event.heading ?? null,
            speed: event.speed ?? null,
            accuracyM: event.locationAccuracyM ?? null,
            updatedAt: event.locationUpdatedAt,
          },
        } : driver),
      }));
    };
    const refreshRides = () => window.setTimeout(load, 250);
    socket.on("driver:location", onDriverLocation);
    socket.on("driver:presence", refreshRides);
    socket.on("ride:status_changed", refreshRides);
    return () => {
      socket.emit("driver-map:track", { on: false });
      socket.off("driver:location", onDriverLocation);
      socket.off("driver:presence", refreshRides);
      socket.off("ride:status_changed", refreshRides);
    };
  }, [socket, isConnected, load]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (search.trim().length < 2) return setResults([]);
      try {
        setResults(await searchLiveOperationsMap(search, controller.signal));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [search]);

  const driversById = useMemo(() => new Map(snapshot.drivers.map((driver) => [String(driver.id), driver])), [snapshot.drivers]);
  const ridesById = useMemo(() => new Map(snapshot.rides.map((ride) => [String(ride.id), ride])), [snapshot.rides]);
  const selectedRide = ridesById.get(selectedRideId) || null;
  const selectedDriver = driversById.get(selectedDriverId || selectedRide?.driverId) || null;
  const vehicleOptions = useMemo(() => [...new Set(snapshot.drivers.map((d) => d.vehicle?.type).filter(Boolean))].sort(), [snapshot.drivers]);
  const visibleDrivers = useMemo(() => snapshot.drivers.filter((driver) => {
    if (filters.status !== "all" && driver.availabilityStatus !== filters.status) return false;
    if (filters.vehicle !== "all" && driver.vehicle?.type !== filters.vehicle) return false;
    if (filters.lowPoints && !driver.points?.lowBalance) return false;
    return Boolean(driver.location);
  }), [snapshot.drivers, filters]);
  const visibleRides = useMemo(() => snapshot.rides.filter((ride) => !selectedRideId || ride.id === selectedRideId), [snapshot.rides, selectedRideId]);
  const center = selectedDriver?.location ? [selectedDriver.location.lat, selectedDriver.location.long] : DEFAULT_CENTER;

  const selectResult = (result) => {
    if (result.type === "driver") {
      setSelectedDriverId(result.driverId);
      setSelectedRideId("");
      setFollow(false);
    } else {
      setSelectedRideId(result.rideId);
      setSelectedDriverId(result.driverId || "");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Live Operations"
        description={`${snapshot.totals?.online || 0} drivers online / ${snapshot.totals?.activeRides || 0} active rides`}
        actions={<>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border ${isConnected ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500 live-pulse" : "bg-amber-500"}`} />
            {isConnected ? "Live" : "Reconnecting"}
          </span>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} onClick={load}>Refresh</Button>
        </>}
      />

      {error ? (
        <Card><ErrorState title="Live map unavailable" description={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} /></Card>
      ) : loading ? (
        <Card><LoadingState label="Loading live operations..." /></Card>
      ) : (
        <div className="live-ops-shell">
          <aside className="live-ops-panel">
            <Card className="p-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search driver, phone, plate, ride"
                  className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-700/20" />
              </div>
              {results.length > 0 && (
                <div className="mt-2 border border-slate-100 rounded-[10px] overflow-hidden">
                  {results.map((result) => (
                    <button key={`${result.type}:${result.id}`} type="button" onClick={() => selectResult(result)} className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0">
                      <p className="text-sm font-semibold text-slate-800">{result.label}</p>
                      <p className="text-xs text-slate-400">{result.type.toUpperCase()} / {result.subtitle || "No details"}</p>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3"><SlidersHorizontal size={15} /> Filters</div>
              <div className="grid grid-cols-1 gap-2">
                <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="h-9 border border-slate-200 rounded-[8px] px-2 text-sm">
                  {["all", "available", "on_ride", "busy", "offline"].map((value) => <option key={value} value={value}>{formatStatus(value)}</option>)}
                </select>
                <select value={filters.vehicle} onChange={(e) => setFilters((f) => ({ ...f, vehicle: e.target.value }))} className="h-9 border border-slate-200 rounded-[8px] px-2 text-sm">
                  <option value="all">All vehicles</option>
                  {vehicleOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={filters.lowPoints} onChange={(e) => setFilters((f) => ({ ...f, lowPoints: e.target.checked }))} />
                  Low balance drivers
                </label>
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-bold mb-3">Live Now</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Online", snapshot.totals?.online], ["Available", snapshot.totals?.available],
                  ["On Ride", snapshot.totals?.onRide], ["Busy", snapshot.totals?.busy],
                  ["Active Rides", snapshot.totals?.activeRides], ["Low Points", snapshot.totals?.lowBalance],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[8px] bg-slate-50 px-3 py-2">
                    <p className="text-lg font-bold text-slate-800">{Number(value || 0).toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-800">Live Drivers</div>
              <div className="max-h-[360px] overflow-auto">
                {visibleDrivers.length ? visibleDrivers.map((driver) => (
                  <button key={driver.id} type="button" onClick={() => { setSelectedDriverId(driver.id); setSelectedRideId(driver.currentRideId || ""); }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${selectedDriver?.id === driver.id ? "bg-red-50/60" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[driver.availabilityStatus] || STATUS_COLORS.online }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{title(driver.fullName)}</p>
                        <p className="text-xs text-slate-400 truncate">{driver.vehicle?.model || driver.vehicle?.type || "Vehicle"} / {points(driver.points?.available)} / {formatAge(driver.lastLocationAt)}</p>
                      </div>
                    </div>
                  </button>
                )) : <EmptyState title="No drivers match" description="Adjust filters or wait for live GPS." />}
              </div>
            </Card>
          </aside>

          <main className="live-ops-map-card">
            <MapContainer center={center} zoom={12} scrollWheelZoom className="live-ops-map">
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapController selectedDriver={selectedDriver} selectedRide={selectedRide} follow={follow} onManualMove={() => follow && setFollow(false)} />
              {visibleRides.map((ride) => (
                <Fragment key={ride.id}>
                  {Number.isFinite(Number(ride.pickup?.lat)) && <Marker position={[ride.pickup.lat, ride.pickup.long]} icon={pointIcon("P", "#2563eb")} />}
                  {Number.isFinite(Number(ride.destination?.lat)) && <Marker position={[ride.destination.lat, ride.destination.long]} icon={pointIcon("D", "#7c3aed")} />}
                  {Number.isFinite(Number(ride.pickup?.lat)) && Number.isFinite(Number(ride.destination?.lat)) && (
                    <Polyline positions={[[ride.pickup.lat, ride.pickup.long], [ride.destination.lat, ride.destination.long]]} pathOptions={{ color: "#be1b2c", weight: 3, dashArray: "6 8" }} />
                  )}
                </Fragment>
              ))}
              {visibleDrivers.map((driver) => (
                <Marker key={driver.id} position={[driver.location.lat, driver.location.long]} icon={markerIcon(driver, selectedDriver?.id === driver.id)}
                  eventHandlers={{ click: () => { setSelectedDriverId(driver.id); setSelectedRideId(driver.currentRideId || ""); } }}>
                  <Popup>
                    <strong>{title(driver.fullName)}</strong><br />
                    {formatStatus(driver.availabilityStatus)}<br />
                    {formatAge(driver.lastLocationAt)}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            <div className="live-ops-legend">
              {["available", "on_ride", "busy", "offline"].map((status) => (
                <span key={status}><i style={{ background: STATUS_COLORS[status] }} />{formatStatus(status)}</span>
              ))}
            </div>
          </main>

          <aside className="live-ops-details">
            {selectedDriver ? (
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <SafeImage src={selectedDriver.profileImageUrl} alt={selectedDriver.fullName || "Driver"} fallbackLabel={(selectedDriver.fullName || "D").slice(0, 2)} className="w-12 h-12 rounded-full object-cover bg-slate-100" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">{title(selectedDriver.fullName)}</h3>
                    <p className="text-xs text-slate-400">Driver #{selectedDriver.id.slice(-6).toUpperCase()}</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: STATUS_COLORS[selectedDriver.availabilityStatus] }}>{formatStatus(selectedDriver.availabilityStatus)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                  <Info label="Phone" value={selectedDriver.phone || "N/A"} />
                  <Info label="Rating" value={selectedDriver.rating ? `${selectedDriver.rating} star` : "N/A"} />
                  <Info label="Vehicle" value={[selectedDriver.vehicle?.type, selectedDriver.vehicle?.model].filter(Boolean).join(" ") || "N/A"} />
                  <Info label="Plate" value={selectedDriver.vehicle?.plateNumber || "N/A"} />
                  <Info label="Points" value={points(selectedDriver.points?.available)} urgent={selectedDriver.points?.lowBalance} />
                  <Info label="Credit" value={money(selectedDriver.points?.creditAED)} />
                  <Info label="Rides" value={selectedDriver.completedRides} />
                  <Info label="Last GPS" value={formatAge(selectedDriver.lastLocationAt)} urgent={selectedDriver.gpsFreshness !== "live"} />
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" variant="secondary" icon={<Crosshair size={14} />} onClick={() => setFollow((v) => !v)}>{follow ? "Stop Following" : "Follow Driver"}</Button>
                  <Link to={`/driver-detail/${selectedDriver.id}`}><Button size="sm" variant="secondary" icon={<UserRound size={14} />}>Profile</Button></Link>
                  <Link to={`/points/balances/${selectedDriver.id}`}><Button size="sm" variant="secondary" icon={<CircleDollarSign size={14} />}>Transactions</Button></Link>
                  <Link to="/chat"><Button size="sm" variant="secondary" icon={<MessageSquare size={14} />}>Chat</Button></Link>
                </div>
              </Card>
            ) : (
              <Card><EmptyState title="Select a driver" description="Click a marker or list row for live details." /></Card>
            )}

            {selectedDriver?.currentRide || selectedRide ? <RidePanel ride={selectedDriver?.currentRide || selectedRide} navigate={navigate} /> : null}

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-800">Active Rides</div>
              <div className="max-h-56 overflow-auto">
                {snapshot.rides.length ? snapshot.rides.map((ride) => (
                  <button key={ride.id} type="button" onClick={() => { setSelectedRideId(ride.id); setSelectedDriverId(ride.driverId || ""); }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${selectedRideId === ride.id ? "bg-red-50/60" : ""}`}>
                    <p className="text-sm font-semibold text-slate-800">{ride.reference}</p>
                    <p className="text-xs text-slate-400">{title(ride.driver?.fullName)} to {title(ride.passenger?.fullName)} / {formatStatus(ride.status)} / {money(ride.estimatedFareAED)}</p>
                  </button>
                )) : <EmptyState title="No active rides" description="Backend has no active rides right now." />}
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm text-slate-800">Alerts</div>
              <div className="max-h-48 overflow-auto">
                {snapshot.alerts.length ? snapshot.alerts.map((alert) => (
                  <button key={alert.id} type="button" onClick={() => { setSelectedDriverId(alert.driverId || ""); setSelectedRideId(alert.rideId || ""); }}
                    className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-amber-50">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-2"><AlertTriangle size={14} />{alert.title}</p>
                    <p className="text-xs text-amber-700/80">{alert.description}</p>
                  </button>
                )) : <p className="text-xs text-slate-400 px-4 py-5 text-center">No live operational alerts.</p>}
              </div>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, urgent = false }) {
  return (
    <div className={`rounded-[8px] px-3 py-2 ${urgent ? "bg-amber-50 text-amber-800" : "bg-slate-50 text-slate-700"}`}>
      <p className="text-[10px] uppercase tracking-[0.12em] opacity-60 font-bold">{label}</p>
      <p className="font-semibold truncate">{value}</p>
    </div>
  );
}

function RidePanel({ ride, navigate }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold text-slate-900">Current Ride</h3>
        <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => navigate(`/rides/${ride.id}`)}>View</Button>
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm">
        <Info label="Ride" value={ride.reference || ride.id} />
        <Info label="Passenger" value={title(ride.passenger?.fullName)} />
        <Info label="Pickup" value={title(ride.pickup?.address)} />
        <Info label="Destination" value={title(ride.destination?.address)} />
        <Info label="Status" value={formatStatus(ride.status)} />
        <Info label="Estimated Fare" value={money(ride.estimatedFareAED)} />
        <Info label="Estimated Commission" value={money(ride.estimatedCommissionAED)} />
        <Info label="Estimated Points" value={points(ride.estimatedPoints)} />
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="secondary" icon={<Navigation size={14} />} onClick={() => navigate(`/live-map?rideId=${encodeURIComponent(ride.id)}`)}>Track Live</Button>
        <Button size="sm" variant="secondary" icon={<History size={14} />} onClick={() => navigate("/rides/all")}>History</Button>
      </div>
    </Card>
  );
}
