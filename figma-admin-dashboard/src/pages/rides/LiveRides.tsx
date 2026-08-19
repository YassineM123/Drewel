import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Navigation, RefreshCw, AlertTriangle, Search, X, ZoomIn, ZoomOut, Locate, Filter } from "lucide-react";
import { Button, Drawer, Select } from "../../components/ui";
import { getRides } from "../../api";
import { type Ride, type RideStatus } from "../../data/mockRides";
import { RideStatusBadge } from "../Dashboard";
import RideDetails from "./RideDetails";

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

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Lagos map coordinate transform ──────────────────────────────────────────
// Bounding box: lat 6.38–6.64, lng 3.28–3.62

const MAP_W  = 700;
const MAP_H  = 500;
const LAT_MIN = 6.38, LAT_MAX = 6.64;
const LNG_MIN = 3.28, LNG_MAX = 3.62;

function toXY(lat: number, lng: number) {
  const x = Math.round(((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W);
  const y = Math.round(((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H);
  return { x: Math.max(24, Math.min(MAP_W - 24, x)), y: Math.max(24, Math.min(MAP_H - 24, y)) };
}

// ─── Map SVG ──────────────────────────────────────────────────────────────────

interface MapProps {
  rides: Ride[];
  selected: Ride | null;
  onSelect: (r: Ride) => void;
  zoom: number;
}

function LagosMap({ rides, selected, onSelect, zoom }: MapProps) {
  const scale = zoom;
  const vW = MAP_W / scale;
  const vH = MAP_H / scale;
  const vX = (MAP_W - vW) / 2;
  const vY = (MAP_H - vH) / 2;

  return (
    <svg
      viewBox={`${vX} ${vY} ${vW} ${vH}`}
      className="w-full h-full"
      style={{ transition: "all 0.3s ease" }}
    >
      {/* ── Base ── */}
      <rect width={MAP_W} height={MAP_H} fill="#EFF3F8" />

      {/* ── Lagos Lagoon ── */}
      <path d="M0,460 Q60,428 130,418 Q200,408 260,415 Q320,422 380,410 Q450,397 530,405 Q610,413 700,420 L700,500 L0,500 Z" fill="#BDD5EA" />

      {/* ── Atlantic Ocean / Bar Beach strip ── */}
      <path d="M255,478 Q310,466 375,472 Q440,478 500,468 Q540,462 580,470 L700,500 L220,500 Z" fill="#9DC0D9" />

      {/* ── Victoria Island (land strip) ── */}
      <ellipse cx="340" cy="456" rx="80" ry="16" fill="#DBE8F0" />
      <ellipse cx="200" cy="450" rx="55" ry="12" fill="#DBE8F0" />

      {/* ── Street grid — residential ── */}
      {/* Ikeja area (top-left cluster) */}
      {[
        [30,60,55,30],[95,55,55,30],[160,50,60,35],[30,100,45,28],[95,98,55,28],[160,95,58,28],
        [30,140,48,26],[95,135,55,26],[155,130,58,26],
      ].map(([x,y,w,h],i) => <rect key={`ik${i}`} x={x} y={y} width={w} height={h} rx="2" fill="#E2EAF2" />)}

      {/* Surulere area (center-left) */}
      {[
        [115,260,50,30],[170,258,60,30],[235,255,55,30],
        [115,300,50,28],[170,298,60,28],[235,295,55,28],
      ].map(([x,y,w,h],i) => <rect key={`su${i}`} x={x} y={y} width={w} height={h} rx="2" fill="#E2EAF2" />)}

      {/* Lagos Island / VI cluster */}
      {[
        [210,390,45,22],[260,388,45,22],[310,388,45,22],
        [355,385,40,20],[210,370,45,16],[260,368,55,16],
      ].map(([x,y,w,h],i) => <rect key={`li${i}`} x={x} y={y} width={w} height={h} rx="2" fill="#D8E4EE" />)}

      {/* Lekki corridor */}
      {[
        [420,370,50,22],[475,368,50,22],[530,372,45,20],[580,375,40,20],
        [420,400,50,18],[475,398,50,18],[530,402,45,18],
      ].map(([x,y,w,h],i) => <rect key={`lk${i}`} x={x} y={y} width={w} height={h} rx="2" fill="#E2EAF2" />)}

      {/* ── Major roads ── */}
      {/* Airport Road (Ikeja → Lagos Island) */}
      <path d="M55,85 L90,200 L135,310 L175,390" stroke="#D0D9E6" strokeWidth="6" fill="none" strokeLinecap="round" />

      {/* Lagos-Ibadan Expressway (goes off screen upper right) */}
      <path d="M70,70 Q200,45 400,20" stroke="#C8D4E2" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* Third Mainland Bridge */}
      <path d="M145,310 Q185,355 230,390" stroke="#C8D4E2" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* Carter Bridge */}
      <path d="M185,350 Q210,368 238,388" stroke="#C8D4E2" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* Lekki Expressway */}
      <path d="M280,400 Q380,395 480,398 Q570,400 660,415" stroke="#C8D4E2" strokeWidth="6" fill="none" strokeLinecap="round" />

      {/* East-West Expressway / Eko Bridge approach */}
      <path d="M0,320 Q80,305 170,310 Q240,316 310,330 Q370,342 460,340 Q560,338 700,345" stroke="#C8D4E2" strokeWidth="5" fill="none" strokeLinecap="round" />

      {/* Apapa - Oshodi Expressway */}
      <path d="M65,420 Q90,380 130,340 Q165,305 185,260 Q200,210 210,160" stroke="#C8D4E2" strokeWidth="4" fill="none" strokeLinecap="round" />

      {/* Oshodi - Isolo route */}
      <path d="M210,160 Q290,150 370,165 Q430,175 500,165 Q570,155 640,170" stroke="#D0D9E6" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Ikorodu Road */}
      <path d="M140,250 Q195,220 280,205 Q350,194 410,200 Q480,208 550,195" stroke="#D0D9E6" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* ── Area labels ── */}
      {[
        { label: "Ikeja / Airport", x: 75, y: 145 },
        { label: "Surulere", x: 152, y: 290 },
        { label: "Oshodi", x: 230, y: 175 },
        { label: "Lagos Island", x: 246, y: 435 },
        { label: "Victoria Island", x: 340, y: 442 },
        { label: "Lekki", x: 500, y: 365 },
        { label: "Ajah", x: 620, y: 395 },
        { label: "Ikorodu Rd", x: 390, y: 198 },
      ].map(l => (
        <text key={l.label} x={l.x} y={l.y} fill="#8A9BBE" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="600"
          textAnchor="middle" opacity="0.85">{l.label}</text>
      ))}

      {/* ── Lagos Lagoon label ── */}
      <text x="120" y="484" fill="#6890AE" fontSize="10" fontFamily="Inter, sans-serif" opacity="0.7">Lagos Lagoon</text>

      {/* ── Route lines for each active ride ── */}
      {rides.map(ride => {
        const p = toXY(ride.pickup.lat, ride.pickup.lng);
        const d = toXY(ride.destination.lat, ride.destination.lng);
        const isLagos = ride.city === "Lagos";
        if (!isLagos) return null;
        const isSel   = selected?.id === ride.id;
        const isStuck = ride.isStuck;
        const midX = (p.x + d.x) / 2;
        const midY = Math.min(p.y, d.y) - 25;
        return (
          <path key={`route-${ride.id}`}
            d={`M${p.x},${p.y} Q${midX},${midY} ${d.x},${d.y}`}
            stroke={isStuck ? "#DC2626" : isSel ? "#BE1B2C" : "#FECACA"}
            strokeWidth={isSel ? 3 : 1.5}
            strokeDasharray={isSel ? "none" : "4,3"}
            fill="none"
            opacity={isSel ? 1 : 0.5}
          />
        );
      })}

      {/* ── Markers ── */}
      {rides.map(ride => {
        const p = toXY(ride.pickup.lat, ride.pickup.lng);
        const d = toXY(ride.destination.lat, ride.destination.lng);
        const isLagos = ride.city === "Lagos";
        if (!isLagos) return null;
        const isSel   = selected?.id === ride.id;
        const isStuck = ride.isStuck;
        const color   = isStuck ? "#DC2626" : ride.status === "ride_started" ? "#16A34A" : ride.status === "driver_arrived" ? "#7C3AED" : "#BE1B2C";

        return (
          <g key={`markers-${ride.id}`}>
            {/* Pickup pin */}
            <circle cx={p.x} cy={p.y} r="4" fill="#BE1B2C" opacity={isSel ? 1 : 0.5} />

            {/* Destination pin */}
            <circle cx={d.x} cy={d.y} r="4" fill="#DC2626" opacity={isSel ? 1 : 0.4} />

            {/* Driver marker */}
            <g onClick={() => onSelect(ride)} style={{ cursor: "pointer" }}>
              {isSel && (
                <circle cx={p.x} cy={p.y} r="20" fill={color} opacity="0.12">
                  <animate attributeName="r" values="16;24;16" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={p.x} cy={p.y} r={isSel ? 16 : 13} fill={color}
                stroke="white" strokeWidth={isSel ? 2.5 : 2}
                className="transition-all duration-200"
                style={{ filter: isSel ? `drop-shadow(0 2px 6px ${color}66)` : undefined }}
              />
              <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={isSel ? "9" : "8"} fontWeight="700" fontFamily="Inter, sans-serif"
                style={{ pointerEvents: "none" }}>
                {ride.driver.avatar}
              </text>
              {isSel && (
                <g>
                  <rect x={p.x - 22} y={p.y - 28} width="44" height="14" rx="4" fill="#1E293B" opacity="0.9" />
                  <text x={p.x} y={p.y - 20} textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize="7.5" fontFamily="Inter, sans-serif" fontWeight="600"
                    style={{ pointerEvents: "none" }}>
                    {ride.id}
                  </text>
                </g>
              )}
            </g>
          </g>
        );
      })}

      {/* Off-map rides indicator */}
      {rides.filter(r => r.city !== "Lagos").length > 0 && (
        <g>
          <rect x={MAP_W - 110} y={10} width="100" height="28" rx="6" fill="white" stroke="#E2E8F0" strokeWidth="1" />
          <text x={MAP_W - 60} y={24} textAnchor="middle" dominantBaseline="middle" fill="#64748B" fontSize="10" fontFamily="Inter, sans-serif">
            +{rides.filter(r => r.city !== "Lagos").length} off-map
          </text>
        </g>
      )}
    </svg>
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
  const [zoom, setZoom]               = useState(1);
  const [showFilters, setShowFilters] = useState(false);

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
          <LagosMap rides={filtered} selected={selected} onSelect={handleSelect} zoom={zoom} />

          {/* Live badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm">
            <span className="live-pulse w-1.5 h-1.5 rounded-full bg-green-500" /> Live
          </div>

          {/* Zoom controls */}
          <div className="absolute top-14 right-4 flex flex-col gap-1">
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 2.5))}
              className="w-8 h-8 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-[8px] flex items-center justify-center text-slate-600 hover:bg-white shadow-sm transition-colors">
              <ZoomIn size={15} />
            </button>
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 1))}
              className="w-8 h-8 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-[8px] flex items-center justify-center text-slate-600 hover:bg-white shadow-sm transition-colors">
              <ZoomOut size={15} />
            </button>
            <button onClick={() => setZoom(1)}
              className="w-8 h-8 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-[8px] flex items-center justify-center text-slate-600 hover:bg-white shadow-sm transition-colors">
              <Locate size={15} />
            </button>
          </div>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-[10px] border border-slate-200 px-3 py-2.5 flex flex-col gap-1.5 shadow-sm">
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

          {/* Traffic conditions */}
          <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-[10px] px-3 py-2 flex items-center gap-2 shadow-sm">
            <div className="flex gap-0.5">
              <div className="w-1 h-4 rounded-sm bg-green-500" />
              <div className="w-1 h-4 rounded-sm bg-green-500" />
              <div className="w-1 h-3 rounded-sm bg-amber-400" />
              <div className="w-1 h-2 rounded-sm bg-slate-300" />
            </div>
            <span className="text-xs text-slate-600 font-medium">Moderate traffic</span>
          </div>

          {/* Selected ride highlight info */}
          {selected && (
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm border border-blue-200 rounded-[10px] px-3 py-2.5 shadow-md max-w-52">
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
