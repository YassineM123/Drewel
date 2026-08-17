import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Filter,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAllDashboard } from "../utils/authUtils";
import { getPointTransactions } from "../utils/pointsAdminApi";
import { useSocket } from "../context/SocketContext";
import { presenceVersion, shouldApplyPresence } from "../utils/driverPresence";
import "../assets/css/admin-dashboard.css";

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
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const relTime = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "-";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const healthState = (value, fallback = "unknown") => {
  if (!value) return fallback;
  if (["operational", "configured"].includes(value)) return "operational";
  if (value === "not_configured" || value === "degraded") return "degraded";
  return "outage";
};

function Card({ children, className = "", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`fig-card ${onClick ? "fig-card-clickable" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

function Button({ children, icon, onClick, loading, className = "" }) {
  return (
    <button type="button" className={`fig-button ${className}`} onClick={onClick} disabled={loading}>
      {loading ? <RefreshCw size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

function SelectControl({ value, onChange, options }) {
  return (
    <select className="fig-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function KpiCard({ label, value, tooltip, urgent, onClick, sparkline = [] }) {
  const max = Math.max(...sparkline, 1);
  const min = Math.min(...sparkline, 0);
  const range = Math.max(1, max - min);

  return (
    <Card className={`fig-kpi ${urgent ? "urgent" : ""}`} onClick={onClick}>
      <div className="fig-kpi-top">
        <span>{label}</span>
        {tooltip && <small title={tooltip}>i</small>}
      </div>
      <div className="fig-kpi-bottom">
        <strong>{value}</strong>
        {sparkline.length > 1 && (
          <svg viewBox="0 0 64 32" aria-hidden="true">
            <polyline
              points={sparkline
                .map((point, index) => {
                  const x = (index / (sparkline.length - 1)) * 64;
                  const y = 28 - ((point - min) / range) * 22;
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke={urgent ? "#DC2626" : "#BE1B2C"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </Card>
  );
}

export function RideStatusBadge({ status }) {
  const map = {
    requested: ["Requested", "slate"],
    contacting: ["Contacting", "amber"],
    offer_pending: ["Offer Pending", "amber"],
    accepted: ["Accepted", "sky"],
    confirmed: ["Confirmed", "sky"],
    active: ["Active", "green"],
    ride_started: ["In Progress", "green"],
    completed: ["Completed", "green"],
    cancelled: ["Cancelled", "slate"],
    cancelled_user: ["Cancelled by User", "slate"],
    cancelled_driver: ["Cancelled by Driver", "amber"],
    cancelled_admin: ["Cancelled by Admin", "red"],
    disputed: ["Disputed", "red"],
    stuck: ["Stuck", "red"],
  };
  const [label, tone] = map[status] || [statusLabel(status), "slate"];
  return <span className={`fig-status ${tone}`}>{label}</span>;
}

function Avatar({ name }) {
  const initials = String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
  return <span className="fig-avatar">{initials}</span>;
}

const dashboardError = (error) =>
  error?.response?.data?.message || error?.message || "Unable to load dashboard data.";

export default function Dashboard() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [period, setPeriod] = useState("Today");
  const [cityFilter, setCityFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [dataState, setDataState] = useState("loading");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [transactions, setTransactions] = useState([]);
  const presenceVersions = useRef(new Map());
  const refreshTimer = useRef(null);

  const loadDashboard = useCallback(async ({ background = false } = {}) => {
    if (!background) setDataState("loading");
    setError("");
    try {
      const [dashboardResponse, transactionsResponse] = await Promise.allSettled([
        getAllDashboard(),
        getPointTransactions({ limit: 7, page: 1 }),
      ]);

      if (dashboardResponse.status === "rejected") throw dashboardResponse.reason;
      const nextDashboard = {
        ...emptyDashboard,
        ...(dashboardResponse.value?.dashBoardData || {}),
      };

      setDashboard(nextDashboard);
      setTransactions(
        transactionsResponse.status === "fulfilled"
          ? (transactionsResponse.value?.transactions ||
              transactionsResponse.value?.data?.transactions ||
              transactionsResponse.value?.items ||
              [])
          : [],
      );
      setLastUpdated(new Date());
      setDataState("live");
    } catch (loadError) {
      setError(dashboardError(loadError));
      setDataState("error");
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const pollTimer = window.setInterval(() => loadDashboard({ background: true }), 30000);
    return () => window.clearInterval(pollTimer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!socket || !isConnected) return undefined;
    const onPresence = (update) => {
      const driverId = String(update?.driverId || "");
      if (!driverId) return;
      const currentVersion = presenceVersions.current.get(driverId);
      if (!shouldApplyPresence(currentVersion, update)) return;
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

  const recentReservations = dashboard.recentReservations || [];
  const activeRides = Number(dashboard.activeReservations || 0);
  const stuckRides = Number(dashboard.stuckRides || 0);
  const disputes = Number(dashboard.openDisputes || 0);
  const lowBalanceDrivers = Number(dashboard.lowBalanceDrivers || 0);
  const supportReports = Number(dashboard.openSupportReports || 0);
  const restrictedAccounts = Number(dashboard.restrictedDrivers || 0) + Number(dashboard.restrictedUsers || 0);
  const secondsSince = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : null;
  const freshnessLabel =
    dataState === "loading" ? "Refreshing..." :
    secondsSince == null ? "not loaded" :
    secondsSince < 60 ? "just now" : `${Math.floor(secondsSince / 60)}m ago`;

  const rideTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      return {
        key: day.toISOString().slice(0, 10),
        date: day.toLocaleDateString("en-US", { weekday: "short" }),
        completed: 0,
        cancelled: 0,
        disputed: 0,
      };
    });
    const byKey = new Map(days.map((day) => [day.key, day]));
    recentReservations.forEach((ride) => {
      const key = new Date(ride.updatedAt || ride.createdAt || Date.now()).toISOString().slice(0, 10);
      const bucket = byKey.get(key);
      if (!bucket) return;
      const status = String(ride.status || "");
      if (status.includes("cancel")) bucket.cancelled += 1;
      else if (status.includes("disput")) bucket.disputed += 1;
      else if (status.includes("complete")) bucket.completed += 1;
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

  const alerts = [
    stuckRides > 0 && {
      title: `${stuckRides} stuck reservation${stuckRides > 1 ? "s" : ""}`,
      body: "A ride has stayed in the same state longer than expected.",
      path: "/reservations/stuck",
      severity: "critical",
    },
    disputes > 0 && {
      title: `${disputes} open dispute${disputes > 1 ? "s" : ""}`,
      body: "Operations review is required.",
      path: "/reservations/disputes",
      severity: "warning",
    },
    restrictedAccounts > 0 && {
      title: `${restrictedAccounts} restricted account${restrictedAccounts > 1 ? "s" : ""}`,
      body: "Review account restrictions and recent actions.",
      path: "/drivers",
      severity: "warning",
    },
    supportReports > 0 && {
      title: `${supportReports} profile support report${supportReports > 1 ? "s" : ""}`,
      body: "Passenger or driver profile reports need support review.",
      path: "/users",
      severity: "warning",
    },
    Number(dashboard.pendingApproval1 || 0) + Number(dashboard.pendingApproval2 || 0) > 0 && {
      title: "Verification queue pending",
      body: `${number(Number(dashboard.pendingApproval1 || 0) + Number(dashboard.pendingApproval2 || 0))} request(s) need review.`,
      path: "/requests/pending",
      severity: "info",
    },
  ].filter(Boolean);

  const healthServices = [
    { name: "Admin API", status: healthState(dashboard.health?.api, dataState === "error" ? "outage" : "operational"), latency: dashboard.health?.latencyMs, icon: <Zap size={13} /> },
    { name: "Database", status: healthState(dashboard.health?.database), latency: null, icon: <ShieldCheck size={13} /> },
    { name: "Socket.IO", status: isConnected ? "operational" : healthState(dashboard.health?.socketIo), latency: null, icon: <Activity size={13} /> },
    { name: "Notifications", status: healthState(dashboard.health?.notifications), latency: null, icon: <AlertTriangle size={13} /> },
    { name: "Storage", status: healthState(dashboard.health?.storage), latency: null, icon: <ShieldCheck size={13} /> },
  ];

  const hasFilters = cityFilter !== "all" || vehicleFilter !== "all";

  return (
    <div className="fig-dashboard">
      <div className="fig-page-head">
        <div>
          <h1>Operations Overview</h1>
          <p>Real-time platform health and ride operations.</p>
        </div>
        <div className={`fig-freshness ${dataState}`}>
          {dataState === "loading" ? <RefreshCw size={11} className="animate-spin" /> :
            dataState === "error" ? <WifiOff size={11} /> :
            <span className="fig-live-dot" />}
          <span>{freshnessLabel}</span>
        </div>
      </div>

      <div className="fig-controls">
        <div className="fig-segment">
          {["Today", "7 days", "30 days", "Custom"].map((item) => (
            <button key={item} type="button" className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>
              {item}
            </button>
          ))}
        </div>
        <SelectControl value={cityFilter} onChange={setCityFilter} options={[
          { value: "all", label: "All Cities" },
          { value: "production", label: "Production" },
        ]} />
        <SelectControl value={vehicleFilter} onChange={setVehicleFilter} options={[
          { value: "all", label: "All Vehicles" },
          { value: "large_pickup", label: "Large Pickup" },
          { value: "small_pickup", label: "Small Pickup" },
        ]} />
        {hasFilters && (
          <button type="button" className="fig-clear" onClick={() => { setCityFilter("all"); setVehicleFilter("all"); }}>
            <Filter size={11} /> Clear filters
          </button>
        )}
        <div className="fig-control-spacer" />
        <Button icon={<RefreshCw size={14} />} onClick={() => loadDashboard()} loading={dataState === "loading"}>Refresh</Button>
        <Button icon={<Download size={14} />}>Export</Button>
      </div>

      {error && (
        <div className="fig-alert danger" role="alert">
          <AlertTriangle size={16} />
          <div>
            <strong>Failed to refresh dashboard data</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => loadDashboard()}>Retry</button>
        </div>
      )}

      {alerts.slice(0, 2).map((alert) => (
        <button key={alert.title} type="button" className={`fig-alert ${alert.severity}`} onClick={() => navigate(alert.path)}>
          <AlertTriangle size={16} />
          <div>
            <strong>{alert.title}</strong>
            <span>{alert.body}</span>
          </div>
          <ChevronRight size={14} />
        </button>
      ))}

      <div className="fig-kpi-grid">
        <KpiCard label="Active Rides" value={number(activeRides)} sparkline={[0, 1, 0, 2, 1, 2, activeRides]} tooltip="Rides currently in progress" onClick={() => navigate("/reservations/live")} />
        <KpiCard label="Online Drivers" value={number(dashboard.onlineDrivers)} sparkline={[0, 1, 1, 2, 2, 1, dashboard.onlineDrivers]} tooltip="Drivers currently online" onClick={() => navigate("/onlineDrivers")} />
        <KpiCard label="Discoverable" value={number(dashboard.discoverableDrivers)} tooltip="Eligible for passenger discovery" onClick={() => navigate("/driver-map")} />
        <KpiCard label="Completed Today" value={number(dashboard.completedToday)} sparkline={rideTrend.map((item) => item.completed)} onClick={() => navigate("/reservations/completed")} />
        <KpiCard label="Cancelled Today" value={number(dashboard.cancelledToday)} sparkline={rideTrend.map((item) => item.cancelled)} onClick={() => navigate("/reservations/cancelled")} />
        <KpiCard label="Open Disputes" value={number(disputes)} urgent={disputes > 0} sparkline={rideTrend.map((item) => item.disputed)} onClick={() => navigate("/reservations/disputes")} />
        <KpiCard label="Profile Reports" value={number(supportReports)} urgent={supportReports > 0} tooltip="Open support reports created from profile screens" onClick={() => navigate("/users")} />
        <KpiCard label="Low Bal Drivers" value={number(lowBalanceDrivers)} urgent={lowBalanceDrivers > 0} tooltip={`Below ${dashboard.lowBalanceThreshold} points`} onClick={() => navigate("/driver-points/wallets")} />
        <KpiCard label="Stuck Rides" value={number(stuckRides)} urgent={stuckRides > 0} onClick={() => navigate("/reservations/stuck")} />
      </div>

      <div className="fig-chart-grid">
        <Card className="fig-chart-wide">
          <div className="fig-panel-head">
            <div>
              <h2><TrendingUp size={14} /> Ride Volume Trend</h2>
              <p>Last 7 days from live reservation counters.</p>
            </div>
            <div className="fig-legend">
              <span><i style={{ background: "#BE1B2C" }} />Completed</span>
              <span><i style={{ background: "#94A3B8" }} />Cancelled</span>
              <span><i style={{ background: "#DC2626" }} />Disputed</span>
            </div>
          </div>
          <div className="fig-chart">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={rideTrend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#BE1B2C" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#BE1B2C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="completed" stroke="#BE1B2C" fill="url(#completedGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="cancelled" stroke="#94A3B8" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="disputed" stroke="#DC2626" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <div className="fig-panel-head">
            <div>
              <h2>Ride Status Distribution</h2>
              <p>Current operations breakdown.</p>
            </div>
          </div>
          <div className="fig-pie">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3}>
                  {statusDist.map((entry) => <Cell key={entry.name} fill={entry.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="fig-status-list">
            {statusDist.map((status) => (
              <div key={status.name}>
                <span><i style={{ background: status.color }} />{status.name}</span>
                <strong>{number(status.value)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="fig-main-grid">
        <Card className="fig-chart-wide">
          <div className="fig-panel-title">
            <div><span className="fig-live-dot" /><h2>Live Operations</h2><b>{number(activeRides)}</b></div>
            <button type="button" onClick={() => navigate("/reservations/live")}>Open Live Operations <ChevronRight size={13} /></button>
          </div>
          <div className="fig-live-map">
            <svg viewBox="0 0 460 220" aria-hidden="true">
              <rect width="460" height="220" fill="#F8FAFC" rx="10" />
              {[[48,64,130,44],[130,44,220,58],[220,58,310,42],[310,42,394,60],[60,120,148,108],[148,108,238,120],[238,120,320,110],[320,110,400,122],[72,176,160,164],[160,164,250,178],[250,178,334,168],[334,168,410,178]].map(([x1,y1,x2,y2], index) => (
                <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E2E8F0" strokeWidth="1.5" />
              ))}
              {recentReservations.slice(0, 5).map((ride, index) => {
                const points = [[90,54],[180,112],[280,166],[350,82],[410,178]];
                const [x, y] = points[index % points.length];
                const stuck = String(ride.status || "").includes("stuck");
                return (
                  <g key={ride.id || index}>
                    <circle cx={x} cy={y} r="7" fill="#FEE2E2" />
                    <circle cx={x} cy={y} r="4.5" fill={stuck ? "#EF4444" : "#BE1B2C"} />
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="fig-trip-strip">
            <div><strong>{number(dashboard.onlineDrivers)}</strong><span>Online</span></div>
            <div><strong>{number(activeRides)}</strong><span>On trip</span></div>
            <div className={stuckRides > 0 ? "risk" : ""}><strong>{number(stuckRides)}</strong><span>Stuck</span></div>
          </div>
          <div className="fig-activity-list">
            {recentReservations.length === 0 ? (
              <p>No active ride activity from backend.</p>
            ) : recentReservations.slice(0, 5).map((ride) => (
              <button key={ride.id} type="button" onClick={() => navigate(`/reservations/${ride.id}`)}>
                <span className="mono">{ride.reference || ride.id}</span>
                <RideStatusBadge status={ride.status} />
                <span>{ride.driverName || "Unassigned"} {"->"} {ride.passengerName || "Passenger"}</span>
                <small>{relTime(ride.updatedAt)}</small>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="fig-panel-title">
            <div><AlertOctagon size={14} /><h2>Critical Alerts</h2>{alerts.length > 0 && <b>{alerts.length}</b>}</div>
            <button type="button" onClick={() => navigate("/reservations/stuck")}>All alerts <ChevronRight size={13} /></button>
          </div>
          <div className="fig-alert-list">
            {alerts.length === 0 ? (
              <div className="fig-all-clear">
                <CheckCircle2 size={22} />
                <strong>All clear</strong>
                <span>No urgent backend queues right now.</span>
              </div>
            ) : alerts.map((alert) => (
              <button key={alert.title} type="button" onClick={() => navigate(alert.path)}>
                <i className={alert.severity} />
                <span><strong>{alert.title}</strong><small>{alert.body}</small></span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="fig-main-grid two">
        <Card>
          <div className="fig-panel-title">
            <div><Activity size={14} /><h2>Ride Activity</h2></div>
            <button type="button" onClick={() => navigate("/reservations/all")}>All rides <ChevronRight size={13} /></button>
          </div>
          <div className="fig-feed">
            {recentReservations.length === 0 ? <p>No recent ride activity.</p> : recentReservations.slice(0, 7).map((ride) => (
              <button key={ride.id} type="button" onClick={() => navigate(`/reservations/${ride.id}`)}>
                <Avatar name={ride.driverName || ride.passengerName} />
                <span>
                  <strong>{ride.driverName || "Unassigned driver"}</strong>
                  <small>{ride.passengerName || "Passenger"} &middot; {ride.reference || ride.id}</small>
                </span>
                <em>{relTime(ride.updatedAt)}</em>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="fig-panel-title">
            <div><MapPin size={14} /><h2>Points Activity</h2></div>
            <button type="button" onClick={() => navigate("/driver-points/transactions")}>All transactions <ChevronRight size={13} /></button>
          </div>
          <div className="fig-feed">
            {transactions.length === 0 ? <p>No recent point transactions from backend.</p> : transactions.slice(0, 7).map((tx) => (
              <button key={tx.id || tx._id} type="button" onClick={() => navigate("/driver-points/transactions")}>
                <Avatar name={tx.driverName || tx.driver?.fullName || tx.driverId} />
                <span>
                  <strong>{tx.driverName || tx.driver?.fullName || tx.driverId || "Driver"}</strong>
                  <small>{statusLabel(tx.type || tx.kind)} &middot; {tx.reference || tx.rideId || ""}</small>
                </span>
                <em className={Number(tx.amount || 0) >= 0 ? "credit" : "debit"}>{Number(tx.amount || 0) > 0 ? "+" : ""}{number(tx.amount)} pts</em>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="fig-panel-title">
          <div><CheckCircle2 size={14} /><h2>System Health</h2></div>
        </div>
        <div className="fig-health-strip">
          {healthServices.map((service) => (
            <div key={service.name} className={service.status}>
              <span>{service.icon}<i /></span>
              <strong>{service.name}</strong>
              <small>{service.latency ? `${service.latency}ms` : statusLabel(service.status)}</small>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
