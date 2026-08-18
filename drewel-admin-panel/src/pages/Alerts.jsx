import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, RefreshCw, Search, Eye, UserCheck, Play, CheckCircle2,
  AlertTriangle, XCircle, ChevronRight, ExternalLink, MessageSquare,
} from "lucide-react";
import {
  getOperationalAlerts, acknowledgeAlert, investigateAlert,
  resolveOperationalAlert, operationalErrorMessage,
} from "../api/domains/operational";
import {
  Badge, Button, Card, Drawer, EmptyState, ErrorState, Input,
  LoadingState, Modal, Pagination, SectionHeader, Select, StatRow,
  TabBar, Toast,
} from "../components/ui";

const ALERT_TYPE_META = {
  stuck_ride: { label: "Stuck Ride", category: "Operations", icon: "\u23f1" },
  stale_gps: { label: "Stale GPS", category: "Operations", icon: "📍" },
  busy_driver_no_active_ride: { label: "Busy Driver", category: "Operations", icon: "🚗" },
  multiple_active_rides: { label: "Multi Active Ride", category: "Operations", icon: "\u26a0" },
  invalid_ride_lock: { label: "Invalid Ride Lock", category: "Operations", icon: "🔒" },
  negative_inconsistent_points: { label: "Negative Points", category: "Points", icon: "\u2796" },
  expired_point_reservation: { label: "Expired Reservation", category: "Points", icon: "\u23f0" },
  google_routes_failure: { label: "Routes Failure", category: "System", icon: "🗺" },
  socketio_interruption: { label: "Socket.IO Down", category: "System", icon: "\u26a1" },
  pickup_pin_failures: { label: "PIN Failures", category: "Security", icon: "🔑" },
  expiring_driver_documents: { label: "Expiring Docs", category: "Compliance", icon: "📄" },
};

const SEVERITY_CFG = {
  critical: { variant: "rejected", color: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  warning: { variant: "warning", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  info: { variant: "info", color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200" },
};

const STATUS_CFG = {
  open: { variant: "rejected", label: "Open" },
  acknowledged: { variant: "pending", label: "Acknowledged" },
  investigating: { variant: "info", label: "Investigating" },
  resolved: { variant: "approved", label: "Resolved" },
};

const OUTCOMES = [
  { value: "fixed", label: "Fixed" },
  { value: "wont_fix", label: "Won't Fix" },
  { value: "duplicate", label: "Duplicate" },
  { value: "false_positive", label: "False Positive" },
  { value: "other", label: "Other" },
];

function formatDate(v) {
  if (!v) return "\u2014";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}

function formatRelTime(iso) {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const Alerts = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolveModal, setResolveModal] = useState({ open: false, alertId: null });
  const [resolveNote, setResolveNote] = useState("");
  const [resolveOutcome, setResolveOutcome] = useState("fixed");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getOperationalAlerts({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        alertType: typeFilter || undefined,
        search: search.trim() || undefined,
      });
      setAlerts(result.alerts);
      setSummary(result.summary);
      setPagination((p) => ({ ...p, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setError(operationalErrorMessage(err, "Failed to load alerts."));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, severityFilter, typeFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleAction = useCallback(async (actionFn, id, successMsg) => {
    setActionLoading(true);
    try {
      await actionFn(id);
      setToast({ message: successMsg, type: "success" });
      setSelectedAlert(null);
      load();
    } catch (err) {
      setToast({ message: operationalErrorMessage(err, "Action failed."), type: "error" });
    } finally {
      setActionLoading(false);
    }
  }, [load]);

  const handleResolve = useCallback(async () => {
    setActionLoading(true);
    try {
      await resolveOperationalAlert(resolveModal.alertId, { note: resolveNote, outcome: resolveOutcome });
      setToast({ message: "Alert resolved.", type: "success" });
      setResolveModal({ open: false, alertId: null });
      setResolveNote("");
      setSelectedAlert(null);
      load();
    } catch (err) {
      setToast({ message: operationalErrorMessage(err, "Failed to resolve alert."), type: "error" });
    } finally {
      setActionLoading(false);
    }
  }, [resolveModal.alertId, resolveNote, resolveOutcome, load]);

  const openEntity = useCallback((alert) => {
    const e = alert.entity;
    if (!e?.entityType || !e?.entityId) return;
    if (e.entityType === "ride") navigate(`/reservations/${e.entityId}`);
    else if (e.entityType === "driver") navigate(`/driver-detail/${e.entityId}`);
    else if (e.entityType === "user") navigate(`/users/${e.entityId}`);
  }, [navigate]);

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SectionHeader
        title="Operational Alerts"
        description="Auto-detected operational anomalies requiring review. Investigate, assign, acknowledge, and resolve."
        actions={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {summary && Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["open", "acknowledged", "investigating", "resolved"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`p-3 rounded-[10px] border text-left transition-all ${statusFilter === s ? "ring-2 ring-[#BE1B2C]/30 border-[#BE1B2C]" : "border-slate-200 hover:border-slate-300"}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{STATUS_CFG[s]?.label}</span>
              <p className="text-xl font-bold tabular-nums mt-1 text-slate-800">{summary[s] || 0}</p>
            </button>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alerts..." leftIcon={<Search size={14} />} />
          </div>
          <Select value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All Statuses" }, { value: "open", label: "Open" }, { value: "acknowledged", label: "Acknowledged" }, { value: "investigating", label: "Investigating" }, { value: "resolved", label: "Resolved" }]} />
          <Select value={severityFilter} onChange={setSeverityFilter} options={[{ value: "", label: "All Severities" }, { value: "critical", label: "Critical" }, { value: "warning", label: "Warning" }, { value: "info", label: "Info" }]} />
          <Select value={typeFilter} onChange={setTypeFilter} options={[{ value: "", label: "All Types" }, ...Object.entries(ALERT_TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))]} />
        </div>

        {loading ? (
          <LoadingState label="Loading alerts..." />
        ) : error ? (
          <ErrorState title="Unable to load alerts" description={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} />
        ) : alerts.length === 0 ? (
          <EmptyState title="No alerts found" description={statusFilter || severityFilter || typeFilter || search ? "Try adjusting your filters." : "No operational alerts have been detected."} />
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => {
              const sev = SEVERITY_CFG[alert.severity] || SEVERITY_CFG.info;
              const typeMeta = ALERT_TYPE_META[alert.alertType] || { label: alert.alertType, icon: "\u2699" };
              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className="px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3"
                >
                  <span className={`text-lg shrink-0 mt-0.5`}>{typeMeta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 truncate">{alert.title}</span>
                      <Badge variant={STATUS_CFG[alert.status]?.variant || "info"} label={STATUS_CFG[alert.status]?.label || alert.status} />
                      <Badge variant={sev.variant} label={alert.severity} />
                    </div>
                    {alert.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{alert.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                      <span>{typeMeta.category}</span>
                      {alert.entity?.label && <span>Entity: {alert.entity.label}</span>}
                      {alert.assignedAdmin && <span>Assigned: {alert.assignedAdmin.name}</span>}
                      <span>{formatRelTime(alert.detectedAt)}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0 mt-2" />
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <Pagination page={pagination.page} total={pagination.total} perPage={pagination.limit} onChange={(p) => setPagination((prev) => ({ ...prev, page: p }))} />
        )}
      </Card>

      {/* Detail Drawer */}
      <Drawer open={Boolean(selectedAlert)} onClose={() => setSelectedAlert(null)} title="Alert Details" width="w-[520px]">
        {selectedAlert && (
          <div className="p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={STATUS_CFG[selectedAlert.status]?.variant || "info"} label={STATUS_CFG[selectedAlert.status]?.label} dot />
                <Badge variant={SEVERITY_CFG[selectedAlert.severity]?.variant || "info"} label={selectedAlert.severity} />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mt-2">{selectedAlert.title}</h3>
              {selectedAlert.description && <p className="text-sm text-slate-500 mt-1">{selectedAlert.description}</p>}
            </div>

            <div className="space-y-0">
              <StatRow label="Type" value={ALERT_TYPE_META[selectedAlert.alertType]?.label || selectedAlert.alertType} />
              <StatRow label="Detected" value={formatDate(selectedAlert.detectedAt)} />
              {selectedAlert.entity && (
                <StatRow
                  label="Entity"
                  value={
                    selectedAlert.entity.entityId ? (
                      <button onClick={() => openEntity(selectedAlert)} className="text-[#BE1B2C] hover:underline flex items-center gap-1">
                        {selectedAlert.entity.label || String(selectedAlert.entity.entityId).slice(0, 12)}
                        <ExternalLink size={10} />
                      </button>
                    ) : selectedAlert.entity.label || "\u2014"
                  }
                />
              )}
              {selectedAlert.assignedAdmin && (
                <StatRow label="Assigned To" value={`${selectedAlert.assignedAdmin.name} (${formatDate(selectedAlert.assignedAdmin.assignedAt)})`} />
              )}
              {selectedAlert.acknowledgement && (
                <StatRow label="Acknowledged By" value={`${selectedAlert.acknowledgement.name} (${formatDate(selectedAlert.acknowledgement.acknowledgedAt)})`} />
              )}
              {selectedAlert.resolution?.resolvedAt && (
                <>
                  <StatRow label="Resolved By" value={selectedAlert.resolution.name} />
                  <StatRow label="Resolution" value={selectedAlert.resolution.outcome} />
                  {selectedAlert.resolution.note && <StatRow label="Resolution Note" value={selectedAlert.resolution.note} />}
                  <StatRow label="Resolved At" value={formatDate(selectedAlert.resolution.resolvedAt)} />
                </>
              )}
            </div>

            {selectedAlert.status !== "resolved" && (
              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                {selectedAlert.status === "open" && (
                  <Button size="sm" variant="secondary" icon={<UserCheck size={13} />} loading={actionLoading} onClick={() => handleAction(acknowledgeAlert, selectedAlert.id, "Alert acknowledged.")}>
                    Acknowledge
                  </Button>
                )}
                {["open", "acknowledged"].includes(selectedAlert.status) && (
                  <Button size="sm" variant="secondary" icon={<Play size={13} />} loading={actionLoading} onClick={() => handleAction(investigateAlert, selectedAlert.id, "Investigation started.")}>
                    Investigate
                  </Button>
                )}
                <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setResolveModal({ open: true, alertId: selectedAlert.id })}>
                  Resolve
                </Button>
                {selectedAlert.entity?.entityId && (
                  <Button size="sm" variant="ghost" icon={<ExternalLink size={13} />} onClick={() => openEntity(selectedAlert)}>
                    Open Entity
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Resolve Modal */}
      <Modal open={resolveModal.open} onClose={() => setResolveModal({ open: false, alertId: null })} title="Resolve Alert">
        <div className="space-y-4">
          <Select value={resolveOutcome} onChange={setResolveOutcome} options={OUTCOMES} label="Outcome" />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Note (optional)</label>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full bg-white border border-slate-200 rounded-[10px] px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 focus:border-[#BE1B2C]/40 resize-none"
              placeholder="Resolution details..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setResolveModal({ open: false, alertId: null })}>Cancel</Button>
            <Button onClick={handleResolve} loading={actionLoading}>Resolve Alert</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Alerts;
