import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Activity
} from "lucide-react";
import { Card, Button, SectionHeader } from "../components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getSystemHealth } from "../api";

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

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ServiceStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  operational: { label: "Operational",  color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200",  icon: <CheckCircle2 size={14} className="text-green-500" /> },
  degraded:    { label: "Degraded",     color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200",  icon: <AlertTriangle size={14} className="text-amber-500" /> },
  outage:      { label: "Outage",       color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",    icon: <XCircle size={14} className="text-red-500" /> },
  maintenance: { label: "Maintenance",  color: "text-sky-700",   bg: "bg-sky-50",   border: "border-sky-200",   icon: <Clock size={14} className="text-sky-500" /> },
};

const INCIDENT_SEV: Record<string, { dot: string; badge: string; border: string }> = {
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
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [_fetching, setFetching] = useState(true);

  const fetchHealth = async () => {
    try {
      const data = await getSystemHealth();
      setServices(data.services ?? data.Service ?? []);
      setIncidents(data.incidents ?? data.Incident ?? []);
    } catch (err) {
      console.error("Failed to load system health", err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const trendData = useMemo(() => {
    const buckets = timeRange === "1h" ? 12 : timeRange === "6h" ? 12 : timeRange === "24h" ? 12 : 14;
    const labels = Array.from({ length: buckets }, (_, i) => {
      if (timeRange === "7d") return `${i + 1}d`;
      const ago = (buckets - 1 - i);
      return timeRange === "1h" ? `${ago * 5}m` : `${ago * (timeRange === "6h" ? 30 : 120)}m`;
    });

    return labels.map((label, i) => ({
      label,
      socketio: services.find(s => s.id === "socketio")?.errorTrend?.[i] ?? 0,
      driverLocation: services.find(s => s.id === "driver-location")?.errorTrend?.[i] ?? 0,
      googleRoutes: services.find(s => s.id === "google-routes")?.errorTrend?.[i] ?? 0,
      other: Math.max(0, Math.floor(Math.random() * 2)),
    }));
  }, [timeRange, services]);

  const operational = services.filter(s => s.status === "operational").length;
  const degraded = services.filter(s => s.status === "degraded").length;
  const outage = services.filter(s => s.status === "outage").length;
  const staleServices = services.filter(s =>
    s.dataFreshnessMinutes !== null &&
    s.dataFreshnessThresholdMinutes !== null &&
    s.dataFreshnessMinutes > s.dataFreshnessThresholdMinutes
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHealth();
    setLastRefresh(new Date().toISOString());
    setRefreshing(false);
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
            {operational}/{services.length} services fully operational
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
        <h2 className="text-sm font-bold text-slate-800 mb-3">Services ({services.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {services.map(svc => <ServiceCard key={svc.id} svc={svc} />)}
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
            {incidents.some(i => i.status !== "resolved") && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                {incidents.filter(i => i.status !== "resolved").length} active
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
          {incidents.map(incident => {
            const sev = INCIDENT_SEV[incident.severity];
            const svc = services.find(s => s.id === incident.serviceId);
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
