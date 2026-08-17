import { useState, useMemo } from "react";
import { Search, Lock, Download, Car, CreditCard, FileText, Navigation } from "lucide-react";
import { Card, SectionHeader, Th, Td, Tr, Pagination, Select, EmptyState, Toast } from "../components/ui";
import { mockAuditLogs } from "../data/mockRides";

const ACTION_STYLES: Record<string, string> = {
  add_points:               "bg-green-50 text-green-700 border-green-200",
  admin_refund:             "bg-violet-50 text-violet-700 border-violet-200",
  admin_correction:         "bg-amber-50 text-amber-700 border-amber-200",
  approve_verification_a1:  "bg-amber-50 text-amber-700 border-amber-200",
  approve_verification_a2:  "bg-amber-50 text-amber-700 border-amber-200",
  reject_verification_a1:   "bg-red-50 text-red-700 border-red-200",
  approve_point_request:    "bg-green-50 text-green-700 border-green-200",
  reject_point_request:     "bg-red-50 text-red-700 border-red-200",
  welcome_credit:           "bg-slate-100 text-slate-600 border-slate-200",
  cancel_ride:              "bg-red-50 text-red-700 border-red-200",
  resolve_dispute:          "bg-amber-50 text-amber-700 border-amber-200",
  unlock_ride:              "bg-amber-50 text-amber-700 border-amber-200",
};

function EntityIcon({ type }: { type: string }) {
  const cls = "shrink-0 opacity-60";
  if (type === "DriverPoints") return <CreditCard size={12} className={cls} />;
  if (type === "VerificationRequest") return <FileText size={12} className={cls} />;
  if (type === "PointRequest") return <CreditCard size={12} className={cls} />;
  if (type === "Ride") return <Navigation size={12} className={cls} />;
  if (type === "Driver") return <Car size={12} className={cls} />;
  return <FileText size={12} className={cls} />;
}

const DATE_RANGES = [
  { value: "all",   label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7d",    label: "Last 7 days" },
  { value: "30d",   label: "Last 30 days" },
];

function inRange(iso: string, range: string): boolean {
  if (range === "all") return true;
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (range === "today") return diff < 86400000;
  if (range === "7d")  return diff < 7 * 86400000;
  if (range === "30d") return diff < 30 * 86400000;
  return true;
}

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => mockAuditLogs.filter(log => {
    const matchSearch = !search
      || log.actor.toLowerCase().includes(search.toLowerCase())
      || log.action.toLowerCase().includes(search.toLowerCase())
      || log.entityId.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === "all" || log.action === actionFilter;
    const matchEntity = entityFilter === "all" || log.entityType === entityFilter;
    const matchDate = inRange(log.createdAt, dateRange);
    return matchSearch && matchAction && matchEntity && matchDate;
  }), [search, actionFilter, entityFilter, dateRange]);

  const perPage = 10;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleExport = () => {
    const header = "Log ID,Actor,Role,Action,Entity Type,Entity ID,Old Value,New Value,Reason,IP,Timestamp";
    const rows = filtered.map(log =>
      [log.id, log.actor, log.role, log.action, log.entityType, log.entityId,
       log.oldValue ?? "", log.newValue ?? "", log.reason ?? "", log.ip, log.createdAt]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast(`Exported ${filtered.length} log entries as CSV.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Audit Logs"
        description="Immutable record of all administrative actions. Logs cannot be edited or deleted."
        actions={
          <>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-full">
              <Lock size={11} /> Immutable
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 rounded-[10px] px-3 h-10 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Actor, action or entity ID…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
          />
        </div>
        <Select value={dateRange} onChange={v => { setDateRange(v); setPage(1); }} options={DATE_RANGES} className="w-36" />
        <Select value={actionFilter} onChange={v => { setActionFilter(v); setPage(1); }} options={[
          { value: "all", label: "All Actions" },
          { value: "add_points", label: "Add Points" },
          { value: "admin_refund", label: "Admin Refund" },
          { value: "approve_point_request", label: "Approve Point Request" },
          { value: "reject_point_request", label: "Reject Point Request" },
          { value: "approve_verification_a1", label: "Approve Verification A1" },
          { value: "approve_verification_a2", label: "Approve Verification A2" },
          { value: "reject_verification_a1", label: "Reject Verification A1" },
          { value: "cancel_ride", label: "Cancel Ride" },
          { value: "resolve_dispute", label: "Resolve Dispute" },
        ]} className="w-52" />
        <Select value={entityFilter} onChange={v => { setEntityFilter(v); setPage(1); }} options={[
          { value: "all", label: "All Entities" },
          { value: "DriverPoints", label: "Driver Points" },
          { value: "VerificationRequest", label: "Verification Request" },
          { value: "PointRequest", label: "Point Request" },
          { value: "Ride", label: "Ride" },
        ]} className="w-44" />
        {filtered.length !== mockAuditLogs.length && (
          <span className="text-xs text-slate-400 tabular-nums">{filtered.length} of {mockAuditLogs.length}</span>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Log ID</Th>
                <Th>Actor</Th>
                <Th>Role</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Old Value</Th>
                <Th>New Value</Th>
                <Th>Reason</Th>
                <Th>IP</Th>
                <Th>Timestamp</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={10}><EmptyState title="No audit logs match your search" /></td></tr>
              ) : paginated.map(log => (
                <Tr key={log.id}>
                  <Td>
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded select-all">{log.id}</span>
                  </Td>
                  <Td>
                    <p className="text-sm font-medium text-slate-800">{log.actor}</p>
                  </Td>
                  <Td>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${log.role === "System" ? "text-slate-500" : "text-[#BE1B2C] bg-red-50"}`}>{log.role}</span>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${ACTION_STYLES[log.action] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <EntityIcon type={log.entityType} />
                      <div>
                        <p className="text-xs font-medium text-slate-700">{log.entityType}</p>
                        <p className="font-mono text-xs text-slate-400">{log.entityId}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="text-xs text-slate-500 max-w-[100px] block truncate" title={log.oldValue ?? ""}>{log.oldValue ?? "—"}</span></Td>
                  <Td><span className="text-xs text-slate-600 max-w-[100px] block truncate" title={log.newValue ?? ""}>{log.newValue ?? "—"}</span></Td>
                  <Td><span className="text-xs text-slate-500 max-w-[120px] block truncate" title={log.reason ?? ""}>{log.reason ?? "—"}</span></Td>
                  <Td><span className="font-mono text-xs text-slate-400">{log.ip}</span></Td>
                  <Td><span className="text-xs text-slate-500 whitespace-nowrap">{formatTs(log.createdAt)}</span></Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </Card>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
