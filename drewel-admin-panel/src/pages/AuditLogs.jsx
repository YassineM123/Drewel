import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { getPointsAdminAudits, pointsErrorMessage } from "../utils/pointsAdminApi";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  SectionHeader,
  Select,
} from "../components/ui";

const ACTION_LABELS = {
  POINTS_CREDIT: "Points credit",
  POINTS_DEBIT: "Points debit",
  PURCHASE_REQUEST_TRANSITION: "Purchase request transition",
  POINTS_SETTINGS_UPDATE: "Points settings update",
  POINT_PACK_CREATE: "Point pack created",
  POINT_PACK_UPDATE: "Point pack updated",
};

const ACTION_VARIANTS = {
  POINTS_CREDIT: "approved",
  POINTS_DEBIT: "rejected",
  PURCHASE_REQUEST_TRANSITION: "info",
  POINTS_SETTINGS_UPDATE: "warning",
  POINT_PACK_CREATE: "approved",
  POINT_PACK_UPDATE: "info",
};

const PAGE_SIZES = [10, 25, 50];

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "N/A";

const compactId = (value, length = 6) => {
  if (!value) return "";
  const text = String(value);
  return text.length <= length + 1 ? text : `${text.slice(0, length)}\u2026`;
};

const shortRole = (role = "") => String(role).replaceAll("_", " ").toUpperCase();

const matchesSearch = (audit, query) => {
  if (!query) return true;
  const haystack = [
    audit.reason,
    audit.idempotencyKey,
    audit.requestId,
    audit.adminId,
    audit.driverId,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join(" ");
  return haystack.includes(query.toLowerCase());
};

const AuditLogs = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [action, setAction] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      action: action || undefined,
    };
    try {
      setLoading(true);
      setError("");
      const payload = await getPointsAdminAudits(params);
      const body = payload?.data || payload || {};
      const records = body.audits || [];
      const meta = body.pagination || {};
      setAudits(records);
      setPagination({
        page: Number(meta.page || params.page),
        limit: Number(meta.limit || params.limit),
        total: Number(meta.total ?? records.length),
        totalPages: Number(meta.totalPages || 1),
      });
    } catch (err) {
      setAudits([]);
      setError(pointsErrorMessage(err, "Failed to load audit records."));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, action]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = audits.filter((audit) => matchesSearch(audit, debouncedSearch));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Audit Logs"
        description="Append-only administrator activity from the backend audit trail, latest first."
      />

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by idempotency key..."
              leftIcon={<Search size={14} />}
              aria-label="Search audit records"
            />
          </div>
          <Select
            value={action}
            onChange={(value) => {
              setAction(value);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
            options={[
              { value: "", label: "All actions" },
              { value: "points_credit", label: "Points credit" },
              { value: "points_debit", label: "Points debit" },
              { value: "purchase_request_transition", label: "Purchase request transition" },
              { value: "points_settings_update", label: "Points settings update" },
              { value: "point_pack_create", label: "Point pack created" },
              { value: "point_pack_update", label: "Point pack updated" },
            ]}
            aria-label="Filter by action"
          />
          <button
            type="button"
            disabled={loading}
            onClick={load}
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium rounded-[10px] bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center text-center gap-3" role="status">
            <Loader2 size={22} className="animate-spin text-slate-400" />
            <p className="text-sm text-slate-500">Loading audit trail...</p>
          </div>
        ) : error ? (
          <ErrorState title="Unable to load audit records" description={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No audit records match"
            description={action || debouncedSearch ? "Try a different filter or clear the search." : "Administrator activity will appear here as it is recorded."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5 bg-slate-50/70 border-b border-slate-100">
                    Timestamp
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5 bg-slate-50/70 border-b border-slate-100">
                    Action
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5 bg-slate-50/70 border-b border-slate-100">
                    Change
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5 bg-slate-50/70 border-b border-slate-100">
                    Reason
                  </th>
                  <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5 bg-slate-50/70 border-b border-slate-100">
                    Actor
                  </th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => {
                  const change =
                    audit.action !== "PURCHASE_REQUEST_TRANSITION" &&
                    audit.pointsChange !== undefined &&
                    audit.pointsChange !== null
                      ? `${audit.pointsChange > 0 ? "+" : ""}${audit.pointsChange} pts`
                      : null;
                  return (
                    <tr key={audit._id || audit.id || audit.idempotencyKey} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">{formatDate(audit.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        {ACTION_LABELS[audit.action] ? (
                          <Badge variant={ACTION_VARIANTS[audit.action]} label={ACTION_LABELS[audit.action]} />
                        ) : (
                          <span className="text-sm text-slate-700">{String(audit.action || "action").replaceAll("_", " ")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums whitespace-nowrap">{change ?? "\u2014"}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 max-w-[280px] truncate" title={audit.reason}>
                        {audit.reason}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-700">{compactId(audit.adminId)}</span>
                          <span className="text-[11px] text-slate-400 uppercase tracking-wide">{shortRole(audit.adminRole)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && audits.length > 0 && (
          <Pagination
            page={pagination.page}
            total={pagination.total}
            perPage={pagination.limit}
            onChange={(page) => setPagination((current) => ({ ...current, page }))}
          />
        )}
      </Card>
    </div>
  );
};

export default AuditLogs;