import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { getOperationalAuditLogs, operationalErrorMessage } from "../api/domains/operational";
import {
  Badge, Card, EmptyState, ErrorState, Input, Pagination, SectionHeader, Select,
} from "../components/ui";

const DOMAIN_LABELS = { request: "Request", ride: "Ride", communication: "Communication", points: "Points", auth: "Auth" };
const DOMAIN_VARIANTS = { request: "info", ride: "pending", communication: "warning", points: "approved", auth: "rejected" };

function formatDate(v) {
  if (!v) return "\u2014";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}

const AuditLogs = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getOperationalAuditLogs({
        page: pagination.page,
        limit: pagination.limit,
        types: domainFilter || undefined,
        action: actionFilter || undefined,
        search: debouncedSearch || undefined,
      });
      setItems(result.items);
      setPagination((p) => ({ ...p, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setItems([]);
      setError(operationalErrorMessage(err, "Failed to load audit logs."));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, domainFilter, actionFilter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const formatDetails = (item) => {
    if (!item.details) return "\u2014";
    if (item.domain === "ride") {
      const d = item.details;
      return d.fromStatus && d.toStatus ? `${d.fromStatus} \u2192 ${d.toStatus}` : d.rideId || "\u2014";
    }
    if (item.domain === "points") {
      const d = item.details;
      return d.pointsChange != null ? `${d.pointsChange > 0 ? "+" : ""}${d.pointsChange} pts` : "\u2014";
    }
    if (item.domain === "request") {
      const d = item.details;
      return d.oldStatus && d.newStatus ? `${d.oldStatus} \u2192 ${d.newStatus}` : "\u2014";
    }
    if (item.domain === "auth") {
      return item.details.targetType ? `${item.details.targetType}` : "\u2014";
    }
    return "\u2014";
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Audit Logs"
        description="Cross-domain append-only audit trail: authentication, rides, requests, points, and communication."
        actions={
          <button type="button" disabled={loading} onClick={load}
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium rounded-[10px] bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit logs..." leftIcon={<Search size={14} />} />
          </div>
          <Select value={domainFilter} onChange={setDomainFilter} options={[
            { value: "", label: "All Domains" },
            { value: "auth", label: "Authentication" },
            { value: "ride", label: "Rides" },
            { value: "request", label: "Requests" },
            { value: "points", label: "Points" },
            { value: "communication", label: "Communication" },
          ]} />
          <Input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="Action filter..." className="w-48" />
        </div>

        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-center gap-3" role="status">
            <Loader2 size={22} className="animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Loading audit trail...</p>
          </div>
        ) : error ? (
          <ErrorState title="Unable to load audit logs" description={error} />
        ) : items.length === 0 ? (
          <EmptyState title="No audit records" description="Activity will appear here as it is recorded." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  {["Timestamp", "Domain", "Action", "Details", "Actor", "Reason"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5 bg-slate-50/70 border-b border-slate-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">{formatDate(item.occurredAt)}</td>
                    <td className="px-4 py-3.5"><Badge variant={DOMAIN_VARIANTS[item.domain] || "info"} label={DOMAIN_LABELS[item.domain] || item.domain} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{String(item.action || "").replace(/_/g, " ")}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{formatDetails(item)}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      {item.actorName || (item.actorId ? String(item.actorId).slice(0, 8) + "\u2026" : "\u2014")}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 max-w-[200px] truncate" title={item.reason}>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && items.length > 0 && (
          <Pagination page={pagination.page} total={pagination.total} perPage={pagination.limit} onChange={(p) => setPagination((prev) => ({ ...prev, page: p }))} />
        )}
      </Card>
    </div>
  );
};

export default AuditLogs;
