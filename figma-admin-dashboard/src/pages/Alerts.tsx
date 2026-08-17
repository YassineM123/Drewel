import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Search, UserPlus, CheckCircle2, XCircle,
  ExternalLink, ChevronDown, RefreshCw, X
} from "lucide-react";
import {
  Card, Button, SectionHeader, Drawer, StatRow,
  Modal, Toast, EmptyState, Select
} from "../components/ui";
import {
  mockAlertsList, ALERT_TYPE_META,
  type Alert, type AlertStatus, type AlertSeverity, type AlertType
} from "../data/mockAlerts";

// ─── Configuration ────────────────────────────────────────────────────────────

const SEVERITY_CFG: Record<AlertSeverity, { dot: string; badge: string; row: string }> = {
  critical: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border border-red-200",
    row: "bg-red-50/30 border-l-2 border-l-red-400",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    row: "border-l-2 border-l-amber-400",
  },
};

const STATUS_CFG: Record<AlertStatus, { label: string; cls: string }> = {
  open:         { label: "Open",         cls: "bg-slate-100 text-slate-600 border-slate-200" },
  acknowledged: { label: "Acknowledged", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  resolved:     { label: "Resolved",     cls: "bg-green-50 text-green-700 border-green-200" },
};

const ADMINS = ["S. Chen", "R. Nakamura", "J. Kowalski", "T. Okonkwo"];

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SeverityDot({ s, pulse }: { s: AlertSeverity; pulse?: boolean }) {
  return (
    <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_CFG[s].dot} ${pulse ? "live-pulse" : ""}`} />
  );
}

function SeverityBadge({ s }: { s: AlertSeverity }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${SEVERITY_CFG[s].badge}`}>
      {s}
    </span>
  );
}

function StatusBadge({ s }: { s: AlertStatus }) {
  const cfg = STATUS_CFG[s];
  return (
    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${cfg.cls}`}>{cfg.label}</span>
  );
}

function TypeBadge({ t }: { t: AlertType }) {
  const meta = ALERT_TYPE_META[t];
  const catCls: Record<string, string> = {
    Operations: "bg-slate-100 text-slate-600",
    Points:     "bg-amber-50 text-amber-700",
    System:     "bg-purple-50 text-purple-700",
    Security:   "bg-red-50 text-red-700",
    Compliance: "bg-sky-50 text-sky-700",
  };
  return (
    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono ${catCls[meta.category] ?? "bg-slate-100 text-slate-600"}`}>
      {meta.label}
    </span>
  );
}

// ─── Assign modal ─────────────────────────────────────────────────────────────

function AssignModal({ alert, onConfirm, onClose }: {
  alert: Alert;
  onConfirm: (admin: string) => void;
  onClose: () => void;
}) {
  const [admin, setAdmin] = useState(alert.assignedAdmin ?? ADMINS[0]);
  return (
    <Modal open onClose={onClose} title="Assign Alert">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">Assign <strong>{alert.id}</strong> to an admin for investigation.</p>
        <Select
          value={admin} onChange={setAdmin} label="Assign to"
          options={ADMINS.map(a => ({ value: a, label: a }))}
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(admin)}>Assign</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Resolve modal ────────────────────────────────────────────────────────────

function ResolveModal({ alert, onConfirm, onClose, loading }: {
  alert: Alert;
  onConfirm: (note: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <Modal open onClose={onClose} title="Resolve Alert">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">Describe how <strong>{alert.id}</strong> was resolved.</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
          placeholder="What action was taken? What was the root cause?"
          className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!note.trim()} loading={loading} onClick={() => onConfirm(note)}>
            Mark Resolved
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function AlertDetail({ alert, onAcknowledge, onAssign, onResolve }: {
  alert: Alert;
  onAcknowledge: () => void;
  onAssign: () => void;
  onResolve: () => void;
}) {
  const navigate = useNavigate();
  const sev = SEVERITY_CFG[alert.severity];

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Summary banner */}
      <div className={`rounded-[12px] p-4 border ${sev.row}`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <SeverityDot s={alert.severity} pulse={alert.status === "open" && alert.severity === "critical"} />
          <SeverityBadge s={alert.severity} />
          <TypeBadge t={alert.alertType} />
          <StatusBadge s={alert.status} />
        </div>
        <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{alert.description}</p>
      </div>

      {/* Metadata */}
      <Card className="p-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Details</h4>
        <StatRow label="Alert ID" value={<span className="font-mono text-xs">{alert.id}</span>} />
        <StatRow label="Type" value={ALERT_TYPE_META[alert.alertType].label} />
        <StatRow label="Severity" value={<SeverityBadge s={alert.severity} />} />
        <StatRow label="Status" value={<StatusBadge s={alert.status} />} />
        <StatRow label="Created" value={new Date(alert.createdAt).toLocaleString("en-GB")} />
        <StatRow label="Assigned to" value={alert.assignedAdmin ?? <span className="text-slate-400 italic">Unassigned</span>} />
      </Card>

      {/* Related entities */}
      {(alert.entity || alert.secondaryEntity) && (
        <Card className="p-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Related Entities</h4>
          <div className="flex flex-col gap-2">
            {[alert.entity, alert.secondaryEntity].filter(Boolean).map((e) => (
              <button
                key={e!.id}
                onClick={() => navigate(e!.path)}
                className="flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-red-50/30 border border-slate-200 hover:border-red-200 rounded-[8px] transition-colors group"
              >
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-700 group-hover:text-[#BE1B2C]">{e!.label}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{e!.type}</p>
                </div>
                <ExternalLink size={12} className="text-slate-400 group-hover:text-[#BE1B2C] shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Timeline */}
      <Card className="p-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Timeline</h4>
        <div className="relative pl-5">
          <div className="absolute left-1.5 top-0 bottom-0 w-px bg-slate-200" />
          <div className="flex flex-col gap-4">
            <div className="relative">
              <span className="absolute -left-[14px] w-2 h-2 rounded-full bg-slate-400 mt-1" />
              <p className="text-xs font-semibold text-slate-700">Alert fired</p>
              <p className="text-[11px] text-slate-400">{new Date(alert.createdAt).toLocaleString("en-GB")}</p>
            </div>
            {alert.acknowledgedAt && (
              <div className="relative">
                <span className="absolute -left-[14px] w-2 h-2 rounded-full bg-blue-400 mt-1" />
                <p className="text-xs font-semibold text-slate-700">Acknowledged by {alert.acknowledgedBy}</p>
                <p className="text-[11px] text-slate-400">{new Date(alert.acknowledgedAt).toLocaleString("en-GB")}</p>
              </div>
            )}
            {alert.resolvedAt && (
              <div className="relative">
                <span className="absolute -left-[14px] w-2 h-2 rounded-full bg-green-500 mt-1" />
                <p className="text-xs font-semibold text-slate-700">Resolved by {alert.resolvedBy}</p>
                <p className="text-[11px] text-slate-400">{new Date(alert.resolvedAt).toLocaleString("en-GB")}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Resolution note */}
      {alert.resolutionNote && (
        <div className="bg-green-50 border border-green-200 rounded-[10px] p-3 text-xs text-green-700">
          <p className="font-bold text-[10px] uppercase tracking-wide mb-1">Resolution Note</p>
          <p className="italic leading-relaxed">"{alert.resolutionNote}"</p>
        </div>
      )}

      {/* Actions */}
      {alert.status !== "resolved" && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          {alert.status === "open" && (
            <Button variant="secondary" className="w-full" icon={<CheckCircle2 size={14} />} onClick={onAcknowledge}>
              Acknowledge
            </Button>
          )}
          <Button variant="secondary" className="w-full" icon={<UserPlus size={14} />} onClick={onAssign}>
            {alert.assignedAdmin ? "Reassign" : "Assign to Admin"}
          </Button>
          <Button variant="primary" className="w-full" icon={<CheckCircle2 size={14} />} onClick={onResolve}>
            Resolve Alert
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type TabId = "all" | "critical" | "warning" | "acknowledged" | "resolved";

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlertsList);
  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AlertType | "all">("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [selected, setSelected] = useState<Alert | null>(null);
  const [assignModal, setAssignModal] = useState<Alert | null>(null);
  const [resolveModal, setResolveModal] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const counts = useMemo(() => ({
    all: alerts.length,
    critical: alerts.filter(a => a.severity === "critical" && a.status !== "resolved").length,
    warning: alerts.filter(a => a.severity === "warning" && a.status !== "resolved").length,
    acknowledged: alerts.filter(a => a.status === "acknowledged").length,
    resolved: alerts.filter(a => a.status === "resolved").length,
  }), [alerts]);

  const filtered = useMemo(() => alerts.filter(a => {
    if (tab === "critical") return a.severity === "critical" && a.status !== "resolved";
    if (tab === "warning") return a.severity === "warning" && a.status !== "resolved";
    if (tab === "acknowledged") return a.status === "acknowledged";
    if (tab === "resolved") return a.status === "resolved";
    const q = search.toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q) && !(a.entity?.id.toLowerCase().includes(q))) return false;
    if (typeFilter !== "all" && a.alertType !== typeFilter) return false;
    if (assignedFilter === "unassigned" && a.assignedAdmin !== null) return false;
    if (assignedFilter !== "all" && assignedFilter !== "unassigned" && a.assignedAdmin !== assignedFilter) return false;
    return true;
  }), [alerts, tab, search, typeFilter, assignedFilter]);

  const mutate = (id: string, patch: Partial<Alert>) =>
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));

  const doAcknowledge = (alert: Alert) => {
    mutate(alert.id, { status: "acknowledged", acknowledgedAt: new Date().toISOString(), acknowledgedBy: "S. Chen" });
    setToast("Alert acknowledged.");
  };

  const doAssign = (alert: Alert, admin: string) => {
    mutate(alert.id, { assignedAdmin: admin });
    setAssignModal(null);
    setToast(`Alert assigned to ${admin}.`);
  };

  const doResolve = (alert: Alert, note: string) => {
    setLoading(true);
    setTimeout(() => {
      mutate(alert.id, { status: "resolved", resolvedAt: new Date().toISOString(), resolvedBy: "S. Chen", resolutionNote: note });
      setLoading(false);
      setResolveModal(null);
      setSelected(null);
      setToast("Alert resolved and logged.");
    }, 900);
  };

  const openAlertCount = alerts.filter(a => a.status === "open").length;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Alerts"
        description="Platform anomalies, safety flags, and operational warnings."
        actions={
          <div className="flex items-center gap-2">
            {openAlertCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-full">
                <AlertTriangle size={11} />
                {openAlertCount} open
              </span>
            )}
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* Severity tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { id: "critical" as TabId, label: "Critical", count: counts.critical, cls: "text-red-700", bg: counts.critical > 0 ? "bg-red-50 border-red-300" : "" },
          { id: "warning" as TabId, label: "Warning",  count: counts.warning,  cls: "text-amber-700", bg: counts.warning > 0 ? "bg-amber-50 border-amber-200" : "" },
          { id: "acknowledged" as TabId, label: "Acknowledged", count: counts.acknowledged, cls: "text-sky-700", bg: "" },
          { id: "resolved" as TabId, label: "Resolved", count: counts.resolved, cls: "text-green-700", bg: "" },
        ].map(tile => (
          <button
            key={tile.id}
            onClick={() => setTab(tab === tile.id ? "all" : tile.id)}
            className={`text-left p-4 rounded-[12px] border transition-all ${tab === tile.id ? "ring-2 ring-blue-400 ring-offset-1" : "hover:shadow-sm"} ${tile.bg || "bg-white border-slate-200"}`}
          >
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{tile.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${tile.cls}`}>{tile.count}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search alerts, IDs…"
            className="w-full h-9 bg-white border border-slate-200 rounded-[10px] pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
        </div>
        <Select
          value={typeFilter}
          onChange={v => setTypeFilter(v as AlertType | "all")}
          label="Type"
          options={[
            { value: "all", label: "All types" },
            ...Object.entries(ALERT_TYPE_META).map(([k, v]) => ({ value: k, label: v.label }))
          ]}
        />
        <Select
          value={assignedFilter}
          onChange={setAssignedFilter}
          label="Assigned"
          options={[
            { value: "all", label: "All" },
            { value: "unassigned", label: "Unassigned" },
            ...ADMINS.map(a => ({ value: a, label: a })),
          ]}
        />
        {tab !== "all" && (
          <button onClick={() => setTab("all")}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-[8px] transition-colors">
            <X size={11} /> Clear filter
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No alerts" description={tab === "critical" ? "No critical open alerts." : "No alerts match the current filters."} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {["", "Sev.", "Alert Type", "Related Entity", "Description", "Assigned", "Created", "Status", "Actions"].map((h, i) => (
                    <th key={i} className="px-3 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(alert => {
                  const sev = SEVERITY_CFG[alert.severity];
                  const isExpanded = expandedRow === alert.id;

                  return (
                    <React.Fragment key={alert.id}>
                      <tr
                        onClick={() => { setSelected(alert); setExpandedRow(null); }}
                        className={`border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors ${alert.severity === "critical" && alert.status === "open" ? "bg-red-50/20" : ""}`}
                      >
                        {/* Expand */}
                        <td className="pl-3 pr-1 py-3.5 w-6">
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedRow(isExpanded ? null : alert.id); }}
                            className="text-slate-300 hover:text-slate-500 transition-colors"
                          >
                            <ChevronDown size={13} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                        {/* Severity */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <SeverityDot s={alert.severity} pulse={alert.severity === "critical" && alert.status === "open"} />
                            <span className={`text-[10px] font-bold uppercase ${sev.badge.includes("red") ? "text-red-700" : "text-amber-700"}`}>
                              {alert.severity}
                            </span>
                          </div>
                        </td>
                        {/* Type */}
                        <td className="px-3 py-3.5">
                          <TypeBadge t={alert.alertType} />
                        </td>
                        {/* Entity */}
                        <td className="px-3 py-3.5">
                          {alert.entity ? (
                            <div>
                              <p className="text-xs font-semibold text-slate-700 font-mono">{alert.entity.id}</p>
                              <p className="text-[10px] text-slate-400 capitalize">{alert.entity.type}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        {/* Description */}
                        <td className="px-3 py-3.5 max-w-[280px]">
                          <p className="text-xs font-semibold text-slate-700 leading-snug">{alert.title}</p>
                        </td>
                        {/* Assigned */}
                        <td className="px-3 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                          {alert.assignedAdmin ?? <span className="italic text-slate-400">Unassigned</span>}
                        </td>
                        {/* Created */}
                        <td className="px-3 py-3.5 text-xs text-slate-400 whitespace-nowrap">{relTime(alert.createdAt)}</td>
                        {/* Status */}
                        <td className="px-3 py-3.5">
                          <StatusBadge s={alert.status} />
                        </td>
                        {/* Actions */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            {alert.entity && (
                              <ActionBtn
                                label="Investigate" icon={<ExternalLink size={11} />}
                                onClick={() => setSelected(alert)}
                              />
                            )}
                            {alert.status !== "resolved" && (
                              <ActionBtn
                                label="Assign" icon={<UserPlus size={11} />}
                                onClick={() => setAssignModal(alert)}
                              />
                            )}
                            {alert.status === "open" && (
                              <ActionBtn
                                label="Ack" icon={<CheckCircle2 size={11} />}
                                onClick={() => doAcknowledge(alert)}
                              />
                            )}
                            {alert.status !== "resolved" && (
                              <ActionBtn
                                label="Resolve" icon={<XCircle size={11} />} primary
                                onClick={() => setResolveModal(alert)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <td colSpan={9} className="px-6 py-4">
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">{alert.description}</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              {[alert.entity, alert.secondaryEntity].filter(Boolean).map(e => (
                                <button
                                  key={e!.id}
                                  onClick={() => setSelected(alert)}
                                  className="flex items-center gap-1.5 text-xs text-[#BE1B2C] hover:text-[#A31725] font-mono bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-[6px] transition-colors"
                                >
                                  {e!.label} <ExternalLink size={10} />
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.id ?? "Alert"} width="w-[520px]">
        {selected && (
          <AlertDetail
            alert={selected}
            onAcknowledge={() => { doAcknowledge(selected); setSelected(null); }}
            onAssign={() => setAssignModal(selected)}
            onResolve={() => setResolveModal(selected)}
          />
        )}
      </Drawer>

      {assignModal && (
        <AssignModal
          alert={assignModal}
          onConfirm={admin => doAssign(assignModal, admin)}
          onClose={() => setAssignModal(null)}
        />
      )}
      {resolveModal && (
        <ResolveModal
          alert={resolveModal}
          onConfirm={note => doResolve(resolveModal, note)}
          onClose={() => setResolveModal(null)}
          loading={loading}
        />
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

function ActionBtn({ label, icon, onClick, primary = false }: {
  label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-[6px] transition-colors whitespace-nowrap
        ${primary
          ? "bg-[#BE1B2C] text-white hover:bg-[#A31725]"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}>
      {icon}{label}
    </button>
  );
}
