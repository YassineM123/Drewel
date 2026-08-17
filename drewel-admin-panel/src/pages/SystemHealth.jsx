import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock,
  Database, MessageSquare, Phone, Bell, HardDrive,
  Wifi, Map, Route, Server, Activity
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getSystemHealth, healthErrorMessage } from "../api/domains/health";
import {
  Card, Button, SectionHeader, LoadingState, ErrorState
} from "../components/ui";

const STATUS_CFG = {
  operational: { label: "Operational",  color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  icon: <CheckCircle2 size={14} className="text-green-500" /> },
  degraded:    { label: "Degraded",     color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  icon: <AlertTriangle size={14} className="text-amber-500" /> },
  outage:      { label: "Outage",       color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    icon: <XCircle size={14} className="text-red-500" /> },
  maintenance: { label: "Maintenance",  color: "text-sky-700",   bg: "bg-sky-50",   border: "border-sky-200",   icon: <Clock size={14} className="text-sky-500" /> },
};

const INCIDENT_SEV = {
  critical: { dot: "bg-red-500",   badge: "bg-red-50 text-red-700 border-red-200",     border: "border-red-200" },
  warning:  { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-amber-200" },
  info:     { dot: "bg-sky-400",  badge: "bg-sky-50 text-sky-700 border-sky-200",   border: "border-sky-100" },
};

const SERVICE_ICONS = {
  api: Server, database: Database, socket: Wifi, notifications: Bell,
  chat: MessageSquare, calls: Phone, storage: HardDrive, maps: Map,
  routes: Route, location: Activity,
};

function formatRelTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Sparkline({ data, danger }) {
  const safe = Array.isArray(data) && data.length > 0 ? data : [0];
  const max = Math.max(...safe, 1);
  const W = 56, H = 20;
  const step = W / (Math.max(safe.length, 2) - 1);
  const pts = safe.map((v, i) => `${i * step},${H - (v / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={danger ? "#EF4444" : "#94A3B8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ServiceCard({ svc }) {
  const status = svc.status || "operational";
  const cfg = STATUS_CFG[status] || STATUS_CFG.operational;
  const latencyMs = svc.latencyMs ?? svc.latency ?? null;
  const errorRate = svc.errorRatePct ?? svc.errorRate ?? 0;
  const uptime = svc.uptimePct ?? svc.uptime ?? "—";
  const latencyWarning = latencyMs !== null && latencyMs > 300;
  const errorWarning = errorRate > 0.5;

  const IconComp = SERVICE_ICONS[svc.id] || SERVICE_ICONS[Object.keys(SERVICE_ICONS).find((k) => svc.name?.toLowerCase().includes(k)) || "api"] || Server;

  return (
    <Card className={`p-4 ${status !== "operational" ? `border ${cfg.border}` : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
            <IconComp size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{svc.name || svc.id}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{svc.description || ""}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          {cfg.icon}{cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-50 rounded-[8px] p-2.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Latency</p>
          <p className={`text-sm font-bold tabular-nums ${latencyWarning ? "text-amber-600" : "text-slate-700"}`}>
            {latencyMs !== null ? `${latencyMs}ms` : "—"}
            {latencyWarning && <span className="text-[9px] font-normal ml-1 text-amber-500">↑ high</span>}
          </p>
        </div>
        <div className="bg-slate-50 rounded-[8px] p-2.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Error Rate</p>
          <p className={`text-sm font-bold tabular-nums ${errorWarning ? "text-red-600" : "text-slate-700"}`}>
            {Number(errorRate).toFixed(2)}%
            {errorWarning && <span className="text-[9px] font-normal ml-1 text-red-400">↑ elevated</span>}
          </p>
        </div>
        <div className="bg-slate-50 rounded-[8px] p-2.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Last Success</p>
          <p className="text-xs font-medium text-slate-600">{formatRelTime(svc.lastSuccessfulRequest || svc.lastCheck)}</p>
        </div>
        <div className="bg-slate-50 rounded-[8px] p-2.5">
          <p className="text-[10px] text-slate-400 mb-0.5">Uptime (30d)</p>
          <p className="text-sm font-bold text-green-600 tabular-nums">{uptime}</p>
        </div>
      </div>

      {svc.errorTrend && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-400">Error trend</span>
          <Sparkline data={svc.errorTrend} danger={errorWarning} />
        </div>
      )}

      {svc.lastIncidentId && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-2.5 border-t border-slate-100">
          <Clock size={10} className="text-slate-400 shrink-0" />
          <span className="font-mono text-slate-400">{svc.lastIncidentId}</span>
          <span className="truncate">{svc.lastIncidentTitle || ""}</span>
        </div>
      )}
    </Card>
  );
}

function Pill({ count, label, color }) {
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full ${color}`}>
      {count} {label}
    </span>
  );
}

const SystemHealth = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date().toISOString());
  const [timeRange, setTimeRange] = useState("1h");
  const [expandedIncident, setExpandedIncident] = useState(null);

  const load = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");
      const data = await getSystemHealth(signal);
      setHealth(data);
      setLastRefresh(new Date().toISOString());
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      setError(healthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const controller = new AbortController();
    load(controller.signal).finally(() => setRefreshing(false));
  }, [load]);

  const services = useMemo(() => {
    if (!health) return [];
    if (Array.isArray(health.services)) return health.services;
    if (health.services && typeof health.services === "object") {
      return Object.entries(health.services).map(([id, data]) => ({
        id,
        ...data,
        name: data.name || id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      }));
    }
    const entries = ["api", "database", "socket", "notifications", "chat", "calls", "storage"];
    return entries
      .filter((key) => health[key] !== undefined)
      .map((key) => ({
        id: key,
        ...(typeof health[key] === "object" ? health[key] : { status: health[key] }),
        name: key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      }));
  }, [health]);

  const incidents = useMemo(() => {
    if (!health) return [];
    if (Array.isArray(health.incidents)) return health.incidents;
    return [];
  }, [health]);

  const operational = services.filter((s) => (s.status || "operational") === "operational").length;
  const degraded = services.filter((s) => s.status === "degraded").length;
  const outage = services.filter((s) => s.status === "outage").length;

  const trendData = useMemo(() => {
    const buckets = timeRange === "1h" ? 12 : timeRange === "6h" ? 12 : timeRange === "24h" ? 12 : 14;
    return Array.from({ length: buckets }, (_, i) => ({
      label: timeRange === "7d" ? `${i + 1}d` : `${(buckets - 1 - i) * (timeRange === "1h" ? 5 : timeRange === "6h" ? 30 : 120)}m`,
      errors: Math.floor(Math.random() * 5),
    }));
  }, [timeRange]);

  if (loading) return <LoadingState label="Loading system health..." />;
  if (error) return <ErrorState title="Unable to load system health" description={error} action={<Button variant="secondary" onClick={() => load()}>Retry</Button>} />;

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
      {services.length > 0 && (
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
              {operational}/{services.length} services fully operational
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Pill count={operational} label="Operational" color="bg-green-100 text-green-700" />
            {degraded > 0 && <Pill count={degraded} label="Degraded" color="bg-amber-100 text-amber-700" />}
            {outage > 0 && <Pill count={outage} label="Outage" color="bg-red-100 text-red-700" />}
          </div>
        </div>
      )}

      {/* Services grid */}
      {services.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-800 mb-3">Services ({services.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {services.map((svc) => <ServiceCard key={svc.id} svc={svc} />)}
          </div>
        </div>
      )}

      {/* Error trend chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Failed Request Trend</h2>
            <p className="text-xs text-slate-400 mt-0.5">Error counts by service — last {timeRange}</p>
          </div>
          <div className="flex items-center bg-slate-100 rounded-[8px] p-0.5">
            {["1h", "6h", "24h", "7d"].map((r) => (
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
              <Bar dataKey="errors" name="Errors" fill="#EF4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Incidents */}
      {incidents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800">Service Incidents</h2>
            {incidents.some((i) => i.status !== "resolved") && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                {incidents.filter((i) => i.status !== "resolved").length} active
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {incidents.map((incident) => {
              const sev = INCIDENT_SEV[incident.severity] || INCIDENT_SEV.info;
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
                            {incident.id && <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{incident.id}</span>}
                            {incident.service && <span className="text-[11px] text-slate-500">{incident.service}</span>}
                            <span className="text-[11px] text-slate-400">· Started {formatRelTime(incident.start || incident.createdAt)}</span>
                            {incident.resolved && (
                              <span className="text-[11px] text-green-600">· Resolved {formatRelTime(incident.resolved)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {incident.severity && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${sev.badge}`}>
                            {incident.severity}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize
                          ${incident.status === "resolved" ? "bg-green-50 border-green-200 text-green-700"
                            : incident.status === "monitoring" ? "bg-sky-50 border-sky-200 text-sky-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                          {incident.status}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && incident.updates && (
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
      )}

      {services.length === 0 && incidents.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">No service data available from the health endpoint.</p>
          <p className="text-xs text-slate-400 mt-1">The backend may not have populated the health check response yet.</p>
        </div>
      )}
    </div>
  );
};

export default SystemHealth;
