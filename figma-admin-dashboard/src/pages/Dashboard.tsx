import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, Download, AlertTriangle, CheckCircle2, TrendingUp, Activity,
  MapPin, Clock, ChevronRight, AlertOctagon, Navigation, WifiOff,
  Zap, Globe, Database, Bell, ShieldCheck, Filter,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { KpiCard, Card, AlertBanner, Button, Avatar, Select } from "../components/ui";
import { getDashboard } from "../api";
import { apiErrorMessage } from "../api/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

type DataState = "live" | "loading" | "stale" | "error";

interface DashboardData {
  activeRides?: number;
  onlineDrivers?: number;
  busyDrivers?: number;
  completedToday?: number;
  cancelledToday?: number;
  openDisputes?: number;
  lowBalanceDrivers?: number;
  stuckRides?: number;
  recentReservations?: Record<string, unknown>[];
  health?: Record<string, unknown>;
  rideTrend?: { date: string; completed: number; cancelled: number; disputed: number }[];
  [key: string]: unknown;
}

// ─── Static chart / health data ───────────────────────────────────────────────

const RIDE_STATUS_DIST = [
  { name: "Active",    value: 3,   color: "#BE1B2C" },
  { name: "Completed", value: 169, color: "#16A34A" },
  { name: "Cancelled", value: 11,  color: "#94A3B8" },
  { name: "Disputed",  value: 2,   color: "#DC2626" },
];

type HealthStatus = "operational" | "degraded" | "outage";
const HEALTH_SERVICES: { name: string; short: string; status: HealthStatus; latency: number; icon: React.ReactNode }[] = [
  { name: "Trip Dispatch",       short: "Dispatch",  status: "operational", latency: 142, icon: <Zap size={13} /> },
  { name: "Driver Location API", short: "Location",  status: "degraded",    latency: 480, icon: <Globe size={13} /> },
  { name: "Payments & Points",   short: "Payments",  status: "operational", latency: 88,  icon: <ShieldCheck size={13} /> },
  { name: "Notifications",       short: "Notifs",    status: "operational", latency: 220, icon: <Bell size={13} /> },
  { name: "Primary DB",          short: "Database",  status: "operational", latency: 12,  icon: <Database size={13} /> },
  { name: "Admin API",           short: "Admin API", status: "operational", latency: 67,  icon: <Globe size={13} /> },
];

// ─── Helper Components ────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-[10px] shadow-lg px-3.5 py-3 text-xs">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-100 rounded-[10px] animate-pulse ${className}`} />;
}

function TxIcon({ type }: { type: string }) {
  const green = ["welcome_credit", "purchased_credit", "reservation_release", "admin_refund", "admin_correction"];
  const red   = ["ride_debit", "offer_reservation"];
  const cls   = green.includes(type) ? "text-green-600 bg-green-50" : red.includes(type) ? "text-red-600 bg-red-50" : "text-[#BE1B2C] bg-red-50";
  const label = green.includes(type) ? "↑" : "↓";
  return <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${cls}`}>{label}</span>;
}

function LiveOpMap() {
  // Stylised Lagos metro grid with active ride positions
  const nodes: [number, number][] = [
    [48, 64], [130, 44], [220, 58], [310, 42], [394, 60],
    [60, 120], [148, 108], [238, 120], [320, 110], [400, 122],
    [72, 176], [160, 164], [250, 178], [334, 168], [410, 178],
  ];
  const routes: [number, number, number, number][] = [
    [48,64,130,44],[130,44,220,58],[220,58,310,42],[310,42,394,60],
    [48,64,60,120],[130,44,148,108],[220,58,238,120],[394,60,400,122],
    [60,120,148,108],[148,108,238,120],[238,120,320,110],[320,110,400,122],
    [60,120,72,176],[148,108,160,164],[238,120,250,178],[320,110,334,168],
    [72,176,160,164],[160,164,250,178],[250,178,334,168],[334,168,410,178],
  ];
  const activeRideDots: [number, number, boolean][] = [
    [90, 54, false], [180, 112, false], [280, 166, true],
  ];
  return (
    <svg viewBox="0 0 460 220" className="w-full h-full" style={{ minHeight: 140 }}>
      <rect width="460" height="220" fill="#F8FAFC" rx="10" />
      {routes.map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E2E8F0" strokeWidth="1.5" />
      ))}
      {nodes.map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#CBD5E1" />
      ))}
      {activeRideDots.map(([x,y,stuck], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="7" fill={stuck ? "#FEE2E2" : "#FEE2E2"} />
          <circle cx={x} cy={y} r="4.5" fill={stuck ? "#EF4444" : "#BE1B2C"} />
          {!stuck && (
            <circle cx={x} cy={y} r="9" fill="none" stroke="#BE1B2C" strokeOpacity="0.3" strokeWidth="1">
              <animate attributeName="r" values="6;14;6" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("Today");
  const [cityFilter, setCityFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dataState, setDataState] = useState<DataState>("loading");
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());
  const [secondsSince, setSecondsSince] = useState(0);
  const [dashboardData, setDashboardData] = useState<DashboardData>({});

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      setDataState(prev => prev === "stale" ? "loading" : prev);
      const data = await getDashboard();
      setDashboardData(data);
      setDataState("live");
      setLastUpdated(new Date());
      setSecondsSince(0);
    } catch (err) {
      console.error("Dashboard fetch error:", apiErrorMessage(err));
      setDataState("error");
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Track freshness
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      setSecondsSince(elapsed);
      if (elapsed > 300 && dataState === "live") setDataState("stale");
    }, 5000);
    return () => clearInterval(id);
  }, [lastUpdated, dataState]);

  const handleRefresh = useCallback(() => {
    setDataState("loading");
    fetchDashboard();
  }, [fetchDashboard]);

  // Derived data from API
  const activeRidesCount = dashboardData.activeRides ?? 0;
  const onlineDrivers = dashboardData.onlineDrivers ?? 0;
  const busyDrivers = dashboardData.busyDrivers ?? activeRidesCount;
  const completedToday = dashboardData.completedToday ?? 0;
  const cancelledToday = dashboardData.cancelledToday ?? 0;
  const openDisputes = dashboardData.openDisputes ?? 0;
  const lowBalanceDrivers = dashboardData.lowBalanceDrivers ?? 0;
  const stuckRidesCount = dashboardData.stuckRides ?? 0;
  const recentReservations = (dashboardData.recentReservations || []) as Record<string, unknown>[];
  const rideTrend = (dashboardData.rideTrend || []) as { date: string; completed: number; cancelled: number; disputed: number }[];

  const freshnessLabel = () => {
    if (dataState === "loading") return "Refreshing…";
    if (secondsSince < 60) return "just now";
    const m = Math.floor(secondsSince / 60);
    return `${m}m ago`;
  };

  const hasFilters = cityFilter !== "all" || vehicleFilter !== "all" || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header + Controls ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">
              Operations Overview
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Real-time platform health and ride operations.</p>
          </div>
          {/* Freshness indicator */}
          <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border
            ${dataState === "stale" ? "bg-amber-50 border-amber-200 text-amber-700"
              : dataState === "error" ? "bg-red-50 border-red-200 text-red-700"
              : "bg-slate-50 border-slate-200 text-slate-500"}`}>
            {dataState === "loading" ? (
              <RefreshCw size={11} className="animate-spin" />
            ) : dataState === "stale" ? (
              <AlertTriangle size={11} />
            ) : dataState === "error" ? (
              <WifiOff size={11} />
            ) : (
              <span className="w-2 h-2 rounded-full bg-green-500 live-pulse" />
            )}
            <span className="tabular-nums">{freshnessLabel()}</span>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period */}
          <div className="flex items-center bg-slate-100 rounded-[10px] p-1 gap-0.5">
            {["Today", "7 days", "30 days", "Custom"].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all
                  ${period === p ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {p}
              </button>
            ))}
          </div>
          <Select
            value={cityFilter}
            onChange={setCityFilter}
            options={[
              { value: "all", label: "All Cities" },
              { value: "lagos", label: "Lagos" },
              { value: "abuja", label: "Abuja" },
              { value: "ph", label: "Port Harcourt" },
            ]}
            className="w-36"
          />
          <Select
            value={vehicleFilter}
            onChange={setVehicleFilter}
            options={[
              { value: "all", label: "All Vehicles" },
              { value: "sedan", label: "Sedan" },
              { value: "suv", label: "SUV" },
              { value: "premium", label: "Premium" },
            ]}
            className="w-36"
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "active", label: "Active only" },
              { value: "disputed", label: "Disputed" },
              { value: "stuck", label: "Stuck" },
            ]}
            className="w-36"
          />
          {hasFilters && (
            <button onClick={() => { setCityFilter("all"); setVehicleFilter("all"); setStatusFilter("all"); }}
              className="flex items-center gap-1.5 text-xs text-[#BE1B2C] hover:text-[#A31725] font-medium transition-colors">
              <Filter size={11} /> Clear filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm"
              icon={<RefreshCw size={14} className={dataState === "loading" ? "animate-spin" : ""} />}
              onClick={handleRefresh}>
              Refresh
            </Button>
            <Button variant="secondary" size="sm" icon={<Download size={14} />}>
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stale / Error banners ─────────────────────────────────────── */}
      {dataState === "stale" && (
        <AlertBanner
          type="warning"
          title="Data may be stale"
          message="Dashboard data was last refreshed over 5 minutes ago. Click Refresh to get the latest data."
          onClose={() => setDataState("live")}
        />
      )}
      {dataState === "error" && (
        <AlertBanner
          type="danger"
          title="Failed to refresh dashboard data"
          message="Could not connect to the server. Showing last cached data. Check your network connection."
          onClose={() => setDataState("live")}
        />
      )}

      {/* ── 8 KPI Cards ───────────────────────────────────────────────── */}
      {dataState === "loading" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[14px] border border-slate-200 p-4 flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-2 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <KpiCard label="Active Rides" value={activeRidesCount}
            sparkline={[2,3,2,4,3,5,activeRidesCount]}
            trend="up" delta="+1 from 1h ago"
            tooltip="Rides currently in progress"
            onClick={() => navigate("/rides/live")} />
          <KpiCard label="Online Drivers" value={onlineDrivers}
            sparkline={[240,255,261,270,278,280,onlineDrivers]}
            trend="up" delta="↑ since yesterday"
            tooltip="Drivers currently online and accepting rides"
            onClick={() => navigate("/online-drivers")} />
          <KpiCard label="Busy Drivers" value={busyDrivers}
            sparkline={[3,4,3,5,4,6,busyDrivers]}
            tooltip="Drivers currently on an active trip" />
          <KpiCard label="Completed Today" value={completedToday}
            sparkline={[148,162,141,175,158,169,completedToday]}
            trend="up" tooltip="Rides completed today"
            onClick={() => navigate("/rides/completed")} />
          <KpiCard label="Cancelled Today" value={cancelledToday}
            sparkline={[18,14,21,12,16,11,cancelledToday]}
            trend="down" tooltip="Rides cancelled today"
            onClick={() => navigate("/rides/cancelled")} />
          <KpiCard label="Open Disputes" value={openDisputes}
            urgent={openDisputes > 0}
            sparkline={[2,1,3,1,4,2,openDisputes]}
            tooltip="Rides with unresolved passenger or driver disputes"
            onClick={() => navigate("/rides/disputes")} />
          <KpiCard label="Low Bal Drivers" value={lowBalanceDrivers}
            urgent={lowBalanceDrivers > 0}
            tooltip="Drivers with fewer than 20 available points — cannot accept rides"
            onClick={() => navigate("/points/balances")} />
          <KpiCard label="Stuck Rides" value={stuckRidesCount}
            urgent={stuckRidesCount > 0}
            sparkline={[0,0,1,0,1,1,stuckRidesCount]}
            tooltip="Rides in the same state for an abnormally long time"
            onClick={() => navigate("/rides/stuck")} />
        </div>
      )}

      {/* ── Row: Rides Trend | Status Dist ────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={14} className="text-[#BE1B2C]" /> Ride Volume Trend
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 7 days — completed, cancelled & disputed</p>
            </div>
            <div className="flex items-center gap-4">
              {[{ c: "#BE1B2C", l: "Completed" }, { c: "#94A3B8", l: "Cancelled" }, { c: "#DC2626", l: "Disputed" }].map(x => (
                <div key={x.l} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: x.c }} />
                  <span className="text-[11px] text-slate-500">{x.l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={184}>
            <AreaChart data={rideTrend.length > 0 ? rideTrend : [{ date: "No data", completed: 0, cancelled: 0, disputed: 0 }]} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#BE1B2C" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#BE1B2C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCancelled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gDisputed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }} />
              <Area type="monotone" dataKey="completed" stroke="#BE1B2C" strokeWidth={2} fill="url(#gCompleted)" dot={false} name="Completed" />
              <Area type="monotone" dataKey="cancelled"  stroke="#94A3B8" strokeWidth={2} fill="url(#gCancelled)"  dot={false} name="Cancelled" />
              <Area type="monotone" dataKey="disputed"   stroke="#DC2626" strokeWidth={2} fill="url(#gDisputed)"   dot={false} name="Disputed" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Ride Status Distribution</h2>
            <p className="text-xs text-slate-400 mt-0.5">Today&apos;s breakdown by status</p>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={RIDE_STATUS_DIST} dataKey="value" cx="50%" cy="50%"
                innerRadius={38} outerRadius={60} paddingAngle={3} startAngle={90} endAngle={-270}>
                {RIDE_STATUS_DIST.map((e, i) => <Cell key={i} fill={e.color} strokeWidth={0} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "10px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
            {RIDE_STATUS_DIST.map(s => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-xs text-slate-500 flex-1">{s.name}</span>
                <span className="text-xs font-bold text-slate-800 tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row: Live Operations | Critical Alerts ────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Live Operations */}
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="live-pulse w-2 h-2 rounded-full bg-green-500" />
              <h2 className="text-sm font-bold text-slate-800">Live Operations</h2>
              <span className="text-xs bg-[#BE1B2C] text-white px-2 py-0.5 rounded-full font-semibold">{activeRidesCount}</span>
            </div>
            <button onClick={() => navigate("/rides/live")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              Open Live Operations <ChevronRight size={13} />
            </button>
          </div>

          <div className="p-4">
            <div className="rounded-[10px] overflow-hidden border border-slate-100 mb-3" style={{ height: 160 }}>
              <LiveOpMap />
            </div>

            {/* Driver summary strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-[10px] p-3 text-center">
                <p className="text-[22px] font-bold text-slate-800 tabular-nums leading-none">{onlineDrivers}</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online
                </p>
              </div>
              <div className="bg-slate-50 rounded-[10px] p-3 text-center">
                <p className="text-[22px] font-bold text-slate-800 tabular-nums leading-none">{busyDrivers}</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1">
                  <Navigation size={10} /> On trip
                </p>
              </div>
              <div className="bg-slate-50 rounded-[10px] p-3 text-center">
                <p className={`text-[22px] font-bold tabular-nums leading-none ${stuckRidesCount > 0 ? "text-red-600" : "text-slate-800"}`}>
                  {stuckRidesCount}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1">
                  <AlertTriangle size={10} /> Stuck
                </p>
              </div>
            </div>

            {/* Active ride list */}
            <div className="flex flex-col gap-1 mt-3">
              {recentReservations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No active rides right now.</p>
              ) : recentReservations.slice(0, 5).map((ride: Record<string, unknown>, i: number) => (
                <div key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-[8px] hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate("/rides/live")}>
                  <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{String(ride._id || ride.id || "N/A").slice(-8)}</span>
                  <RideStatusBadge status={String(ride.status || "unknown")} />
                  <span className="text-xs text-slate-600 flex-1 truncate">
                    {(ride.driver as Record<string, unknown>)?.name ? String((ride.driver as Record<string, unknown>).name) : "Driver"}
                    {" → "}
                    {(ride.user as Record<string, unknown>)?.name ? String((ride.user as Record<string, unknown>).name) : "Passenger"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Critical Alerts */}
        <Card>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <AlertOctagon size={14} className="text-red-500" />
              <h2 className="text-sm font-bold text-slate-800">Critical Alerts</h2>
              {critAlerts.length > 0 && (
                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">{critAlerts.length}</span>
              )}
            </div>
            <button onClick={() => navigate("/alerts")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              All alerts <ChevronRight size={13} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {openAlerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 px-5 text-center">
                <CheckCircle2 size={22} className="text-green-400" />
                <p className="text-sm font-medium text-slate-600">All clear</p>
                <p className="text-xs text-slate-400">No open alerts at this time.</p>
              </div>
            ) : openAlerts.slice(0, 5).map(alert => (
              <div key={alert.id}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => navigate("/alerts")}>
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0
                  ${alert.severity === "critical" ? "bg-red-500" : alert.severity === "warning" ? "bg-amber-500" : "bg-sky-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 leading-snug">{alert.title}</p>
                  {(alert.rideId || alert.driverId) && (
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{alert.rideId ?? alert.driverId}</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock size={9} /> {formatRelTime(alert.createdAt)}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5
                  ${alert.severity === "critical" ? "bg-red-50 text-red-600 border border-red-200"
                    : alert.severity === "warning" ? "bg-amber-50 text-amber-600 border border-amber-200"
                    : "bg-sky-50 text-sky-700 border border-sky-200"}`}>
                  {alert.severity}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row: Ride Activity | Points Activity ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Ride Activity */}
        <Card>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Activity size={14} className="text-[#BE1B2C]" />
              <h2 className="text-sm font-bold text-slate-800">Ride Activity</h2>
            </div>
            <button onClick={() => navigate("/rides/all")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              All rides <ChevronRight size={13} />
            </button>
          </div>

          {recentReservations.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">No recent ride activity.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentReservations.slice(0, 7).map((ev: Record<string, unknown>, i: number) => {
                const driver = ev.driver as Record<string, unknown> | undefined;
                const user = ev.user as Record<string, unknown> | undefined;
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate("/rides/live")}>
                    <Avatar initials={String(driver?.name || "D").split(" ").map((n: string) => n[0]).join("").slice(0, 2)} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700">{String(driver?.name || "Driver")}</span>
                        <span className="text-slate-300 text-xs">→</span>
                        <span className="text-xs text-slate-500">{String(user?.name || "Passenger")}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <RideStatusBadge status={String(ev.status || "unknown")} />
                        <span className="text-[11px] text-slate-400 font-mono">{String(ev._id || ev.id || "").slice(-8)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-slate-400">{formatRelTime(String(ev.updatedAt || ev.createdAt || ""))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Points Activity */}
        <Card>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-violet-500" />
              <h2 className="text-sm font-bold text-slate-800">Points Activity</h2>
            </div>
            <button onClick={() => navigate("/points/transactions")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              All transactions <ChevronRight size={13} />
            </button>
          </div>

          <div className="py-10 text-center">
              <p className="text-sm text-slate-400">No recent point transactions.</p>
              <button onClick={() => navigate("/points/transactions")} className="text-xs text-[#BE1B2C] font-medium mt-2 hover:underline">View all transactions →</button>
            </div>
        </Card>
      </div>

      {/* ── System Health Strip ────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-500" /> System Health
          </h2>
          <button onClick={() => navigate("/system-health")}
            className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
            Full status <ChevronRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {HEALTH_SERVICES.map(svc => (
            <button key={svc.name} onClick={() => navigate("/system-health")}
              className={`flex flex-col items-start gap-1.5 px-3 py-2.5 rounded-[10px] border text-left transition-all hover:shadow-sm
                ${svc.status === "operational" ? "bg-slate-50 border-slate-200"
                  : svc.status === "degraded"    ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-1.5 w-full justify-between">
                <span className={svc.status === "operational" ? "text-slate-400" : svc.status === "degraded" ? "text-amber-600" : "text-red-600"}>
                  {svc.icon}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0
                  ${svc.status === "operational" ? "bg-green-500" : svc.status === "degraded" ? "bg-amber-500" : "bg-red-500"}`} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-700 leading-tight">{svc.short}</p>
                <p className={`text-[11px] tabular-nums mt-0.5 font-medium
                  ${svc.latency > 300 ? "text-amber-600" : "text-slate-400"}`}>
                  {svc.latency}ms
                </p>
              </div>
            </button>
          ))}
        </div>
        {HEALTH_SERVICES.some(s => s.status !== "operational") && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
            <AlertTriangle size={12} /> Driver Location API latency elevated (480ms vs 120ms baseline). Engineering investigating.
          </div>
        )}
      </Card>

    </div>
  );
}

// ─── Exported badge (used by ride pages) ─────────────────────────────────────

export function RideStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    offer_sent:        { label: "Offer Sent",        cls: "bg-slate-100 text-slate-600 border-slate-200" },
    offer_accepted:    { label: "Accepted",          cls: "bg-amber-50 text-amber-700 border-amber-200"     },
    driver_on_way:     { label: "On the Way",        cls: "bg-amber-50 text-amber-700 border-amber-200"     },
    driver_arrived:    { label: "Arrived",           cls: "bg-violet-50 text-violet-700 border-violet-200" },
    pickup_confirmed:  { label: "Pickup Confirmed",  cls: "bg-violet-50 text-violet-700 border-violet-200" },
    ride_started:      { label: "In Progress",       cls: "bg-green-50 text-green-700 border-green-200"  },
    completed:         { label: "Completed",         cls: "bg-green-50 text-green-700 border-green-200"  },
    cancelled:         { label: "Cancelled",            cls: "bg-slate-100 text-slate-500 border-slate-200" },
    cancelled_user:    { label: "Cancelled by User",    cls: "bg-slate-100 text-slate-500 border-slate-200" },
    cancelled_driver:  { label: "Cancelled by Driver",  cls: "bg-amber-50 text-amber-700 border-amber-200"  },
    cancelled_admin:   { label: "Cancelled by Admin",   cls: "bg-red-50 text-red-600 border-red-200"        },
    disputed:          { label: "Disputed",             cls: "bg-red-50 text-red-700 border-red-200"        },
    technical_failure: { label: "Tech Failure",         cls: "bg-red-50 text-red-700 border-red-200"        },
    stuck:             { label: "Stuck",                cls: "bg-red-50 text-red-700 border-red-200"        },
  };
  const s = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function txTypeLabel(type: string) {
  const m: Record<string, string> = {
    welcome_credit: "Welcome credit", purchased_credit: "Purchased", offer_reservation: "Reserved",
    reservation_release: "Released", ride_debit: "Ride debit", admin_refund: "Admin refund",
    admin_correction: "Correction",
  };
  return m[type] ?? type;
}

function formatRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
