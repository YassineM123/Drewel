import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import PropTypes from "prop-types";
import { Search, Download, RefreshCw, X, Printer } from "lucide-react";
import {
  Badge, Button, Card, Select, KpiCard, Th, Td, Tr,
  Pagination, FilterChip, EmptyState, ErrorState, LoadingState, SectionHeader,
} from "../components/ui";
import {
  approveProfileRequest,
  approveRequest,
  getRequests,
  reopenProfileRequest,
  reopenRequest,
} from "../utils/requestsApi";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const REQUEST_STAGES = new Set(["basic", "profile"]);

const getInitialRequestStage = (status, searchParams) => {
  const requestedStage = searchParams?.get("stage");
  if (REQUEST_STAGES.has(requestedStage)) return requestedStage;
  // Document amendments are Approval 2 requests. Make them visible when an
  // administrator opens Pending Requests, while Approval 1 remains one click
  // away in the stage selector and via its dedicated navigation link.
  return status === "pending" ? "profile" : "basic";
};

const pageConfig = {
  pending: { title: "Pending", description: "Requests waiting for review at the selected approval stage." },
  approved: { title: "Approved", description: "Validated requests and their approval history." },
  rejected: { title: "Rejected", description: "Requests rejected during review." },
  all: { title: "All Requests", description: "Review and approve driver onboarding and document submissions." },
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const STAGE_OPTIONS = [
  { value: "basic", label: "Approval 1 - Registration" },
  { value: "profile", label: "Approval 2 - Profile & documents" },
];

const SORT_OPTIONS = [
  { value: "approvedAt:desc", label: "Approval date - newest" },
  { value: "approvedAt:asc", label: "Approval date - oldest" },
  { value: "submittedAt:desc", label: "Submission date - newest" },
  { value: "submittedAt:asc", label: "Submission date - oldest" },
];

const getId = (request) => request.requestId || request.requestCode || request._id || request.id;
const getName = (request) => request.requesterName || request.requester?.name ||
  `${request.firstName || ""} ${request.lastName || ""}`.trim() || request.fullName || "N/A";
const getInitials = (request) => {
  const name = getName(request);
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase()).slice(0, 2).join("") || "?";
};
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value)) : "N/A";
const stageStatus = (request, stage) => {
  const nested = request?.stages?.[stage]?.status;
  if (nested) return String(nested).toLowerCase();
  // A Request 2 can only be submitted after Request 1 has been approved.
  // Profile-stage list responses alias `status` to the selected stage.
  if (stage === "basic" && request?.requestStage === "profile") return "approved";
  if (stage === "profile") {
    if (request.profileRequestStatus) return String(request.profileRequestStatus).toLowerCase();
    return String(request.status).toLowerCase() === "completed" ? "approved" : "not_submitted";
  }
  return ["approved", "completed"].includes(String(request.status).toLowerCase()) ? "approved" : String(request.status || "pending").toLowerCase();
};
const overallStatus = (request) => {
  if (request?.overallStatus) return String(request.overallStatus).toLowerCase();
  if (request?.requestStage === "profile") {
    return stageStatus(request, "profile") === "approved" ? "completed" : "approved";
  }
  return String(request?.status || "pending").toLowerCase();
};

const unwrap = (payload) => payload?.data || payload || {};
const normalizeList = (payload) => {
  const body = unwrap(payload);
  const requests = body.requests || body.items || body.drivers || [];
  const pagination = body.pagination || {};
  return {
    requests: Array.isArray(requests) ? requests : [],
    kpis: body.kpis || body.metrics || {},
    filterOptions: body.filterOptions || {},
    pagination: {
      page: Number(pagination.page || body.page || 1),
      limit: Number(pagination.limit || body.limit || 10),
      total: Number(pagination.total ?? body.total ?? requests.length ?? 0),
      totalPages: Number(pagination.totalPages || body.totalPages || 1),
    },
  };
};

const formatDuration = (milliseconds) => {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value < 0) return "N/A";
  const minutes = Math.round(value / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours < 24 ? `${hours.toFixed(hours < 10 ? 1 : 0)} h` : `${(hours / 24).toFixed(1)} d`;
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character]));

const downloadBlob = (content, type, filename) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const printableRows = (requests) => requests.map((request) => `
  <tr><td>${escapeHtml(getId(request))}</td><td>${escapeHtml(request.type || request.requestType || "Driver verification")}</td>
  <td>${escapeHtml(getName(request))}</td><td>${escapeHtml(formatDate(request.submittedAt || request.basicRequestSubmittedAt || request.createdAt))}</td>
  <td>${escapeHtml(stageStatus(request, "basic"))}</td><td>${escapeHtml(formatDate(request.stages?.basic?.approvedAt || request.approvedAt))}</td>
  <td>${escapeHtml(stageStatus(request, "profile"))}</td><td>${escapeHtml(formatDate(request.stages?.profile?.approvedAt || request.profileApprovedAt))}</td>
  <td>${escapeHtml(overallStatus(request))}</td></tr>`).join("");

const openPrintView = (requests, title) => {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.opener = null;
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    body{font-family:Arial,sans-serif;color:#222;padding:24px}h1{color:#BE1B2C}table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #E4E2DF;padding:8px;text-align:left;font-size:12px}th{background:#F5F4F3}@media print{button{display:none}}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <table><thead><tr><th>Request ID</th><th>Type</th><th>Requester</th><th>Submitted</th><th>Approval 1</th><th>Approval 1 date</th><th>Approval 2</th><th>Approval 2 date</th><th>Overall</th></tr></thead>
  <tbody>${printableRows(requests)}</tbody></table><p><button onclick="window.print()">Print / Save as PDF</button></p></body></html>`);
  popup.document.close();
  return true;
};

function ApprovalCell({ status }) {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Approved</span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Rejected</span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Pending</span>
  );
  return <span className="text-xs text-slate-400">Not submitted</span>;
}
ApprovalCell.propTypes = { status: PropTypes.string };

const RequestsPage = ({ status = "all" }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const config = pageConfig[status] || pageConfig.all;
  const [requests, setRequests] = useState([]);
  const [kpis, setKpis] = useState({});
  const [filterOptions, setFilterOptions] = useState({ types: [], responsibles: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    search: "", period: "all", type: "", responsible: "",
    stage: getInitialRequestStage(status, searchParams),
    status: status === "all" ? "" : status,
    sortBy: status === "approved" ? "approvedAt" : "submittedAt",
    sortOrder: "desc",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const requestedStage = searchParams.get("stage");
    if (REQUEST_STAGES.has(requestedStage) && requestedStage !== filters.stage) {
      setFilters((current) => ({ ...current, stage: requestedStage }));
      setPagination((current) => ({ ...current, page: 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const dateRange = useMemo(() => {
    if (filters.period === "all") return {};
    const to = new Date();
    const from = new Date();
    if (filters.period === "today") from.setHours(0, 0, 0, 0);
    if (filters.period === "7d") from.setDate(from.getDate() - 7);
    if (filters.period === "30d") from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [filters.period]);

  const loadRequests = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");
      const payload = await getRequests({
        status: status === "all" ? filters.status || "all" : status,
        search: debouncedSearch || undefined, type: filters.type || undefined,
        responsible: filters.responsible || undefined, sortBy: filters.sortBy,
        stage: filters.stage || undefined,
        sortOrder: filters.sortOrder, page: pagination.page, limit: pagination.limit, ...dateRange,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      }, signal);
      const normalized = normalizeList(payload);
      setRequests(normalized.requests);
      setKpis(normalized.kpis);
      setFilterOptions(normalized.filterOptions);
      setPagination((current) => ({ ...current, ...normalized.pagination }));
    } catch (requestError) {
      if (requestError?.code !== "ERR_CANCELED") setError(requestError?.response?.data?.message || "Unable to load requests right now.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [dateRange, debouncedSearch, filters.responsible, filters.sortBy, filters.sortOrder, filters.stage, filters.status, filters.type, pagination.limit, pagination.page, status]);

  useEffect(() => {
    const controller = new AbortController();
    loadRequests(controller.signal);
    return () => controller.abort();
  }, [loadRequests]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const setStage = (nextStage) => {
    setFilters((current) => ({ ...current, stage: nextStage, ...(status === "all" ? { status: "" } : {}) }));
    setSearchParams((current) => { const next = new URLSearchParams(current); next.set("stage", nextStage); return next; }, { replace: true });
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const toast = (icon, title) => Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 2500, timerProgressBar: true });

  const mutate = async (request, action, successMessage) => {
    const id = getId(request);
    try {
      setBusyId(id);
      await action(id);
      await toast("success", successMessage);
      await loadRequests();
    } catch (mutationError) {
      Swal.fire("Error", mutationError?.response?.data?.message || "The request could not be updated.", "error");
    } finally { setBusyId(""); }
  };

  const confirmReopen = async (request) => {
    const result = await Swal.fire({ title: "Reopen this request?", text: "It will return to Pending Requests. Its history will be preserved.", icon: "warning", showCancelButton: true, confirmButtonText: "Reopen request", confirmButtonColor: "#BE1B2C" });
    if (result.isConfirmed) mutate(request, reopenRequest, "Request 1 reopened");
  };

  const confirmProfileReopen = async (request) => {
    const result = await Swal.fire({ title: "Reopen Request 2?", text: "The profile and documents will return to pending review. Its history will be preserved.", icon: "warning", showCancelButton: true, confirmButtonText: "Reopen Request 2", confirmButtonColor: "#BE1B2C" });
    if (result.isConfirmed) mutate(request, reopenProfileRequest, "Request 2 reopened");
  };

  const showDetails = (request) => navigate(`/verification/${getId(request)}`);

  const exportCsv = () => {
    const values = requests.map((request) => [getId(request), request.type || request.requestType || "Driver verification", getName(request), formatDate(request.submittedAt || request.basicRequestSubmittedAt || request.createdAt), stageStatus(request, "basic"), formatDate(request.stages?.basic?.approvedAt || (request.requestStage === "basic" ? request.approvedAt : request.basicApprovedAt)), request.stages?.basic?.approvedBy?.fullName || (request.requestStage === "basic" ? request.approvedBy?.fullName : request.basicApprovedBy?.fullName) || request.basicApprovedByName || "", stageStatus(request, "profile"), formatDate(request.stages?.profile?.approvedAt || request.profileApprovedAt), request.stages?.profile?.approvedBy?.fullName || request.profileApprovedBy?.fullName || request.profileApprovedByName || "", overallStatus(request)]);
    const csv = [["Request ID", "Type", "Requester", "Submitted", "Approval 1 status", "Approval 1 date", "Approval 1 approved by", "Approval 2 status", "Approval 2 date", "Approval 2 approved by", "Overall status"], ...values]
      .map((row) => row.map((cell) => {
        const value = String(cell ?? "");
        const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
        return `"${safeValue.replaceAll('"', '""')}"`;
      }).join(",")).join("\r\n");
    downloadBlob(`\uFEFF${csv}`, "text/csv;charset=utf-8", `${status}-requests.csv`);
    toast("success", "CSV exported");
  };

  const activeFilters = [];
  if (filters.status) activeFilters.push({ label: `Status: ${filters.status}`, clear: () => updateFilter("status", "") });
  if (filters.type) activeFilters.push({ label: `Type: ${filters.type}`, clear: () => updateFilter("type", "") });
  if (filters.period !== "all") activeFilters.push({ label: `Period: ${filters.period}`, clear: () => updateFilter("period", "all") });
  if (filters.responsible) {
    const match = (filterOptions.responsibles || []).find((r) => r._id === filters.responsible);
    activeFilters.push({ label: `Responsible: ${match?.fullName || match?.email || filters.responsible}`, clear: () => updateFilter("responsible", "") });
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={() => loadRequests()}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Download size={14} />} disabled={!requests.length} onClick={exportCsv}>Export CSV</Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} disabled={!requests.length} onClick={() => openPrintView(requests, config.title)}>Print / PDF</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total" value={pagination.total} tooltip="Requests matching the current filters" />
        <KpiCard label="Pending" value={kpis.pending ?? kpis.totalPending ?? "—"} urgent tooltip="Requests awaiting review at this stage" />
        <KpiCard label="Approved" value={kpis.approved ?? kpis.totalApproved ?? "—"} tooltip="Requests approved at this stage" />
        <KpiCard label="Avg. Approval Time" value={kpis.averageApprovalTimeFormatted ?? formatDuration(kpis.averageApprovalTimeMs) ?? "—"} tooltip="Average time from submission to approval" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Search by request ID or requester name…"
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
            />
            {filters.search && (
              <button type="button" onClick={() => updateFilter("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>
          <Select value={filters.stage} onChange={setStage} options={STAGE_OPTIONS} className="w-56" />
          {status === "all" && <Select value={filters.status} onChange={(v) => updateFilter("status", v)} options={STATUS_OPTIONS} className="w-36" />}
          <Select value={filters.period} onChange={(v) => updateFilter("period", v)} options={PERIOD_OPTIONS} className="w-36" />
          <Select
            value={filters.type}
            onChange={(v) => updateFilter("type", v)}
            options={[{ value: "", label: "All Types" }, ...(filterOptions.types || [])]}
            className="w-44"
          />
          <Select
            value={filters.responsible}
            onChange={(v) => updateFilter("responsible", v)}
            options={[{ value: "", label: "All Responsibles" }, ...(filterOptions.responsibles || []).map((r) => ({ value: r._id, label: r.fullName || r.email }))]}
            className="w-44"
          />
          <Select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onChange={(v) => { const [sortBy, sortOrder] = v.split(":"); setFilters((current) => ({ ...current, sortBy, sortOrder })); setPagination((current) => ({ ...current, page: 1 })); }}
            options={SORT_OPTIONS}
            className="w-48"
          />
          {activeFilters.length > 0 && (
            <button type="button" onClick={() => { updateFilter("status", ""); updateFilter("type", ""); updateFilter("period", "all"); updateFilter("responsible", ""); }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 underline underline-offset-2">
              Clear all
            </button>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {activeFilters.map((f) => <FilterChip key={f.label} label={f.label} onRemove={f.clear} />)}
          </div>
        )}
      </Card>

      <Card>
        {loading ? (
          <LoadingState label="Loading requests…" />
        ) : error ? (
          <ErrorState description={error} action={<Button variant="secondary" size="sm" onClick={() => loadRequests()}>Retry</Button>} />
        ) : requests.length === 0 ? (
          <EmptyState title="No requests found" description="Try adjusting the search or filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Request ID</Th>
                    <Th>Type</Th>
                    <Th>Requester</Th>
                    <Th>Submitted</Th>
                    <Th>Approval 1</Th>
                    <Th>Approval 2</Th>
                    <Th>Overall</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => {
                    const id = getId(request);
                    const basic = stageStatus(request, "basic");
                    const profile = stageStatus(request, "profile");
                    const activeStageStatus = filters.stage === "profile" ? profile : basic;
                    return (
                      <Tr key={id}>
                        <Td><span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{id}</span></Td>
                        <Td><span className="text-xs text-slate-600">{request.type || request.requestType || "Driver verification"}</span></Td>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-[11px] font-bold text-[#BE1B2C] shrink-0">{getInitials(request)}</div>
                            <div className="text-sm font-medium text-slate-800">{getName(request)}</div>
                          </div>
                        </Td>
                        <Td><span className="text-xs text-slate-600">{formatDate(request.submittedAt || request.basicRequestSubmittedAt || request.createdAt)}</span></Td>
                        <Td><ApprovalCell status={basic} /></Td>
                        <Td><ApprovalCell status={profile} /></Td>
                        <Td><Badge variant={overallStatus(request)} /></Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button variant="secondary" size="sm" onClick={() => showDetails(request)}>Review</Button>
                            {filters.stage === "basic" && activeStageStatus === "pending" && (
                              <Button variant="primary" size="sm" disabled={busyId === id} onClick={() => mutate(request, approveRequest, "Request 1 approved")}>Approve</Button>
                            )}
                            {filters.stage === "basic" && activeStageStatus === "approved" && (
                              <Button variant="warning" size="sm" disabled={busyId === id} onClick={() => confirmReopen(request)}>Reopen</Button>
                            )}
                            {filters.stage === "profile" && activeStageStatus === "pending" && (
                              <Button variant="primary" size="sm" disabled={busyId === id} onClick={() => mutate(request, approveProfileRequest, "Request 2 approved")}>Approve</Button>
                            )}
                            {filters.stage === "profile" && activeStageStatus === "approved" && (
                              <Button variant="warning" size="sm" disabled={busyId === id} onClick={() => confirmProfileReopen(request)}>Reopen</Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <label className="text-xs text-slate-400 flex items-center gap-2">
                Rows
                <select value={pagination.limit} onChange={(e) => setPagination((current) => ({ ...current, page: 1, limit: Number(e.target.value) }))}
                  className="h-8 bg-white border border-slate-200 rounded-[8px] px-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-700/20">
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            <Pagination page={pagination.page} total={pagination.total} perPage={pagination.limit} onChange={(page) => setPagination((current) => ({ ...current, page }))} />
          </>
        )}
      </Card>
    </div>
  );
};

RequestsPage.propTypes = { status: PropTypes.oneOf(["pending", "approved", "rejected", "all"]) };
export default RequestsPage;
