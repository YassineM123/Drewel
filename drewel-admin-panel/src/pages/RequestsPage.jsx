import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import PropTypes from "prop-types";
import {
  approveProfileRequest,
  approveRequest,
  getRequests,
  reopenProfileRequest,
  reopenRequest,
} from "../utils/requestsApi";
import "../assets/css/requests.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const pageConfig = {
  pending: { title: "Pending Requests", description: "Requests waiting for review" },
  approved: { title: "Approved Requests", description: "Validated requests and their approval history" },
  rejected: { title: "Rejected Requests", description: "Requests rejected during review" },
  all: { title: "All Requests", description: "Every submitted request, without deleting its history" },
};

const getId = (request) => request.requestId || request.requestCode || request._id || request.id;
const getName = (request) => request.requesterName || request.requester?.name ||
  `${request.firstName || ""} ${request.lastName || ""}`.trim() || request.fullName || "N/A";
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value)) : "N/A";
const statusClass = (status) => ({
  approved: "badge-success", completed: "badge-primary", rejected: "badge-danger",
  pending: "badge-warning",
}[String(status || "pending").toLowerCase()] || "badge-secondary");
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
const statusBadge = (value) => <span className={`badge ${statusClass(value)}`}>{String(value || "pending").replaceAll("_", " ").toUpperCase()}</span>;

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
    body{font-family:Arial,sans-serif;color:#172b4d;padding:24px}h1{color:#00489d}table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #dfe3e8;padding:8px;text-align:left;font-size:12px}th{background:#f4f7fb}@media print{button{display:none}}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <table><thead><tr><th>Request ID</th><th>Type</th><th>Requester</th><th>Submitted</th><th>Approval 1</th><th>Approval 1 date</th><th>Approval 2</th><th>Approval 2 date</th><th>Overall</th></tr></thead>
  <tbody>${printableRows(requests)}</tbody></table><p><button onclick="window.print()">Print / Save as PDF</button></p></body></html>`);
  popup.document.close();
  return true;
};

const RequestsPage = ({ status = "all" }) => {
  const navigate = useNavigate();
  const config = pageConfig[status] || pageConfig.all;
  const [requests, setRequests] = useState([]);
  const [kpis, setKpis] = useState({});
  const [filterOptions, setFilterOptions] = useState({ types: [], responsibles: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: "", period: "all", type: "", responsible: "", stage: "basic", status: status === "all" ? "" : status, sortBy: status === "approved" ? "approvedAt" : "submittedAt", sortOrder: "desc" });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

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
    const result = await Swal.fire({ title: "Reopen this request?", text: "It will return to Pending Requests. Its history will be preserved.", icon: "warning", showCancelButton: true, confirmButtonText: "Reopen request", confirmButtonColor: "#00489d" });
    if (result.isConfirmed) mutate(request, reopenRequest, "Request 1 reopened");
  };

  const confirmProfileReopen = async (request) => {
    const result = await Swal.fire({ title: "Reopen Request 2?", text: "The profile and documents will return to pending review. Its history will be preserved.", icon: "warning", showCancelButton: true, confirmButtonText: "Reopen Request 2", confirmButtonColor: "#00489d" });
    if (result.isConfirmed) mutate(request, reopenProfileRequest, "Request 2 reopened");
  };

  const showDetails = (request) => navigate(`/requests/${getId(request)}`);

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

  const totalPages = Math.max(1, pagination.totalPages || Math.ceil(pagination.total / pagination.limit));
  const first = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  return <main className="app-content requests-page">
    <header className="app-title tile p-3 requests-heading"><div><h1>{config.title}</h1><p>{config.description}</p></div>
      <div className="requests-export" aria-label="Export current page"><button className="btn btn-outline-primary" type="button" title="Export the displayed page" disabled={!requests.length} onClick={exportCsv}>Export CSV</button><button className="btn btn-primary" type="button" title="Print or save the displayed page as PDF" disabled={!requests.length} onClick={() => openPrintView(requests, config.title)}>Print / PDF</button></div>
    </header>

    {status === "approved" && <section className="requests-kpis" aria-label="Approved request metrics">
      {[['Total approved', kpis.totalApproved ?? pagination.total, 'fa-check-circle'], ['Approved today', kpis.approvedToday ?? 0, 'fa-calendar-check'], ['Completed', kpis.completed ?? kpis.totalCompleted ?? 0, 'fa-flag-checkered'], ['Average approval time', kpis.averageApprovalTimeFormatted ?? kpis.averageApprovalTime ?? formatDuration(kpis.averageApprovalTimeMs), 'fa-clock']].map(([label, value, icon]) => <article className="tile request-kpi" key={label}><i className={`fa ${icon}`} aria-hidden="true"/><div><span>{label}</span><strong>{value}</strong></div></article>)}
    </section>}

    <section className="tile p-3 requests-panel" aria-labelledby="request-filters-title"><h2 className="sr-only" id="request-filters-title">Request filters</h2>
      <div className="requests-filters">
        <label className="requests-search"><span>Search by ID or name</span><input className="form-control" type="search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Request ID or requester name"/></label>
        <label><span>Period</span><select className="form-control" value={filters.period} onChange={(event) => updateFilter('period', event.target.value)}><option value="all">All time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label>
        <label><span>Type</span><select className="form-control" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}><option value="">All types</option>{(filterOptions.types || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Approval stage</span><select className="form-control" value={filters.stage} onChange={(event) => { const nextStage = event.target.value; setFilters((current) => ({ ...current, stage: nextStage, ...(status === "all" ? { status: "" } : {}) })); setPagination((current) => ({ ...current, page: 1 })); }}><option value="basic">Approval 1</option><option value="profile">Approval 2</option></select></label>
        {status === 'all' && <label><span>Status</span><select className="form-control" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{filters.stage === "profile" && <option value="not_submitted">Not submitted</option>}<option value="pending">Pending</option><option value="approved">Approved</option>{filters.stage === "basic" && <option value="completed">Completed</option>}<option value="rejected">Rejected</option></select></label>}
        <label><span>Responsible</span><select className="form-control" value={filters.responsible} onChange={(event) => updateFilter('responsible', event.target.value)}><option value="">All responsibles</option>{(filterOptions.responsibles || []).map((responsible) => <option key={responsible._id} value={responsible._id}>{responsible.fullName || responsible.email}</option>)}</select></label>
        <label><span>Sort by</span><select className="form-control" value={`${filters.sortBy}:${filters.sortOrder}`} onChange={(event) => { const [sortBy, sortOrder] = event.target.value.split(':'); setFilters((current) => ({ ...current, sortBy, sortOrder })); setPagination((current) => ({ ...current, page: 1 })); }}><option value="approvedAt:desc">Approval date - newest</option><option value="approvedAt:asc">Approval date - oldest</option><option value="submittedAt:desc">Submission date - newest</option><option value="submittedAt:asc">Submission date - oldest</option></select></label>
      </div>

      <div className="requests-state" aria-live="polite">
        {loading ? <div className="requests-loading"><div className="loader"/><span>Loading requests...</span></div> : error ? <div className="alert alert-danger" role="alert"><p>{error}</p><button className="btn btn-outline-danger btn-sm" type="button" onClick={() => loadRequests()}>Retry</button></div> : requests.length === 0 ? <div className="requests-empty"><i className="fa fa-inbox" aria-hidden="true"/><h3>No requests found</h3><p>Try changing the search or filters.</p></div> : <div className="table-responsive"><table className="table table-bordered table-hover requests-table"><caption className="sr-only">{config.title}. Approval 1 and Approval 2 are reviewed independently.</caption><thead><tr><th scope="col">Request ID</th><th scope="col">Type</th><th scope="col">Requester</th><th scope="col">Submitted</th><th scope="col">Approval 1</th><th scope="col">Approval 2</th><th scope="col">Overall</th><th scope="col">Actions</th></tr></thead><tbody>
          {requests.map((request) => { const id = getId(request); const basic = stageStatus(request, "basic"); const profile = stageStatus(request, "profile"); const activeStageStatus = filters.stage === "profile" ? profile : basic; return <tr key={id}><td data-label="Request ID"><strong>{id}</strong></td><td data-label="Type">{request.type || request.requestType || 'Driver verification'}</td><td data-label="Requester">{getName(request)}</td><td data-label="Submitted">{formatDate(request.submittedAt || request.basicRequestSubmittedAt || request.createdAt)}</td><td data-label="Approval 1">{statusBadge(basic)}</td><td data-label="Approval 2">{statusBadge(profile)}</td><td data-label="Overall">{statusBadge(overallStatus(request))}</td><td data-label="Actions"><div className="requests-actions"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => showDetails(request)}>Review approvals</button>{filters.stage === "basic" && activeStageStatus === 'pending' && <button type="button" className="btn btn-sm btn-success" disabled={busyId === id} onClick={() => mutate(request, approveRequest, "Request 1 approved")}>Approve Request 1</button>}{filters.stage === "basic" && activeStageStatus === 'approved' && <button type="button" className="btn btn-sm btn-warning" disabled={busyId === id} onClick={() => confirmReopen(request)}>Reopen Request 1</button>}{filters.stage === "profile" && activeStageStatus === 'pending' && <button type="button" className="btn btn-sm btn-success" disabled={busyId === id} onClick={() => mutate(request, approveProfileRequest, "Request 2 approved")}>Approve Request 2</button>}{filters.stage === "profile" && activeStageStatus === 'approved' && <button type="button" className="btn btn-sm btn-warning" disabled={busyId === id} onClick={() => confirmProfileReopen(request)}>Reopen Request 2</button>}</div></td></tr>; })}
        </tbody></table></div>}
      </div>

      {!loading && !error && pagination.total > 0 && <nav className="requests-pagination" aria-label="Requests pagination"><div><label>Rows <select value={pagination.limit} onChange={(event) => setPagination((current) => ({ ...current, page: 1, limit: Number(event.target.value) }))}>{PAGE_SIZE_OPTIONS.map((size) => <option key={size}>{size}</option>)}</select></label><span>Showing {first}-{last} of {pagination.total}</span></div><div><button type="button" className="btn btn-light" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {pagination.page} of {totalPages}</span><button type="button" className="btn btn-light" disabled={pagination.page >= totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></nav>}
    </section>
  </main>;
};

RequestsPage.propTypes = { status: PropTypes.oneOf(["pending", "approved", "rejected", "all"]) };
export default RequestsPage;
