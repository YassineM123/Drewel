import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, Download, AlertTriangle, CheckCircle2, TrendingUp, Activity,
  MapPin, ChevronRight, AlertOctagon, Navigation, WifiOff,
  Zap, Globe, Database, Bell, ShieldCheck, Filter,
} from "lucide-react";
import PropTypes from "prop-types";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { getDashboard } from "../api/domains/dashboard";
import { getPointTransactions } from "../api/domains/points";
import { getDriverRankings } from "../api/domains/drivers";
import { useSocket } from "../context/SocketContext";
import { presenceVersion, shouldApplyPresence } from "../utils/driverPresence";

const emptyDashboard = {
  totalUsers: 0,
  totalDrivers: 0,
  onlineDrivers: 0,
  discoverableDrivers: 0,
  restrictedUsers: 0,
  restrictedDrivers: 0,
  pendingApproval1: 0,
  pendingApproval2: 0,
  activeReservations: 0,
  pendingTripOffers: 0,
  completedToday: 0,
  cancelledToday: 0,
  openDisputes: 0,
  stuckRides: 0,
  lowBalanceDrivers: 0,
  pendingPointPurchaseRequests: 0,
  unreadRideMessages: 0,
  activeCalls: 0,
  reportedSecureCalls: 0,
  openSupportReports: 0,
  lowBalanceThreshold: 20,
  health: {},
  recentReservations: [],
};

const number = (value) => Number(value || 0).toLocaleString();

const statusLabel = (value) =>
  String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

const relTime = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "-";
  const m = Math.floor((Date.now() - date.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const healthState = (value, fallback = "unknown") => {
  if (!value) return fallback;
  if (["operational", "configured"].includes(value)) return "operational";
  if (value === "not_configured" || value === "degraded") return "degraded";
  return "outage";
};

function Skeleton({ className = "" }) {
  return <div className={`bg-slate-100 rounded-[10px] animate-pulse ${className}`} />;
}

Skeleton.propTypes = {
  className: PropTypes.string,
};

function TxIcon({ type }) {
  const green = ["welcome_credit", "purchased_credit", "reservation_release", "admin_refund", "admin_correction"];
  const red = ["ride_debit", "offer_reservation"];
  const cls = green.includes(type) ? "text-green-600 bg-green-50" : red.includes(type) ? "text-red-600 bg-red-50" : "text-[#BE1B2C] bg-red-50";
  const label = green.includes(type) ? "\u2191" : "\u2193";
  return <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${cls}`}>{label}</span>;
}

TxIcon.propTypes = {
  type: PropTypes.string,
};

function txTypeLabel(type) {
  const m = {
    welcome_credit: "Welcome credit",
    purchased_credit: "Purchased",
    offer_reservation: "Reserved",
    reservation_release: "Released",
    ride_debit: "Ride debit",
    admin_refund: "Admin refund",
    admin_correction: "Correction",
  };
  return m[type] || statusLabel(type);
}

export function RideStatusBadge({ status }) {
  const map = {
    offer_sent: { label: "Offer Sent", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    offer_accepted: { label: "Accepted", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    driver_on_way: { label: "On the Way", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    driver_arrived: { label: "Arrived", cls: "bg-violet-50 text-violet-700 border-violet-200" },
    pickup_confirmed: { label: "Pickup Confirmed", cls: "bg-violet-50 text-violet-700 border-violet-200" },
    ride_started: { label: "In Progress", cls: "bg-green-50 text-green-700 border-green-200" },
    completed: { label: "Completed", cls: "bg-green-50 text-green-700 border-green-200" },
    cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500 border-slate-200" },
    cancelled_user: { label: "Cancelled by User", cls: "bg-slate-100 text-slate-500 border-slate-200" },
    cancelled_driver: { label: "Cancelled by Driver", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    cancelled_admin: { label: "Cancelled by Admin", cls: "bg-red-50 text-red-600 border-red-200" },
    disputed: { label: "Disputed", cls: "bg-red-50 text-red-700 border-red-200" },
    technical_failure: { label: "Tech Failure", cls: "bg-red-50 text-red-700 border-red-200" },
    stuck: { label: "Stuck", cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const s = map[status] || { label: statusLabel(status), cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

RideStatusBadge.propTypes = {
  status: PropTypes.string,
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-[10px] shadow-lg px-3.5 py-3 text-xs">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(
    PropTypes.shape({
      color: PropTypes.string,
      name: PropTypes.string,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
  ),
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

const HEALTH_SERVICES = [
  { name: "Admin API", short: "Admin API", key: "api", icon: <Globe size={13} /> },
  { name: "Database", short: "Database", key: "database", icon: <Database size={13} /> },
  { name: "Socket.IO", short: "Socket", key: "socketIo", icon: <Zap size={13} /> },
  { name: "Notifications", short: "Notifs", key: "notifications", icon: <Bell size={13} /> },
  { name: "Storage", short: "Storage", key: "storage", icon: <ShieldCheck size={13} /> },
  { name: "Trip Dispatch", short: "Dispatch", key: "dispatch", icon: <Zap size={13} /> },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [period, setPeriod] = useState("Today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [dataState, setDataState] = useState("loading");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [transactions, setTransactions] = useState([]);
  const [topDrivers, setTopDrivers] = useState([]);
  const presenceVersions = useRef(new Map());
  const refreshTimer = useRef(null);
  const [secondsSince, setSecondsSince] = useState(0);

  const periodRange = useMemo(() => {
    const to = new Date();
    if (period === "7 days") {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (period === "30 days") {
      const from = new Date();
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (period === "Custom" && customFrom && customTo) {
      return { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() };
    }
    return null;
  }, [period, customFrom, customTo]);

  const dashboardParams = useMemo(() => {
    const params = {};
    if (periodRange) {
      params.from = periodRange.from;
      params.to = periodRange.to;
    }
    if (vehicleFilter !== "all") params.vehicleType = vehicleFilter;
    return params;
  }, [periodRange, vehicleFilter]);

  const loadDashboard = useCallback(async ({ background = false } = {}) => {
    if (!background) setDataState("loading");
    setError("");
    try {
      const [dashRes, txRes, rankRes] = await Promise.allSettled([
        getDashboard(dashboardParams),
        getPointTransactions({ limit: 7, page: 1 }),
        getDriverRankings({ limit: 5, page: 1 }),
      ]);
      if (dashRes.status === "rejected") throw dashRes.reason;
      const nextDash = { ...emptyDashboard, ...(dashRes.value || {}) };
      setDashboard(nextDash);
      setTransactions(
        txRes.status === "fulfilled"
          ? (txRes.value?.transactions || [])
          : []
      );
      setTopDrivers(
        rankRes.status === "fulfilled"
          ? (rankRes.value?.drivers || [])
          : []
      );
      setLastUpdated(new Date());
      setDataState("live");
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Unable to load dashboard data.");
      setDataState("error");
    }
  }, [dashboardParams]);

  useEffect(() => {
    loadDashboard();
    const poll = window.setInterval(() => loadDashboard({ background: true }), 30000);
    return () => window.clearInterval(poll);
  }, [loadDashboard]);

  useEffect(() => {
    if (!socket || !isConnected) return undefined;
    const onPresence = (update) => {
      const driverId = String(update?.driverId || "");
      if (!driverId) return;
      const cur = presenceVersions.current.get(driverId);
      if (!shouldApplyPresence(cur, update)) return;
      presenceVersions.current.set(driverId, presenceVersion(update.version));
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => loadDashboard({ background: true }), 250);
    };
    socket.on("driver:presence", onPresence);
    return () => {
      socket.off("driver:presence", onPresence);
      window.clearTimeout(refreshTimer.current);
    };
  }, [socket, isConnected, loadDashboard]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!lastUpdated) return;
      const elapsed = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      setSecondsSince(elapsed);
    }, 5000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const recentReservations = useMemo(
    () => (Array.isArray(dashboard.recentReservations) ? dashboard.recentReservations : []),
    [dashboard.recentReservations],
  );
  const activeRides = Number(dashboard.activeReservations || 0);
  const stuckRides = Number(dashboard.stuckRides || 0);
  const disputes = Number(dashboard.openDisputes || 0);
  const supportReports = Number(dashboard.openSupportReports || 0);
  const onlineDrivers = Number(dashboard.onlineDrivers || 0);

  const freshnessLabel =
    dataState === "loading" ? "Refreshing\u2026" :
    dataState === "error" ? "Error" :
    secondsSince < 60 ? "just now" : `${Math.floor(secondsSince / 60)}m ago`;

  const rideTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { key: d.toISOString().slice(0, 10), date: d.toLocaleDateString("en-US", { weekday: "short" }), completed: 0, cancelled: 0, disputed: 0 };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));
    recentReservations.forEach((ride) => {
      const key = new Date(ride.updatedAt || ride.createdAt || Date.now()).toISOString().slice(0, 10);
      const b = byKey.get(key);
      if (!b) return;
      const s = String(ride.status || "");
      if (s.includes("cancel")) b.cancelled += 1;
      else if (s.includes("disput")) b.disputed += 1;
      else if (s.includes("complete")) b.completed += 1;
    });
    const today = days[days.length - 1];
    today.completed = Math.max(today.completed, Number(dashboard.completedToday || 0));
    today.cancelled = Math.max(today.cancelled, Number(dashboard.cancelledToday || 0));
    today.disputed = Math.max(today.disputed, disputes);
    return days;
  }, [dashboard.completedToday, dashboard.cancelledToday, disputes, recentReservations]);

  const statusDist = useMemo(() => [
    { name: "Active", value: activeRides, color: "#BE1B2C" },
    { name: "Completed", value: Number(dashboard.completedToday || 0), color: "#16A34A" },
    { name: "Cancelled", value: Number(dashboard.cancelledToday || 0), color: "#94A3B8" },
    { name: "Disputed", value: disputes, color: "#DC2626" },
  ], [activeRides, dashboard.completedToday, dashboard.cancelledToday, disputes]);

  const alerts = useMemo(() => [
    stuckRides > 0 && { id: 1, type: "danger", title: `${stuckRides} stuck reservation${stuckRides > 1 ? "s" : ""}`, body: "A ride has stayed in the same state longer than expected.", path: "/rides/stuck" },
    disputes > 0 && { id: 2, type: "warning", title: `${disputes} open dispute${disputes > 1 ? "s" : ""}`, body: "Operations review is required.", path: "/rides/disputes" },
    supportReports > 0 && { id: 3, type: "warning", title: `${supportReports} profile support report${supportReports > 1 ? "s" : ""}`, body: "Passenger or driver profile reports need review.", path: "/users" },
    Number(dashboard.pendingApproval1 || 0) + Number(dashboard.pendingApproval2 || 0) > 0 && { id: 4, type: "info", title: "Verification queue pending", body: `${number(Number(dashboard.pendingApproval1 || 0) + Number(dashboard.pendingApproval2 || 0))} request(s) need review.`, path: "/verification/pending" },
  ].filter(Boolean), [stuckRides, disputes, supportReports, dashboard.pendingApproval1, dashboard.pendingApproval2]);

  const healthServices = useMemo(() => HEALTH_SERVICES.map((svc) => ({
    ...svc,
    status: healthState(dashboard.health?.[svc.key], dataState === "error" ? "outage" : svc.key === "api" && dataState === "error" ? "outage" : "operational"),
    latency: svc.key === "api" ? dashboard.health?.latencyMs : null,
  })), [dashboard.health, dataState]);

  const periodLabel =
    period === "Today" ? "Today" :
    period === "7 days" ? "Last 7 days" :
    period === "30 days" ? "Last 30 days" :
    "Custom range";

  const hasFilters = period !== "Today" || vehicleFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">Operations Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">Real-time platform health and ride operations.</p>
          </div>
          <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border
            ${dataState === "stale" ? "bg-amber-50 border-amber-200 text-amber-700"
              : dataState === "error" ? "bg-red-50 border-red-200 text-red-700"
              : "bg-slate-50 border-slate-200 text-slate-500"}`}>
            {dataState === "loading" ? <RefreshCw size={11} className="animate-spin" /> :
             dataState === "error" ? <WifiOff size={11} /> :
             <span className="w-2 h-2 rounded-full bg-green-500 live-pulse" />}
            <span className="tabular-nums">{freshnessLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 rounded-[10px] p-1 gap-0.5">
            {["Today", "7 days", "30 days", "Custom"].map((p) => (
              <button key={p} type="button" onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all ${period === p ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {p}
              </button>
            ))}
          </div>
          {period === "Custom" && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                max={customTo || undefined}
                className="h-9 bg-white border border-slate-200 rounded-[10px] px-2.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-700/20" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                min={customFrom || undefined}
                className="h-9 bg-white border border-slate-200 rounded-[10px] px-2.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-700/20" />
            </div>
          )}
          <select className="h-9 bg-white border border-slate-200 rounded-[10px] px-3 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-700/20" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)}>
            <option value="all">All Vehicles</option>
            <option value="large_pickup">Large Pickup</option>
            <option value="small_pickup">Small Pickup</option>
          </select>
          {hasFilters && (
            <button type="button" onClick={() => { setPeriod("Today"); setCustomFrom(""); setCustomTo(""); setVehicleFilter("all"); }}
              className="flex items-center gap-1.5 text-xs text-[#BE1B2C] hover:text-[#A31725] font-medium transition-colors">
              <Filter size={11} /> Clear filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => loadDashboard()} disabled={dataState === "loading"}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50 shadow-sm">
              <RefreshCw size={14} className={dataState === "loading" ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button"
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3" role="alert">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Failed to refresh dashboard data</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => loadDashboard()} className="text-xs font-semibold text-red-700 hover:text-red-900 shrink-0">Retry</button>
        </div>
      )}

      {alerts.slice(0, 2).map((alert) => (
        <button key={alert.id} type="button" onClick={() => navigate(alert.path)}
          className={`flex items-start gap-3 rounded-[10px] px-4 py-3 text-left transition-colors border
            ${alert.type === "danger" ? "bg-red-50 border-red-200 hover:bg-red-100" :
              alert.type === "warning" ? "bg-amber-50 border-amber-200 hover:bg-amber-100" :
              "bg-sky-50 border-sky-200 hover:bg-sky-100"}`}>
          <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${alert.type === "danger" ? "text-red-500" : alert.type === "warning" ? "text-amber-500" : "text-sky-500"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${alert.type === "danger" ? "text-red-800" : alert.type === "warning" ? "text-amber-800" : "text-sky-800"}`}>{alert.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{alert.body}</p>
          </div>
          <ChevronRight size={14} className="text-slate-400 shrink-0 mt-1" />
        </button>
      ))}

      {dataState === "loading" && !recentReservations.length ? (
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
          <button type="button" onClick={() => navigate("/rides/live")}
            className="bg-white rounded-[14px] border border-slate-200 p-4 flex flex-col gap-2 text-left hover:shadow-md hover:border-red-200 transition-all cursor-pointer">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Active Rides</span>
            <strong className="text-2xl font-bold text-slate-800 tabular-nums">{number(activeRides)}</strong>
            <span className="text-[11px] text-slate-400">Rides in progress</span>
          </button>
          <button type="button" onClick={() => navigate("/online-drivers")}
            className="bg-white rounded-[14px] border border-slate-200 p-4 flex flex-col gap-2 text-left hover:shadow-md hover:border-red-200 transition-all cursor-pointer">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Online Drivers</span>
            <strong className="text-2xl font-bold text-slate-800 tabular-nums">{number(onlineDrivers)}</strong>
            <span className="text-[11px] text-slate-400">Currently online</span>
          </button>
          <button type="button" onClick={() => navigate("/drivers")}
            className="bg-white rounded-[14px] border border-slate-200 p-4 flex flex-col gap-2 text-left hover:shadow-md hover:border-red-200 transition-all cursor-pointer">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Discoverable</span>
            <strong className="text-2xl font-bold text-slate-800 tabular-nums">{number(dashboard.discoverableDrivers)}</strong>
            <span className="text-[11px] text-slate-400">Eligible for discovery</span>
          </button>
          <button type="button" onClick={() => navigate("/rides/all")}
            className="bg-white rounded-[14px] border border-slate-200 p-4 flex flex-col gap-2 text-left hover:shadow-md hover:border-red-200 transition-all cursor-pointer">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Completed</span>
            <strong className="text-2xl font-bold text-slate-800 tabular-nums">{number(dashboard.completedToday)}</strong>
            <span className="text-[11px] text-slate-400">Rides completed &middot; {periodLabel}</span>
          </button>
          <button type="button" onClick={() => navigate("/rides/cancelled")}
            className="bg-white rounded-[14px] border border-slate-200 p-4 flex flex-col gap-2 text-left hover:shadow-md hover:border-red-200 transition-all cursor-pointer">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Cancelled</span>
            <strong className="text-2xl font-bold text-slate-800 tabular-nums">{number(dashboard.cancelledToday)}</strong>
            <span className="text-[11px] text-slate-400">Rides cancelled &middot; {periodLabel}</span>
          </button>
          <button type="button" onClick={() => navigate("/rides/disputes")}
            className={`bg-white rounded-[14px] border p-4 flex flex-col gap-2 text-left hover:shadow-md transition-all cursor-pointer ${disputes > 0 ? "border-red-300 hover:border-red-400" : "border-slate-200 hover:border-red-200"}`}>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Open Disputes</span>
            <strong className={`text-2xl font-bold tabular-nums ${disputes > 0 ? "text-red-600" : "text-slate-800"}`}>{number(disputes)}</strong>
            <span className="text-[11px] text-slate-400">Awaiting resolution</span>
          </button>
          <button type="button" onClick={() => navigate("/users")}
            className={`bg-white rounded-[14px] border p-4 flex flex-col gap-2 text-left hover:shadow-md transition-all cursor-pointer ${supportReports > 0 ? "border-amber-300 hover:border-amber-400" : "border-slate-200 hover:border-red-200"}`}>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Profile Reports</span>
            <strong className={`text-2xl font-bold tabular-nums ${supportReports > 0 ? "text-amber-600" : "text-slate-800"}`}>{number(supportReports)}</strong>
            <span className="text-[11px] text-slate-400">Need review</span>
          </button>
          <button type="button" onClick={() => navigate("/rides/stuck")}
            className={`bg-white rounded-[14px] border p-4 flex flex-col gap-2 text-left hover:shadow-md transition-all cursor-pointer ${stuckRides > 0 ? "border-red-300 hover:border-red-400" : "border-slate-200 hover:border-red-200"}`}>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Stuck Rides</span>
            <strong className={`text-2xl font-bold tabular-nums ${stuckRides > 0 ? "text-red-600" : "text-slate-800"}`}>{number(stuckRides)}</strong>
            <span className="text-[11px] text-slate-400">Need intervention</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-[14px] border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><TrendingUp size={14} className="text-[#BE1B2C]" /> Ride Volume Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 7 days from live reservation counters.</p>
            </div>
            <div className="flex items-center gap-4">
              {[{ c: "#BE1B2C", l: "Completed" }, { c: "#94A3B8", l: "Cancelled" }, { c: "#DC2626", l: "Disputed" }].map((x) => (
                <div key={x.l} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: x.c }} />
                  <span className="text-[11px] text-slate-500">{x.l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={rideTrend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
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
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }} />
              <Area type="monotone" dataKey="completed" stroke="#BE1B2C" strokeWidth={2} fill="url(#gCompleted)" dot={false} name="Completed" />
              <Area type="monotone" dataKey="cancelled" stroke="#94A3B8" strokeWidth={2} fill="url(#gCancelled)" dot={false} name="Cancelled" />
              <Area type="monotone" dataKey="disputed" stroke="#DC2626" strokeWidth={2} fill="url(#gDisputed)" dot={false} name="Disputed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-[14px] border border-slate-200 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800">Ride Status Distribution</h2>
            <p className="text-xs text-slate-400 mt-0.5">Current operations breakdown</p>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3} startAngle={90} endAngle={-270}>
                {statusDist.map((e, i) => <Cell key={i} fill={e.color} strokeWidth={0} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "10px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
            {statusDist.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-xs text-slate-500 flex-1">{s.name}</span>
                <span className="text-xs font-bold text-slate-800 tabular-nums">{number(s.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-[14px] border border-slate-200">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-green-500 live-pulse" />
              <h2 className="text-sm font-bold text-slate-800">Live Operations</h2>
              <span className="text-xs bg-[#BE1B2C] text-white px-2 py-0.5 rounded-full font-semibold">{number(activeRides)}</span>
            </div>
            <button type="button" onClick={() => navigate("/rides/live")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              Open Live Operations <ChevronRight size={13} />
            </button>
          </div>
          <div className="p-4">
            <div className="rounded-[10px] overflow-hidden border border-slate-100 mb-3" style={{ height: 160 }}>
              <svg viewBox="0 0 460 220" className="w-full h-full" style={{ minHeight: 140 }}>
                <rect width="460" height="220" fill="#F8FAFC" rx="10" />
                {[[48,64,130,44],[130,44,220,58],[220,58,310,42],[310,42,394,60],[60,120,148,108],[148,108,238,120],[238,120,320,110],[320,110,400,122],[72,176,160,164],[160,164,250,178],[250,178,334,168],[334,168,410,178]].map(([x1,y1,x2,y2], i) => (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E2E8F0" strokeWidth="1.5" />
                ))}
                {[[48,64],[130,44],[220,58],[310,42],[394,60],[60,120],[148,108],[238,120],[320,110],[400,122],[72,176],[160,164],[250,178],[334,168],[410,178]].map(([x,y], i) => (
                  <circle key={i} cx={x} cy={y} r="3.5" fill="#CBD5E1" />
                ))}
                {recentReservations.slice(0, 3).map((ride, i) => {
                  const pts = [[90,54],[180,112],[280,166]];
                  const [x, y] = pts[i % pts.length];
                  const stuck = String(ride.status || "").includes("stuck");
                  return (
                    <g key={ride.id || i}>
                      <circle cx={x} cy={y} r="7" fill="#FEE2E2" />
                      <circle cx={x} cy={y} r="4.5" fill={stuck ? "#EF4444" : "#BE1B2C"} />
                      {!stuck && (
                        <circle cx={x} cy={y} r="9" fill="none" stroke="#BE1B2C" strokeOpacity="0.3" strokeWidth="1">
                          <animate attributeName="r" values="6;14;6" dur="2.5s" repeatCount="indefinite" />
                          <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
                        </circle>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-[10px] p-3 text-center">
                <p className="text-[22px] font-bold text-slate-800 tabular-nums leading-none">{number(onlineDrivers)}</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online</p>
              </div>
              <div className="bg-slate-50 rounded-[10px] p-3 text-center">
                <p className="text-[22px] font-bold text-slate-800 tabular-nums leading-none">{number(activeRides)}</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1"><Navigation size={10} /> On trip</p>
              </div>
              <div className="bg-slate-50 rounded-[10px] p-3 text-center">
                <p className={`text-[22px] font-bold tabular-nums leading-none ${stuckRides > 0 ? "text-red-600" : "text-slate-800"}`}>{number(stuckRides)}</p>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-1"><AlertTriangle size={10} /> Stuck</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 mt-3">
              {recentReservations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No active ride activity from backend.</p>
              ) : recentReservations.slice(0, 5).map((ride) => (
                <button key={ride.id} type="button" onClick={() => navigate(`/rides/${ride.id}`)}
                  className="flex items-center gap-3 px-3 py-2 rounded-[8px] hover:bg-slate-50 cursor-pointer transition-colors text-left w-full">
                  <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{ride.reference || ride.id}</span>
                  <RideStatusBadge status={String(ride.status || "").includes("stuck") ? "stuck" : ride.status} />
                  <span className="text-xs text-slate-600 flex-1 truncate">{ride.driverName || "Unassigned"} &rarr; {ride.passengerName || "Passenger"}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{relTime(ride.updatedAt)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-slate-200">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <AlertOctagon size={14} className="text-red-500" />
              <h2 className="text-sm font-bold text-slate-800">Critical Alerts</h2>
              {alerts.length > 0 && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">{alerts.length}</span>}
            </div>
            <button type="button" onClick={() => navigate("/rides/stuck")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              All alerts <ChevronRight size={13} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 px-5 text-center">
                <CheckCircle2 size={22} className="text-green-400" />
                <p className="text-sm font-medium text-slate-600">All clear</p>
                <p className="text-xs text-slate-400">No urgent backend queues right now.</p>
              </div>
            ) : alerts.map((alert) => (
              <button key={alert.id} type="button" onClick={() => navigate(alert.path)}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors text-left w-full">
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${alert.type === "danger" ? "bg-red-500" : alert.type === "warning" ? "bg-amber-500" : "bg-sky-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 leading-snug">{alert.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{alert.body}</p>
                </div>
                <ChevronRight size={13} className="text-slate-300 shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-[14px] border border-slate-200">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <Activity size={14} className="text-[#BE1B2C]" />
              <h2 className="text-sm font-bold text-slate-800">Ride Activity</h2>
            </div>
            <button type="button" onClick={() => navigate("/rides/all")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              All rides <ChevronRight size={13} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentReservations.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No recent ride activity.</p>
            ) : recentReservations.slice(0, 7).map((ride) => (
              <button key={ride.id} type="button" onClick={() => navigate(`/rides/${ride.id}`)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer text-left w-full">
                <span className="w-8 h-8 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-[11px] font-bold text-[#BE1B2C] shrink-0">
                  {(ride.driverName || "?").split(/\s+/).map((p) => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{ride.driverName || "Unassigned driver"}</p>
                  <p className="text-[11px] text-slate-400 truncate">{ride.passengerName || "Passenger"} &middot; {ride.reference || ride.id}</p>
                </div>
                <em className="text-[11px] text-slate-400 not-italic shrink-0">{relTime(ride.updatedAt)}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[14px] border border-slate-200">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-violet-500" />
              <h2 className="text-sm font-bold text-slate-800">Points Activity</h2>
            </div>
            <button type="button" onClick={() => navigate("/points/transactions")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              All transactions <ChevronRight size={13} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No recent point transactions.</p>
            ) : transactions.slice(0, 7).map((tx) => (
              <button key={tx.id || tx._id} type="button" onClick={() => navigate("/points/transactions")}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer text-left w-full">
                <TxIcon type={tx.type || tx.kind} />
                <span className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-[11px] font-bold text-violet-600 shrink-0">
                  {(tx.driverName || tx.driver?.fullName || "?").split(/\s+/).map((p) => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{tx.driverName || tx.driver?.fullName || tx.driverId || "Driver"}</p>
                  <p className="text-[11px] text-slate-400 truncate">{txTypeLabel(tx.type || tx.kind)} &middot; {tx.reference || tx.rideId || ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${Number(tx.amount || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {Number(tx.amount || 0) > 0 ? "+" : ""}{number(tx.amount)} pts
                  </p>
                  <p className="text-[11px] text-slate-400">{relTime(tx.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {topDrivers.length > 0 && (
        <div className="bg-white rounded-[14px] border border-slate-200">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <TrendingUp size={14} className="text-amber-500" />
              <h2 className="text-sm font-bold text-slate-800">Top Drivers This Month</h2>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {topDrivers.map((entry, index) => (
              <div key={entry.driver?.id || index} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${index === 0 ? "bg-amber-100 text-amber-700" : index === 1 ? "bg-slate-200 text-slate-600" : index === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-400"}`}>
                  {entry.position || index + 1}
                </span>
                <span className="w-8 h-8 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-[11px] font-bold text-[#BE1B2C] shrink-0">
                  {(entry.driver?.fullName || "?").split(/\s+/).map((p) => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{entry.driver?.fullName || "Unknown"}</p>
                  <p className="text-[11px] text-slate-400">{entry.driver?.vehicleType || ""} {entry.driver?.vehicleModel || ""}</p>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <p className="text-xs font-bold text-slate-800 tabular-nums">{Number(entry.ranking?.completedTrips || 0)}</p>
                    <p className="text-[10px] text-slate-400">trips</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-600 tabular-nums">{Number(entry.ranking?.weightedRating || 0).toFixed(1)}</p>
                    <p className="text-[10px] text-slate-400">rating</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-600 tabular-nums">{Number(entry.ranking?.rankingScore || 0).toFixed(0)}</p>
                    <p className="text-[10px] text-slate-400">score</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[14px] border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-500" /> System Health
          </h2>
          <button type="button" onClick={() => navigate("/system-health")}
            className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
            Full status <ChevronRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {healthServices.map((svc) => (
            <button key={svc.name} type="button" onClick={() => navigate("/system-health")}
              className={`flex flex-col items-start gap-1.5 px-3 py-2.5 rounded-[10px] border text-left transition-all hover:shadow-sm
                ${svc.status === "operational" ? "bg-slate-50 border-slate-200"
                  : svc.status === "degraded" ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-1.5 w-full justify-between">
                <span className={svc.status === "operational" ? "text-slate-400" : svc.status === "degraded" ? "text-amber-600" : "text-red-600"}>
                  {svc.icon}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${svc.status === "operational" ? "bg-green-500" : svc.status === "degraded" ? "bg-amber-500" : "bg-red-500"}`} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-700 leading-tight">{svc.short}</p>
                <p className={`text-[11px] tabular-nums mt-0.5 font-medium ${svc.latency > 300 ? "text-amber-600" : "text-slate-400"}`}>
                  {svc.latency ? `${svc.latency}ms` : statusLabel(svc.status)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
