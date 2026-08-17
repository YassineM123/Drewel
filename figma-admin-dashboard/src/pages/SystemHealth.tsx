import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock,
  Database, MessageSquare, Phone, Bell, HardDrive,
  Wifi, Map, Route, Server, Activity
} from "lucide-react";
import { Card, Button, SectionHeader } from "../components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus = "operational" | "degraded" | "outage" | "maintenance";
type TimeRange = "1h" | "6h" | "24h" | "7d";

interface Service {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  latencyMs: number | null;
  errorRatePct: number;
  lastSuccessfulRequest: string;
  lastIncidentId: string | null;
  lastIncidentTitle: string | null;
  dataFreshnessMinutes: number | null;
  dataFreshnessThresholdMinutes: number | null;
  uptimePct: string;
  icon: React.ReactNode;
  errorTrend: number[];
}

interface Incident {
  id: string;
  serviceId: string;
  title: string;
  severity: "critical" | "warning" | "info";
  status: "resolved" | "monitoring" | "investigating";
  start: string;
  resolved?: string;
  updates: { text: string; at: string }[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const T = (offsetMinutes: number) =>
  new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString();

const SERVICES: Service[] = [
  {
    id: "main-api",
    name: "Main API",
    description: "Core REST API for all client apps",
    status: "operational",
    latencyMs: 67,
    errorRatePct: 0.04,
    lastSuccessfulRequest: T(0.3),
    lastIncidentId: "INC-0039",
    lastIncidentTitle: "Cold start delay — 3d ago",
    dataFreshnessMinutes: null,
    dataFreshnessThresholdMinutes: null,
    uptimePct: "99.95%",
    icon: <Server size={16} />,
    errorTrend: [0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 1],
  },
  {
    id: "database",
    name: "Database",
    description: "PostgreSQL write-primary cluster",
    status: "operational",
    latencyMs: 12,
    errorRatePct: 0.0,
    lastSuccessfulRequest: T(0.1),
    lastIncidentId: null,
    lastIncidentTitle: null,
    dataFreshnessMinutes: 0,
    dataFreshnessThresholdMinutes: 5,
    uptimePct: "100%",
    icon: <Database size={16} />,
    errorTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "socketio",
    name: "Socket.IO",
    description: "Real-time WebSocket dispatch cluster",
    status: "degraded",
    latencyMs: 310,
    errorRatePct: 2.4,
    lastSuccessfulRequest: T(1),
    lastIncidentId: "INC-0042",
    lastIncidentTitle: "ws-02 node disconnected — 14m ago",
    dataFreshnessMinutes: null,
    dataFreshnessThresholdMinutes: null,
    uptimePct: "99.21%",
    icon: <Wifi size={16} />,
    errorTrend: [0, 0, 0, 1, 0, 1, 2, 3, 8, 14, 22, 24],
  },
  {
    id: "driver-location",
    name: "Driver Location Stream",
    description: "Real-time GPS tracking pipeline",
    status: "degraded",
    latencyMs: 480,
    errorRatePct: 1.2,
    lastSuccessfulRequest: T(2),
    lastIncidentId: "INC-0041",
    lastIncidentTitle: "Elevated latency — 2h ago",
    dataFreshnessMinutes: 18,
    dataFreshnessThresholdMinutes: 10,
    uptimePct: "99.61%",
    icon: <Activity size={16} />,
    errorTrend: [1, 1, 2, 1, 2, 3, 3, 4, 5, 6, 8, 9],
  },
  {
    id: "google-maps",
    name: "Google Maps",
    description: "Maps rendering and geocoding",
    status: "operational",
    latencyMs: 145,
    errorRatePct: 0.1,
    lastSuccessfulRequest: T(0.5),
    lastIncidentId: null,
    lastIncidentTitle: null,
    dataFreshnessMinutes: null,
    dataFreshnessThresholdMinutes: null,
    uptimePct: "99.90%",
    icon: <Map size={16} />,
    errorTrend: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "google-routes",
    name: "Google Routes",
    description: "ETA calculation and route planning",
    status: "operational",
    latencyMs: 220,
    errorRatePct: 0.8,
    lastSuccessfulRequest: T(0.5),
    lastIncidentId: "INC-0043",
    lastIncidentTitle: "503 errors batch — 4h ago",
    dataFreshnessMinutes: null,
    dataFreshnessThresholdMinutes: null,
    uptimePct: "99.72%",
    icon: <Route size={16} />,
    errorTrend: [0, 0, 0, 0, 6, 4, 2, 0, 0, 0, 0, 0],
  },
  {
    id: "in-app-chat",
    name: "In-App Chat",
    description: "Driver–passenger messaging",
    status: "operational",
    latencyMs: 88,
    errorRatePct: 0.0,
    lastSuccessfulRequest: T(0.3),
    lastIncidentId: null,
    lastIncidentTitle: null,
    dataFreshnessMinutes: 0,
    dataFreshnessThresholdMinutes: 30,
    uptimePct: "99.98%",
    icon: <MessageSquare size={16} />,
    errorTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "secure-calls",
    name: "Secure Calls",
    description: "Masked phone call relay",
    status: "operational",
    latencyMs: 110,
    errorRatePct: 0.2,
    lastSuccessfulRequest: T(5),
    lastIncidentId: null,
    lastIncidentTitle: null,
    dataFreshnessMinutes: null,
    dataFreshnessThresholdMinutes: null,
    uptimePct: "99.88%",
    icon: <Phone size={16} />,
    errorTrend: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  },
  {
    id: "notifications",
    name: "Notifications",
    description: "Push, SMS, and email delivery",
    status: "operational",
    latencyMs: 220,
    errorRatePct: 0.3,
    lastSuccessfulRequest: T(0.5),
    lastIncidentId: "INC-0040",
    lastIncidentTitle: "Lagos delivery delay — 26h ago",
    dataFreshnessMinutes: null,
    dataFreshnessThresholdMinutes: null,
    uptimePct: "99.88%",
    icon: <Bell size={16} />,
    errorTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "file-storage",
    name: "File Storage",
    description: "Driver documents and media assets",
    status: "operational",
    latencyMs: 190,
    errorRatePct: 0.0,
    lastSuccessfulRequest: T(2),
    lastIncidentId: null,
    lastIncidentTitle: null,
    dataFreshnessMinutes: 2,
    dataFreshnessThresholdMinutes: 60,
    uptimePct: "99.99%",
    icon: <HardDrive size={16} />,
    errorTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

const INCIDENTS: Incident[] = [
  {
    id: "INC-0042",
    serviceId: "socketio",
    title: "Socket.IO cluster node ws-02 disconnected",
    severity: "critical",
    status: "investigating",
    start: T(14),
    updates: [
      { text: "ws-02 node lost heartbeat at 09:41. Active connections migrating to ws-01 and ws-03.", at: T(14) },
      { text: "63 of 63 connections migrated. Dispatch latency elevated ~180ms. Root cause investigation underway.", at: T(12) },
    ],
  },
  {
    id: "INC-0043",
    serviceId: "google-routes",
    title: "Google Routes API 503 errors — batch failure",
    severity: "warning",
    status: "monitoring",
    start: T(240),
    updates: [
      { text: "6 route calls failed with HTTP 503 between 09:12–09:41. Rides proceeded without ETA.", at: T(240) },
      { text: "Error rate returned to baseline at 09:45. Google confirmed transient us-central1 issue.", at: T(225) },
    ],
  },
  {
    id: "INC-0041",
    serviceId: "driver-location",
    title: "Driver Location API elevated latency",
    severity: "warning",
    status: "investigating",
    start: T(120),
    updates: [
      { text: "P95 latency at 480ms vs 120ms baseline. GPS updates delayed for 8 active drivers.", at: T(120) },
      { text: "Engineering team investigating. Possible TCP connection pool exhaustion on ws-shard-3.", at: T(105) },
    ],
  },
  {
    id: "INC-0040",
    serviceId: "notifications",
    title: "Push notification delivery delays — Lagos region",
    severity: "info",
    status: "resolved",
    start: T(1560),
    resolved: T(1320),
    updates: [
      { text: "Delayed push notifications for Lagos drivers, averaging 4–8 minute delay.", at: T(1560) },
      { text: "Root cause: SMS gateway provider maintenance window ran 2h overtime.", at: T(1440) },
      { text: "Delivery fully restored. No messages lost. 812 queued messages delivered.", at: T(1320) },
    ],
  },
  {
    id: "INC-0039",
    serviceId: "main-api",
    title: "Main API cold start delay during peak hour",
    severity: "warning",
    status: "resolved",
    start: T(4320),
    resolved: T(4260),
    updates: [
      { text: "Dispatch matching latency increased 8–12s during peak at 18:00.", at: T(4320) },
      { text: "Auto-scaling triggered. New instances spun up in 4 minutes.", at: T(4300) },
      { text: "Service fully restored. Post-mortem scheduled for next sprint.", at: T(4260) },
    ],
  },
];

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ServiceStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  operational: { label: "Operational",  color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  icon: <CheckCircle2 size={14} className="text-green-500" /> },
  degraded:    { label: "Degraded",     color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  icon: <AlertTriangle size={14} className="text-amber-500" /> },
  outage:      { label: "Outage",       color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    icon: <XCircle size={14} className="text-red-500" /> },
  maintenance: { label: "Maintenance",  color: "text-sky-700",   bg: "bg-sky-50",   border: "border-sky-200",   icon: <Clock size={14} className="text-sky-500" /> },
};

const INCIDENT_SEV: Record<Incident["severity"], { dot: string; badge: string; border: string }> = {
  critical: { dot: "bg-red-500",   badge: "bg-red-50 text-red-700 border-red-200",     border: "border-red-200" },
  warning:  { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-amber-200" },
  info:     { dot: "bg-sky-400",  badge: "bg-sky-50 text-sky-700 border-sky-200",   border: "border-sky-100" },
};

function formatRelTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Sparkline (inline SVG) ────────────────────────────────────────────────────

function Sparkline({ data, danger }: { data: number[]; danger: boolean }) {
  const max = Math.max(...data, 1);
  const W = 56, H = 20;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${H - (v / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={danger ? "#EF4444" : "#94A3B8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Error trend chart ──────────────────────────────────────────────────────────

function buildTrendData(range: TimeRange) {
  const buckets = range === "1h" ? 12 : range === "6h" ? 12 : range === "24h" ? 12 : 14;
  const labels = Array.from({ length: buckets }, (_, i) => {
    if (range === "7d") return `${i + 1}d`;
    const ago = (buckets - 1 - i);
    return range === "1h" ? `${ago * 5}m` : `${ago * (range === "6h" ? 30 : 120)}m`;
  });

  return labels.map((label, i) => ({
    label,
    socketio: SERVICES.find(s => s.id === "socketio")!.errorTrend[i] ?? 0,
    driverLocation: SERVICES.find(s => s.id === "driver-location")!.errorTrend[i] ?? 0,
    googleRoutes: SERVICES.find(s => s.id === "google-routes")!.errorTrend[i] ?? 0,
    other: Math.max(0, Math.floor(Math.random() * 2)),
  }));
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ svc }: { svc: Service }) {
  const cfg = STATUS_CFG[svc.status];
  const isStale = svc.dataFreshnessMinutes !== null &&
    svc.dataFreshnessThresholdMinutes !== null &&
    svc.dataFreshnessMinutes > svc.dataFreshnessThresholdMinutes;
  const latencyWarning = svc.latencyMs !== null && svc.latencyMs > 300;
  const errorWarning = svc.errorRatePct > 0.5;

  return (
    <Card className={`p-4 ${svc.status !== "operational" ? `border ${cfg.border}` : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
            {svc.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{svc.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{svc.description}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          {cfg.icon}{cfg.label}
        </span>
      </div>

      {/* Stale data warning */}
      {isStale && (
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-[7px] px-2.5 py-1.5 mb-3 text-[11px] text-amber-700 font-medium">
          <AlertTriangle size={11} />
          Data stale — last refresh {svc.dataFreshnessMinutes}m ago (threshold {svc.dataFreshnessThresholdMinutes}m)
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-50 rounded-[8px] p-2.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Latency</p>
          <p className={`text-sm font-bold tabular-nums ${latencyWarning ? "text-amber-600" : "text-slate-700"}`}>
            {svc.latencyMs !== null ? `${svc.latencyMs}ms` : "—"}
            {latencyWarning && <span className="text-[9px] font-normal ml-1 text-amber-500">↑ high</span>}
          </p>
        </div>
        <div className="bg-slate-50 rounded-[8px] p-2.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Error Rate</p>
          <p className={`text-sm font-bold tabular-nums ${errorWarning ? "text-red-600" : "text-slate-700"}`}>
            {svc.errorRatePct.toFixed(2)}%
            {errorWarning && <span className="text-[9px] font-normal ml-1 text-red-400">↑ elevated</span>}
          </p>
        </div>
        <div className="bg-slate-50 rounded-[8px] p-2.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Last Success</p>
          <p className="text-xs font-medium text-slate-600">{formatRelTime(svc.lastSuccessfulRequest)}</p>
        </div>
        <div className="bg-slate-50 rounded-[8px] p-2.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Uptime (30d)</p>
          <p className="text-sm font-bold text-green-600 tabular-nums">{svc.uptimePct}</p>
        </div>
      </div>

      {/* Error trend sparkline */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-400">Error trend (last 1h)</span>
        <Sparkline data={svc.errorTrend} danger={errorWarning} />
      </div>

      {/* Last incident */}
      {svc.lastIncidentId && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-2.5 border-t border-slate-100">
          <Clock size={10} className="text-slate-400 shrink-0" />
          <span className="font-mono text-slate-400">{svc.lastIncidentId}</span>
          <span className="truncate">{svc.lastIncidentTitle}</span>
        </div>
      )}

      {/* Data freshness */}
      {svc.dataFreshnessMinutes !== null && !isStale && (
        <div className="flex items-center gap-1.5 text-[11px] text-green-600 pt-2.5 border-t border-slate-100">
          <CheckCircle2 size={10} className="shrink-0" />
          Data refreshed {svc.dataFreshnessMinutes === 0 ? "just now" : `${svc.dataFreshnessMinutes}m ago`}
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemHealth() {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date().toISOString());
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [expandedIncident, setExpandedIncident] = useState<string | null>("INC-0042");

  const trendData = useMemo(() => buildTrendData(timeRange), [timeRange]);

  const operational = SERVICES.filter(s => s.status === "operational").length;
  const degraded = SERVICES.filter(s => s.status === "degraded").length;
  const outage = SERVICES.filter(s => s.status === "outage").length;
  const staleServices = SERVICES.filter(s =>
    s.dataFreshnessMinutes !== null &&
    s.dataFreshnessThresholdMinutes !== null &&
    s.dataFreshnessMinutes > s.dataFreshnessThresholdMinutes
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); setLastRefresh(new Date().toISOString()); }, 1400);
  };


  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="System Health"
        description="Real-time status, latency, error rates, and incident history for all platform services."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Updated {formatRelTime(lastRefresh)}</span>
            <Button variant="secondary" size="sm"
              icon={<RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />}
              onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-[14px] border
        ${outage > 0 ? "bg-red-50 border-red-200" : degraded > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
        {outage > 0 ? <XCircle size={20} className="text-red-500 shrink-0" />
          : degraded > 0 ? <AlertTriangle size={20} className="text-amber-500 shrink-0" />
          : <CheckCircle2 size={20} className="text-green-500 shrink-0" />}
        <div className="flex-1">
          <p className={`text-sm font-bold ${outage > 0 ? "text-red-800" : degraded > 0 ? "text-amber-800" : "text-green-800"}`}>
            {outage > 0 ? `${outage} service(s) down`
              : degraded > 0 ? `${degraded} service(s) degraded`
              : "All systems operational"}
          </p>
          <p className={`text-xs mt-0.5 ${outage > 0 ? "text-red-600" : degraded > 0 ? "text-amber-700" : "text-green-600"}`}>
            {operational}/{SERVICES.length} services fully operational
            {staleServices.length > 0 && ` · ${staleServices.length} stale data stream(s)`}
          </p>
        </div>
        {/* Service health pills */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Pill count={operational} label="Operational" color="bg-green-100 text-green-700" />
          {degraded > 0 && <Pill count={degraded} label="Degraded" color="bg-amber-100 text-amber-700" />}
          {outage > 0 && <Pill count={outage} label="Outage" color="bg-red-100 text-red-700" />}
        </div>
      </div>

      {/* Stale data warnings */}
      {staleServices.length > 0 && (
        <div className="flex flex-col gap-2">
          {staleServices.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 font-medium flex-1">
                <span className="font-bold">{s.name}</span> data is stale —
                last refresh {s.dataFreshnessMinutes}m ago (threshold: {s.dataFreshnessThresholdMinutes}m).
                Real-time accuracy may be affected.
              </p>
              <button onClick={handleRefresh} className="text-xs text-amber-700 font-semibold hover:text-amber-900 flex items-center gap-1">
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Services grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 mb-3">Services ({SERVICES.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SERVICES.map(svc => <ServiceCard key={svc.id} svc={svc} />)}
        </div>
      </div>

      {/* Failed request trend */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Failed Request Trend</h2>
            <p className="text-xs text-slate-400 mt-0.5">Error counts by service — last {timeRange}</p>
          </div>
          <div className="flex items-center bg-slate-100 rounded-[8px] p-0.5">
            {(["1h", "6h", "24h", "7d"] as TimeRange[]).map(r => (
              <button key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all
                  ${timeRange === r ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} barSize={8} barGap={2}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
              />
              <Bar dataKey="socketio" name="Socket.IO" stackId="a" fill="#EF4444" radius={[0,0,0,0]} />
              <Bar dataKey="driverLocation" name="Driver Location" stackId="a" fill="#F59E0B" radius={[0,0,0,0]} />
              <Bar dataKey="googleRoutes" name="Google Routes" stackId="a" fill="#8B5CF6" radius={[0,0,0,0]} />
              <Bar dataKey="other" name="Other" stackId="a" fill="#CBD5E1" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {[
            { color: "bg-red-500", label: "Socket.IO" },
            { color: "bg-amber-500", label: "Driver Location" },
            { color: "bg-violet-500", label: "Google Routes" },
            { color: "bg-slate-300", label: "Other" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
              {l.label}
            </div>
          ))}
        </div>
      </Card>

      {/* Incidents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800">Service Incidents</h2>
          <div className="flex items-center gap-2">
            {INCIDENTS.some(i => i.status !== "resolved") && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                {INCIDENTS.filter(i => i.status !== "resolved").length} active
              </span>
            )}
            <button
              onClick={() => navigate("/alerts")}
              className="text-xs text-[#BE1B2C] hover:text-[#A31725] font-semibold transition-colors">
              View all alerts →
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {INCIDENTS.map(incident => {
            const sev = INCIDENT_SEV[incident.severity];
            const svc = SERVICES.find(s => s.id === incident.serviceId);
            const isExpanded = expandedIncident === incident.id;

            return (
              <Card key={incident.id} className={`${incident.status !== "resolved" ? `border ${sev.border}` : ""}`}>
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${sev.dot} ${incident.status === "investigating" ? "live-pulse" : ""}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{incident.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{incident.id}</span>
                          {svc && <span className="text-[11px] text-slate-500">{svc.name}</span>}
                          <span className="text-[11px] text-slate-400">· Started {formatRelTime(incident.start)}</span>
                          {incident.resolved && (
                            <span className="text-[11px] text-green-600">· Resolved {formatRelTime(incident.resolved)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${sev.badge}`}>
                        {incident.severity}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize
                        ${incident.status === "resolved" ? "bg-green-50 border-green-200 text-green-700"
                          : incident.status === "monitoring" ? "bg-sky-50 border-sky-200 text-sky-700"
                          : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                        {incident.status}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded update timeline */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100">
                    <div className="relative pl-5 mt-3">
                      <div className="absolute left-1.5 top-0 bottom-0 w-px bg-slate-200" />
                      <div className="flex flex-col gap-3">
                        {incident.updates.map((u, i) => (
                          <div key={i} className="relative">
                            <span className="absolute -left-[14px] w-2 h-2 rounded-full bg-slate-300 mt-1" />
                            <p className={`text-xs leading-relaxed ${i === 0 ? "text-slate-700 font-medium" : "text-slate-500"}`}>{u.text}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{formatRelTime(u.at)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Pill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${color}`}>
      {count} {label}
    </span>
  );
}
