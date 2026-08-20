import { useState, useMemo, useEffect } from "react";
import { Navigation, RefreshCw, Map, List, AlertTriangle, Clock, Eye } from "lucide-react";
import { Card, OnlineBadge, Avatar, SectionHeader, Badge, Select, Button } from "../components/ui";
import { getOnlineDrivers, getDriversWithLocation } from "../api";
import { useNavigate } from "react-router-dom";

// ─── Extended per-driver metadata ─────────────────────────────────────────────

const DRIVER_META: Record<string, { vehicleType: string; city: string; pointsBalance: number; lastGpsMinutes: number }> = {
  "DRV-4421": { vehicleType: "sedan",   city: "Lagos",  pointsBalance: 4820, lastGpsMinutes: 1  },
  "DRV-3814": { vehicleType: "sedan",   city: "Lagos",  pointsBalance: 120,  lastGpsMinutes: 48 },
  "DRV-2908": { vehicleType: "suv",     city: "Abuja",  pointsBalance: 6100, lastGpsMinutes: 3  },
  "DRV-5102": { vehicleType: "premium", city: "Lagos",  pointsBalance: 95,   lastGpsMinutes: 67 },
  "DRV-6031": { vehicleType: "sedan",   city: "Abuja",  pointsBalance: 3200, lastGpsMinutes: 2  },
  "DRV-7204": { vehicleType: "suv",     city: "Lagos",  pointsBalance: 310,  lastGpsMinutes: 12 },
};

const POINTS_WARN_THRESHOLD = 200;
const STALE_GPS_MINUTES = 15;

function maskPhone(phone: string) {
  return phone.replace(/(\+\d{3}\s?\d{3})\s?\d{3}(\s?\d{4})/, "$1 *** $2");
}

function gpsLabel(mins: number) {
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function staleLevel(mins: number): "fresh" | "stale" | "critical" {
  if (mins < STALE_GPS_MINUTES) return "fresh";
  if (mins < 45) return "stale";
  return "critical";
}

// ─── Component ─────────────────────────────────────────────────────────────────

type ViewMode = "map" | "list";

export default function OnlineDrivers() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selected, setSelected] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [revealedPII, setRevealedPII] = useState<Set<string>>(new Set());
  const [drivers, setDrivers] = useState<any[]>([]);
  const [locationDrivers, setLocationDrivers] = useState<any[]>([]);

  const fetchDrivers = async () => {
    try {
      const [online, withLocation] = await Promise.all([
        getOnlineDrivers(),
        getDriversWithLocation(),
      ]);
      setDrivers(online);
      setLocationDrivers(withLocation);
    } catch (err) {
      console.error("Failed to load drivers", err);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const onlineDrivers = useMemo(() => drivers.filter(d => {
    if (d.onlineStatus === "offline") return false;
    const meta = DRIVER_META[d.id];
    if (!meta) return true;
    if (vehicleFilter !== "all" && meta.vehicleType !== vehicleFilter) return false;
    if (cityFilter !== "all" && meta.city !== cityFilter) return false;
    if (statusFilter === "stale" && staleLevel(meta.lastGpsMinutes) === "fresh") return false;
    if (statusFilter === "busy" && d.onlineStatus !== "online_busy") return false;
    if (statusFilter === "available" && d.onlineStatus !== "online_available") return false;
    return true;
  }), [drivers, vehicleFilter, cityFilter, statusFilter]);

  const allOnline = drivers.filter(d => d.onlineStatus !== "offline");
  const staleCount = allOnline.filter(d => {
    const m = DRIVER_META[d.id];
    return m && m.lastGpsMinutes >= STALE_GPS_MINUTES;
  }).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDrivers();
    setRefreshing(false);
  };

  const toggleReveal = (id: string) => {
    setRevealedPII(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Online Drivers"
        description="Live map and list view of all currently active drivers."
        actions={
          <div className="flex items-center gap-2">
            {/* Map / List toggle */}
            <div className="flex items-center bg-slate-100 rounded-[10px] p-1">
              <button onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all
                  ${viewMode === "map" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
                <Map size={13} /> Map
              </button>
              <button onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all
                  ${viewMode === "list" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
                <List size={13} /> List
              </button>
            </div>
            <button onClick={handleRefresh}
              className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 rounded-[10px] px-3 h-9 transition-colors">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Online Now", value: allOnline.length, color: "text-green-700", bg: "bg-green-50 border-green-200" },
          { label: "On Trip", value: drivers.filter(d => d.onlineStatus === "online_busy").length, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Available", value: drivers.filter(d => d.onlineStatus === "online_available").length, color: "text-slate-700", bg: "" },
          {
            label: "Stale Location",
            value: staleCount,
            color: staleCount > 0 ? "text-amber-700" : "text-slate-700",
            bg: staleCount > 0 ? "bg-amber-50 border-amber-200" : "",
          },
        ].map(k => (
          <Card key={k.label} className={`p-4 ${k.bg ? `border ${k.bg}` : ""}`}>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${k.color}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={vehicleFilter}
            onChange={setVehicleFilter}
            label="Vehicle"
            options={[
              { value: "all", label: "All vehicles" },
              { value: "sedan", label: "Sedan" },
              { value: "suv", label: "SUV" },
              { value: "premium", label: "Premium" },
            ]}
          />
          <Select
            value={cityFilter}
            onChange={setCityFilter}
            label="City"
            options={[
              { value: "all", label: "All cities" },
              { value: "Lagos", label: "Lagos" },
              { value: "Abuja", label: "Abuja" },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            label="Status"
            options={[
              { value: "all", label: "All statuses" },
              { value: "available", label: "Available" },
              { value: "busy", label: "On Trip" },
              { value: "stale", label: "Stale Location" },
            ]}
          />
          {staleCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2 ml-auto">
              <AlertTriangle size={12} />
              {staleCount} driver{staleCount > 1 ? "s" : ""} with stale GPS
            </div>
          )}
        </div>
      </Card>

      {viewMode === "map" ? (
        /* ── MAP VIEW ──────────────────────────────────────────── */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
            <Card className="overflow-hidden">
              <div className="relative bg-slate-100" style={{ height: "460px" }}>
                <MapBackground />

                {onlineDrivers.map((d, i) => {
                  const meta = DRIVER_META[d.id];
                  const staleLvl = meta ? staleLevel(meta.lastGpsMinutes) : "fresh";
                  const positions = [
                    { top: "28%", left: "42%" },
                    { top: "55%", left: "58%" },
                    { top: "38%", left: "65%" },
                    { top: "45%", left: "30%" },
                    { top: "62%", left: "44%" },
                    { top: "32%", left: "55%" },
                  ];
                  const pos = positions[i % positions.length];
                  const isStale = staleLvl !== "fresh";
                  const isCritical = staleLvl === "critical";
                  const lowPoints = meta && meta.pointsBalance < POINTS_WARN_THRESHOLD;

                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelected(d)}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                      style={pos}
                    >
                      <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shadow-lg transition-all relative
                        ${selected?.id === d.id ? "scale-125 border-[#BE1B2C] bg-[#BE1B2C]" :
                          isCritical ? "border-red-400 bg-white" :
                          isStale ? "border-amber-400 bg-white" :
                          d.onlineStatus === "online_busy" ? "border-blue-400 bg-white" :
                          "border-white bg-white hover:scale-110"}
                        ${d.onlineStatus === "online_busy" ? "ring-2 ring-blue-400/30" : ""}`}>
                        <span className={`text-xs font-bold ${selected?.id === d.id ? "text-white" : "text-slate-700"}`}>
                          {d.avatar}
                        </span>
                        {lowPoints && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white">!</span>
                        )}
                        {isStale && !isCritical && (
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border border-white" />
                        )}
                        {isCritical && (
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border border-white" />
                        )}
                      </div>
                      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap text-xs font-medium px-2 py-1 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10
                        ${d.onlineStatus === "online_busy" ? "bg-blue-600 text-white" : "bg-slate-800 text-white"}`}>
                        {d.name.split(" ")[0]}
                        {isStale && " · GPS stale"}
                      </div>
                    </button>
                  );
                })}

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-[10px] border border-slate-200 p-3 flex flex-col gap-2">
                  {[
                    { color: "bg-white border-2 border-slate-200", label: "Available" },
                    { color: "bg-white border-2 border-blue-400", label: "On Trip" },
                    { color: "bg-white border-2 border-amber-400", label: "Stale GPS" },
                    { color: "bg-white border-2 border-red-400", label: "Critical GPS" },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-3 h-3 rounded-full ${l.color}`} />
                      {l.label}
                    </div>
                  ))}
                </div>

                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-green-600">
                  <span className="live-pulse w-1.5 h-1.5 rounded-full bg-green-500" />
                  Live
                </div>
              </div>
            </Card>
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-4">
            {selected ? (
              <DriverPanel driver={selected} revealed={revealedPII.has(selected.id)} onReveal={() => toggleReveal(selected.id)} onViewProfile={() => navigate(`/drivers?id=${selected.id}`)} />
            ) : (
              <Card className="p-6 flex flex-col items-center text-center gap-2">
                <Navigation size={20} className="text-slate-300" />
                <p className="text-sm text-slate-500">Select a driver on the map to view details</p>
              </Card>
            )}

            <Card className="p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Availability by Area</h3>
              <div className="flex flex-col gap-2.5">
                {(locationDrivers as any[]).length > 0 ? (locationDrivers as any[]).map((area: any) => {
                  const pct = Math.round(((area.online ?? 0) / Math.max(area.total ?? 1, 1)) * 100);
                  const low = pct < 60;
                  return (
                    <div key={area.area ?? area.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600 truncate">{area.area ?? area.name}</span>
                        <span className={`text-xs font-medium ${low ? "text-amber-600" : "text-green-600"}`}>{area.online ?? 0}/{area.total ?? 0}</span>
                      </div>
                      <div className="bg-slate-100 rounded-full h-1.5">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: low ? "#D97706" : "#16A34A" }} />
                      </div>
                    </div>
                  );
                }) : null}
              </div>
            </Card>

            <Card>
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Drivers ({onlineDrivers.length})</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {onlineDrivers.map(d => {
                  const meta = DRIVER_META[d.id];
                  const staleLvl = meta ? staleLevel(meta.lastGpsMinutes) : "fresh";
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelected(d)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selected?.id === d.id ? "bg-red-50/30" : ""}`}
                    >
                      <div className="relative shrink-0">
                        <Avatar initials={d.avatar} size="sm" />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white
                          ${staleLvl === "critical" ? "bg-red-500" :
                            staleLvl === "stale" ? "bg-amber-400" :
                            d.onlineStatus === "online_available" ? "bg-green-500" : "bg-blue-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                        <p className="text-xs text-slate-400">{d.area}</p>
                      </div>
                      {meta && meta.pointsBalance < POINTS_WARN_THRESHOLD && (
                        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* ── LIST VIEW ─────────────────────────────────────────── */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Driver", "Status", "Vehicle", "City", "Last GPS Update", "Current Ride", "Points", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {onlineDrivers.map(d => {
                  const meta = DRIVER_META[d.id];
                  const staleLvl = meta ? staleLevel(meta.lastGpsMinutes) : "fresh";
                  const lowPoints = meta && meta.pointsBalance < POINTS_WARN_THRESHOLD;
                  const revealed = revealedPII.has(d.id);

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Driver */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar initials={d.avatar} size="sm" />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white
                              ${staleLvl === "critical" ? "bg-red-500" : staleLvl === "stale" ? "bg-amber-400" : d.onlineStatus === "online_available" ? "bg-green-500" : "bg-blue-500"}`} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm leading-tight">{d.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className="text-xs text-slate-400 font-mono">{revealed ? d.phone : maskPhone(d.phone)}</p>
                              <button onClick={() => toggleReveal(d.id)} className="text-[10px] text-sky-500 hover:text-sky-700">
                                <Eye size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <OnlineBadge status={d.onlineStatus as "online_available" | "online_busy" | "offline"} />
                          {staleLvl !== "fresh" && (
                            <div className={`flex items-center gap-1 text-[10px] font-semibold ${staleLvl === "critical" ? "text-red-600" : "text-amber-600"}`}>
                              <Clock size={9} />
                              {staleLvl === "critical" ? "Critical" : "Stale"} GPS
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Vehicle */}
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p>{d.vehicle.split(" · ")[0]}</p>
                        {meta && <p className="text-slate-400 mt-0.5 capitalize">{meta.vehicleType}</p>}
                      </td>
                      {/* City */}
                      <td className="px-4 py-3 text-xs text-slate-600">{meta?.city ?? d.area}</td>
                      {/* Last GPS */}
                      <td className="px-4 py-3">
                        {meta ? (
                          <span className={`text-xs font-medium
                            ${staleLvl === "critical" ? "text-red-600" : staleLvl === "stale" ? "text-amber-600" : "text-slate-500"}`}>
                            {gpsLabel(meta.lastGpsMinutes)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Unknown</span>
                        )}
                      </td>
                      {/* Current ride */}
                      <td className="px-4 py-3">
                        {d.currentRide
                          ? <span className="font-mono text-xs text-[#BE1B2C] bg-red-50 border border-red-200 rounded px-2 py-0.5">{d.currentRide}</span>
                          : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      {/* Points */}
                      <td className="px-4 py-3">
                        {meta ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold tabular-nums ${lowPoints ? "text-amber-700" : "text-slate-700"}`}>
                              {meta.pointsBalance.toLocaleString()}
                            </span>
                            {lowPoints && <AlertTriangle size={12} className="text-amber-500" />}
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/drivers?id=${d.id}`)}>View</Button>
                      </td>
                    </tr>
                  );
                })}
                {onlineDrivers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No drivers match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Driver detail panel (map view) ──────────────────────────────────────────

function DriverPanel({ driver, revealed, onReveal, onViewProfile }: {
  driver: any;
  revealed: boolean;
  onReveal: () => void;
  onViewProfile: () => void;
}) {
  const meta = DRIVER_META[driver.id];
  const staleLvl = meta ? staleLevel(meta.lastGpsMinutes) : "fresh";
  const lowPoints = meta && meta.pointsBalance < POINTS_WARN_THRESHOLD;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative shrink-0">
          <Avatar initials={driver.avatar} size="md" />
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
            ${staleLvl === "critical" ? "bg-red-500" : staleLvl === "stale" ? "bg-amber-400" : driver.onlineStatus === "online_available" ? "bg-green-500" : "bg-blue-500"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{driver.name}</p>
          <p className="text-xs text-slate-400 font-mono">{driver.id}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <OnlineBadge status={driver.onlineStatus as "online_available" | "online_busy" | "offline"} />
        <Badge variant={driver.verificationStatus as "approved" | "pending" | "rejected"} />
      </div>

      {staleLvl !== "fresh" && (
        <div className={`flex items-center gap-2 rounded-[8px] px-3 py-2 mb-3 text-xs font-medium
          ${staleLvl === "critical" ? "bg-red-50 border border-red-200 text-red-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
          <Clock size={12} />
          GPS last updated {meta ? gpsLabel(meta.lastGpsMinutes) : "unknown"}
        </div>
      )}

      {lowPoints && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2 mb-3 text-xs font-medium text-amber-700">
          <AlertTriangle size={12} />
          Low points balance — {meta?.pointsBalance} pts remaining
        </div>
      )}

      <div className="flex flex-col gap-2.5 text-xs mb-4">
        <div className="flex justify-between">
          <span className="text-slate-400">Phone</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-700 font-mono">{revealed ? driver.phone : maskPhone(driver.phone)}</span>
            <button onClick={onReveal} className="text-sky-500 hover:text-sky-700 text-[10px]">
              {revealed ? "Hide" : "Reveal"}
            </button>
          </div>
        </div>
        <div className="flex justify-between"><span className="text-slate-400">Vehicle</span><span className="text-slate-700 font-medium text-right max-w-[60%] truncate">{driver.vehicle.split(" · ")[0]}</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Area</span><span className="text-slate-700 font-medium">{driver.area}</span></div>
        {meta && <div className="flex justify-between"><span className="text-slate-400">City</span><span className="text-slate-700 font-medium">{meta.city}</span></div>}
        <div className="flex justify-between"><span className="text-slate-400">Rating</span><span className="text-slate-700 font-medium">{driver.rating.toFixed(2)} ★</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Rides</span><span className="text-slate-700 font-medium">{driver.totalRides.toLocaleString()}</span></div>
        {meta && (
          <div className="flex justify-between">
            <span className="text-slate-400">Points</span>
            <span className={`font-semibold tabular-nums ${lowPoints ? "text-amber-600" : "text-slate-700"}`}>
              {meta.pointsBalance.toLocaleString()} pts
            </span>
          </div>
        )}
        {driver.currentRide && (
          <div className="flex justify-between">
            <span className="text-slate-400">Current Ride</span>
            <span className="text-[#BE1B2C] font-mono font-medium">{driver.currentRide}</span>
          </div>
        )}
      </div>

      <Button variant="secondary" className="w-full" size="sm" icon={<Eye size={13} />} onClick={onViewProfile}>
        View Full Profile
      </Button>
    </Card>
  );
}

function MapBackground() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 700 460" fill="none" preserveAspectRatio="xMidYMid slice">
      <rect width="700" height="460" fill="#EFF3F8" />
      {[60, 140, 220, 300, 380, 460].map(y => (
        <line key={`h${y}`} x1="0" y1={y} x2="700" y2={y} stroke="#DDE3EC" strokeWidth="1" />
      ))}
      {[80, 180, 280, 380, 480, 580].map(x => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="460" stroke="#DDE3EC" strokeWidth="1" />
      ))}
      <line x1="0" y1="220" x2="700" y2="240" stroke="#D0D8E4" strokeWidth="4" />
      <line x1="280" y1="0" x2="310" y2="460" stroke="#D0D8E4" strokeWidth="4" />
      <path d="M0 350 Q200 280 400 320 T700 300" stroke="#D0D8E4" strokeWidth="3" fill="none" />
      <path d="M100 0 Q250 150 200 300 T350 460" stroke="#D0D8E4" strokeWidth="2.5" fill="none" />
      {[[90, 70, 80, 60], [200, 70, 60, 50], [350, 80, 100, 55], [490, 90, 70, 45],
        [90, 170, 70, 35], [200, 165, 60, 40], [350, 160, 90, 45], [510, 155, 65, 50],
        [95, 270, 75, 38], [195, 265, 65, 42], [390, 255, 70, 48],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill="#E2E8F0" />
      ))}
    </svg>
  );
}
