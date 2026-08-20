import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Navigation, RefreshCw, AlertTriangle, Search, X, Filter } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button, Drawer, Select } from "../../components/ui";
import { getRides, getDriversWithLocation } from "../../api";
import { type Ride, type RideStatus } from "../../data/mockRides";
import { RideStatusBadge } from "../Dashboard";
import RideDetails from "./RideDetails";
import { useSocket } from "../../context/SocketContext";

function mapApiRide(r: any): Ride {
  return {
    id: r._id || r.id || "",
    offerId: r.offerId || "",
    driver: { id: r.driver?._id || r.driver?.id || "", name: r.driver?.name || "Unknown", avatar: r.driver?.avatar || r.driver?.name?.charAt(0) || "?", phone: r.driver?.phone || "" },
    user: { id: r.user?._id || r.user?.id || "", name: r.user?.name || "Unknown", avatar: r.user?.avatar || r.user?.name?.charAt(0) || "?", phone: r.user?.phone || "" },
    pickup: { address: r.pickup_location?.address || r.pickup?.address || "", lat: r.pickup_location?.lat || r.pickup?.lat || 0, lng: r.pickup_location?.lng || r.pickup?.lng || 0 },
    destination: { address: r.destination?.address || "", lat: r.destination?.lat || 0, lng: r.destination?.lng || 0 },
    status: (r.status || "offer_sent") as RideStatus,
    fareNGN: r.fare || r.fareNGN || 0,
    vehicleType: r.vehicleType || "sedan",
    pointsCharged: r.pointsCharged || 0,
    pointsReserved: r.pointsReserved || 0,
    startedAt: r.startedAt || null,
    completedAt: r.completedAt || null,
    cancelledAt: r.cancelledAt || null,
    cancelReason: r.cancelReason || null,
    cancelledBy: r.cancelledBy || null,
    createdAt: r.createdAt || new Date().toISOString(),
    eta: r.eta ?? null,
    distanceKm: r.distanceKm ?? null,
    lastLocationUpdate: r.lastLocationUpdate || null,
    isStuck: r.isStuck || false,
    isStaleLocation: r.isStaleLocation || false,
    isDisputed: r.isDisputed || r.status === "disputed",
    disputeNote: r.disputeNote || null,
    city: r.city || "",
    adminNote: r.adminNote || null,
    internalNotes: r.internalNotes || [],
    timeline: r.timeline || [],
  };
}

// ─── Live driver position tracking ───────────────────────────────────────────

interface DriverPosition {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string | null;
  ageSeconds: number | null;
}

function isFiniteCoord(lat: unknown, lng: unknown) {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

/** Seeds driver positions via REST and keeps them fresh over the admin
 *  tracking socket room (see backend `driver-map:track` / `driver:location`). */
function useLiveDriverPositions() {
  const { socket, connected } = useSocket();
  const [positions, setPositions] = useState<Record<string, DriverPosition>>({});

  useEffect(() => {
    let cancelled = false;
    getDriversWithLocation()
      .then((drivers: any[]) => {
        if (cancelled) return;
        const next: Record<string, DriverPosition> = {};
        for (const d of drivers || []) {
          const id = d._id || d.id;
          if (!id || !isFiniteCoord(d.lat, d.long)) continue;
          next[id] = {
            lat: d.lat, lng: d.long,
            heading: d.heading ?? null, speed: d.speed ?? null,
            updatedAt: d.locationUpdatedAt || null,
            ageSeconds: d.locationAgeSeconds ?? null,
          };
        }
        setPositions(next);
      })
      .catch((err) => console.error("Failed to load driver locations", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("driver-map:track", { on: true });

    const onLocation = (event: any) => {
      const id = event?.driverId;
      if (!id || !isFiniteCoord(event.lat, event.long)) return;
      setPositions(prev => ({
        ...prev,
        [id]: {
          lat: event.lat, lng: event.long,
          heading: event.heading ?? null, speed: event.speed ?? null,
          updatedAt: event.locationUpdatedAt || new Date().toISOString(),
          ageSeconds: 0,
        },
      }));
    };
    socket.on("driver:location", onLocation);

    return () => {
      socket.emit("driver-map:track", { on: false });
      socket.off("driver:location", onLocation);
    };
  }, [socket, connected]);

  return positions;
}

// ─── Map ──────────────────────────────────────────────────────────────────────

const statusColor = (ride: Ride) =>
  ride.isStuck ? "#DC2626" : ride.status === "ride_started" ? "#16A34A" : ride.status === "driver_arrived" ? "#7C3AED" : "#BE1B2C";

function driverDivIcon(label: string, color: string, selected: boolean) {
  const size = selected ? 32 : 26;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:${selected ? 2.5 : 2}px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font:700 ${selected ? 10 : 9}px Inter, sans-serif;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function dotDivIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

/** Keeps the map framed on the active rides / driver positions without
 *  fighting the user once they've manually panned or zoomed. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    fitted.current = true;
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    }
  }, [points, map]);

  return null;
}

interface MapProps {
  rides: Ride[];
  driverPositions: Record<string, DriverPosition>;
  selected: Ride | null;
  onSelect: (r: Ride) => void;
}

function LiveMap({ rides, driverPositions, selected, onSelect }: MapProps) {
  const points: [number, number][] = [];
  for (const ride of rides) {
    const pos = driverPositions[ride.driver.id];
    if (pos) points.push([pos.lat, pos.lng]);
    else if (ride.pickup.lat && ride.pickup.lng) points.push([ride.pickup.lat, ride.pickup.lng]);
  }
  const center: [number, number] = points[0] || [6.5244, 3.3792]; // Lagos fallback

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom className="w-full h-full" style={{ background: "#EFF3F8" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />

      {rides.map(ride => {
        const pos = driverPositions[ride.driver.id];
        const driverLatLng: [number, number] | null = pos ? [pos.lat, pos.lng] : null;
        const isSel = selected?.id === ride.id;
        const color = statusColor(ride);
        const routePoints: [number, number][] = [
          driverLatLng || [ride.pickup.lat, ride.pickup.lng],
          [ride.destination.lat, ride.destination.lng],
        ];

        return (
          <Fragment key={ride.id}>
            <Polyline
              positions={routePoints}
              pathOptions={{
                color: ride.isStuck ? "#DC2626" : isSel ? "#BE1B2C" : "#FECACA",
                weight: isSel ? 3 : 1.5,
                dashArray: isSel ? undefined : "4,4",
                opacity: isSel ? 1 : 0.6,
              }}
            />
            {ride.pickup.lat !== 0 && (
              <Marker position={[ride.pickup.lat, ride.pickup.lng]} icon={dotDivIcon("#BE1B2C")} />
            )}
            {ride.destination.lat !== 0 && (
              <Marker position={[ride.destination.lat, ride.destination.lng]} icon={dotDivIcon("#DC2626")} />
            )}
            {driverLatLng && (
              <Marker
                position={driverLatLng}
                icon={driverDivIcon(ride.driver.avatar, color, isSel)}
                eventHandlers={{ click: () => onSelect(ride) }}
              />
            )}
          </Fragment>
        );
      })}
    </MapContainer>
  );
}

// ─── Ride list card ───────────────────────────────────────────────────────────

function RideCard({ ride, isSelected, onClick }: { ride: Ride; isSelected: boolean; onClick: () => void }) {
  const staleMin = ride.lastLocationUpdate
    ? Math.floor((Date.now() - new Date(ride.lastLocationUpdate).getTime()) / 60000)
    : null;

  return (
    <div
      onClick={onClick}
      className={`px-4 py-3.5 cursor-pointer transition-all border-b border-slate-100 last:border-0 hover:bg-slate-50
        ${isSelected ? "bg-red-50/40 border-l-[3px] border-l-[#BE1B2C] pl-3.5" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{ride.id}</span>
          <RideStatusBadge status={ride.isStuck ? "stuck" : ride.status} />
          {ride.isStaleLocation && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Stale GPS</span>
          )}
          {ride.isDisputed && (
            <span className="text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">Disputed</span>
          )}
        </div>
        {ride.eta !== null && (
          <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">{ride.eta}m</span>
        )}
        {ride.isStuck && (
          <span className="text-xs font-bold text-red-600 shrink-0">4h 30m !</span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
          {ride.driver.avatar}
        </div>
        <span className="text-xs font-semibold text-slate-700">{ride.driver.name}</span>
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
          {ride.user.avatar}
        </div>
        <span className="text-xs text-slate-500">{ride.user.name}</span>
      </div>

      <div className="text-[11px] text-slate-400 truncate mb-1.5">
        {ride.pickup.address} → {ride.destination.address}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          {ride.distanceKm && <>{ride.distanceKm} km · </>}
          {ride.city}
        </span>
        {staleMin !== null && (
          <span className={staleMin > 5 ? "text-amber-600 font-semibold" : ""}>
            GPS {staleMin < 1 ? "now" : `${staleMin}m ago`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LiveRides() {
  const [searchParams] = useSearchParams();
  const preSelected = searchParams.get("selected");

  const [allRides, setAllRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRides({ status: "offer_sent,offer_accepted,driver_on_way,driver_arrived,pickup_confirmed,ride_started", limit: 100 })
      .then(({ rides: apiRides }) => {
        if (cancelled) return;
        setAllRides((apiRides || []).map(mapApiRide));
      })
      .catch((err) => {
        console.error("Failed to load live rides", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const activeRides = allRides;

  const initialRide = preSelected ? (activeRides.find(r => r.id === preSelected) ?? null) : null;

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter]   = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [staleOnly, setStaleOnly]     = useState(false);
  const [stuckOnly, setStuckOnly]     = useState(false);
  const [selected, setSelected]       = useState<Ride | null>(initialRide);
  const [detailOpen, setDetailOpen]   = useState(!!initialRide);
  const [showFilters, setShowFilters] = useState(false);
  const driverPositions = useLiveDriverPositions();

  const filtered = useMemo(() => activeRides.filter(r => {
    if (staleOnly && !r.isStaleLocation) return false;
    if (stuckOnly && !r.isStuck) return false;
    if (cityFilter !== "all" && r.city.toLowerCase() !== cityFilter) return false;
    if (vehicleFilter !== "all" && r.vehicleType !== vehicleFilter) return false;
    if (statusFilter !== "all") {
      if (statusFilter === "stuck" && !r.isStuck) return false;
      if (statusFilter !== "stuck" && r.status !== statusFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!r.id.toLowerCase().includes(q) && !r.driver.name.toLowerCase().includes(q) && !r.user.name.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [search, statusFilter, cityFilter, vehicleFilter, staleOnly, stuckOnly]);

  const handleSelect = (ride: Ride) => {
    setSelected(ride);
    setDetailOpen(true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    getRides({ status: "offer_sent,offer_accepted,driver_on_way,driver_arrived,pickup_confirmed,ride_started", limit: 100 })
      .then(({ rides: apiRides }) => {
        setAllRides((apiRides || []).map(mapApiRide));
      })
      .catch((err) => {
        console.error("Failed to refresh live rides", err);
      })
      .finally(() => setRefreshing(false));
  };

  const stuckCount = activeRides.filter(r => r.isStuck).length;
  const staleCount = activeRides.filter(r => r.isStaleLocation).length;
  const hasFilters = statusFilter !== "all" || cityFilter !== "all" || vehicleFilter !== "all" || staleOnly || stuckOnly || !!search;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">Live Rides</h1>
            <p className="text-sm text-slate-500 mt-0.5">Real-time map and active ride management.</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-full">
            <span className="live-pulse w-1.5 h-1.5 rounded-full bg-green-500" />
            {activeRides.length} active
          </div>
          {stuckCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-full">
              <AlertTriangle size={11} /> {stuckCount} stuck
            </div>
          )}
          {staleCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-full">
              <Navigation size={11} /> {staleCount} stale GPS
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Filter size={14} />} onClick={() => setShowFilters(!showFilters)}>
            Filters{hasFilters ? " •" : ""}
          </Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />} onClick={handleRefresh}>
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-[12px] p-3">
          <div className="relative flex-1 min-w-48 max-w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ride ID, driver or passenger…"
              className="w-full h-9 bg-white border border-slate-200 rounded-[8px] pl-8 pr-8 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={11} /></button>
            )}
          </div>
          <Select value={statusFilter} onChange={setStatusFilter} className="w-40"
            options={[
              { value: "all", label: "All Statuses" },
              { value: "offer_sent", label: "Offer Pending" },
              { value: "offer_accepted", label: "Confirmed" },
              { value: "driver_on_way", label: "Driver on the Way" },
              { value: "driver_arrived", label: "Driver Arrived" },
              { value: "pickup_confirmed", label: "Pickup Confirmed" },
              { value: "ride_started", label: "In Progress" },
              { value: "stuck", label: "Stuck" },
            ]}
          />
          <Select value={cityFilter} onChange={setCityFilter} className="w-32"
            options={[
              { value: "all", label: "All Cities" },
              { value: "lagos", label: "Lagos" },
              { value: "abuja", label: "Abuja" },
            ]}
          />
          <Select value={vehicleFilter} onChange={setVehicleFilter} className="w-32"
            options={[
              { value: "all", label: "All Vehicles" },
              { value: "sedan", label: "Sedan" },
              { value: "suv", label: "SUV" },
              { value: "premium", label: "Premium" },
            ]}
          />
          <button onClick={() => setStaleOnly(!staleOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
              ${staleOnly ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-200 hover:border-amber-400"}`}>
            Stale GPS
          </button>
          <button onClick={() => setStuckOnly(!stuckOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
              ${stuckOnly ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-slate-200 hover:border-red-400"}`}>
            Stuck only
          </button>
          {hasFilters && (
            <button onClick={() => { setSearch(""); setStatusFilter("all"); setCityFilter("all"); setVehicleFilter("all"); setStaleOnly(false); setStuckOnly(false); }}
              className="text-xs text-[#BE1B2C] hover:text-[#A31725] font-medium underline underline-offset-2">
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Split layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 flex-1" style={{ minHeight: 520 }}>

        {/* LEFT: Map */}
        <div className="xl:col-span-3 relative rounded-[14px] overflow-hidden border border-slate-200 bg-[#EFF3F8]">
          <LiveMap rides={filtered} driverPositions={driverPositions} selected={selected} onSelect={handleSelect} />

          {/* Live badge */}
          <div className="absolute top-4 right-4 z-[1000] flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm">
            <span className="live-pulse w-1.5 h-1.5 rounded-full bg-green-500" /> Live
          </div>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-[10px] border border-slate-200 px-3 py-2.5 flex flex-col gap-1.5 shadow-sm">
            {[
              { color: "bg-green-600",  label: "In Progress" },
              { color: "bg-[#BE1B2C]",   label: "En Route" },
              { color: "bg-violet-600", label: "Driver Arrived" },
              { color: "bg-red-600",    label: "Stuck" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2 text-xs text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full ${l.color}`} />{l.label}
              </div>
            ))}
          </div>

          {/* Selected ride highlight info */}
          {selected && (
            <div className="absolute top-20 left-4 z-[1000] bg-white/95 backdrop-blur-sm border border-blue-200 rounded-[10px] px-3 py-2.5 shadow-md max-w-52">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-[#BE1B2C]">{selected.id}</span>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
              </div>
              <p className="text-xs text-slate-600 font-medium">{selected.driver.name}</p>
              <p className="text-xs text-slate-400 truncate">{selected.pickup.address}</p>
              <button onClick={() => setDetailOpen(true)}
                className="mt-2 w-full text-xs font-semibold text-[#BE1B2C] hover:text-[#A31725] text-center transition-colors">
                Inspect →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Ride list */}
        <div className="xl:col-span-2 bg-white rounded-[14px] border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-slate-600">
              {filtered.length} ride{filtered.length !== 1 ? "s" : ""}
              {hasFilters && ` · filtered`}
            </span>
            {selected && (
              <span className="text-xs text-[#BE1B2C] font-medium">{selected.id} selected</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-[#BE1B2C] border-t-transparent rounded-full animate-spin" />
                <span className="ml-3 text-sm text-slate-400">Loading rides…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 px-6 text-center">
                <Navigation size={24} className="text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No active rides</p>
                <p className="text-xs text-slate-400">
                  {hasFilters ? "Try adjusting your filters." : "No rides are currently active."}
                </p>
              </div>
            ) : (
              filtered.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  isSelected={selected?.id === ride.id}
                  onClick={() => handleSelect(ride)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Ride detail drawer ── */}
      <Drawer
        open={detailOpen && !!selected}
        onClose={() => { setDetailOpen(false); setSelected(null); }}
        title=""
        width="w-[640px]"
      >
        {selected && (
          <RideDetails
            ride={selected}
            onClose={() => { setDetailOpen(false); setSelected(null); }}
          />
        )}
      </Drawer>
    </div>
  );
}
