import { useCallback, useEffect, useState } from "react";
import { getCalls } from "../utils/callsApi";
import "../assets/css/requests.css";

const PAGE_SIZES = [10, 25, 50];
const STATUSES = [
  "initiating", "ringing", "accepted", "connected", "declined",
  "missed", "cancelled", "ended", "failed",
];

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDuration = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "N/A";
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
};

const statusClass = (status) => ({
  connected: "badge-primary", ended: "badge-success", accepted: "badge-primary",
  ringing: "badge-warning", initiating: "badge-warning", declined: "badge-danger",
  missed: "badge-danger", failed: "badge-danger", cancelled: "badge-secondary",
}[status] || "badge-secondary");

const participantName = (participant) => participant?.displayName || "Drewel participant";

const Calls = () => {
  const [calls, setCalls] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: "", status: "", reported: "" });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const loadCalls = useCallback(async (signal) => {
    if (debouncedSearch && !OBJECT_ID_PATTERN.test(debouncedSearch)) {
      setLoading(false);
      setError("Enter a complete 24-character call or ride ID.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const payload = await getCalls({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch || undefined,
        status: filters.status || undefined,
        reported: filters.reported || undefined,
      }, signal);
      const items = Array.isArray(payload?.calls) ? payload.calls : [];
      const page = payload?.pagination || {};
      setCalls(items);
      setPagination((current) => ({
        ...current,
        page: Number(page.page || current.page),
        limit: Number(page.limit || current.limit),
        total: Number(page.total ?? items.length),
        totalPages: Number(page.totalPages || 1),
      }));
    } catch (requestError) {
      if (requestError?.code !== "ERR_CANCELED") {
        setError(requestError?.response?.data?.message || "Unable to load call activity.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [debouncedSearch, filters.reported, filters.status, pagination.limit, pagination.page]);

  useEffect(() => {
    const controller = new AbortController();
    loadCalls(controller.signal);
    return () => controller.abort();
  }, [loadCalls]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const totalPages = Math.max(1, pagination.totalPages);
  const first = pagination.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const last = Math.min(pagination.page * pagination.limit, pagination.total);

  return <main className="app-content requests-page">
    <header className="app-title tile p-3 requests-heading">
      <div><h1>Secure Calls</h1><p>Metadata for Drewel ride calls. Audio is never recorded or available here.</p></div>
    </header>
    <section className="tile p-3 requests-panel" aria-labelledby="call-filters-title">
      <h2 className="sr-only" id="call-filters-title">Call filters</h2>
      <div className="requests-filters">
        <label className="requests-search"><span>Search by call or ride ID</span><input className="form-control" type="search" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Call ID or ride ID" /></label>
        <label><span>Status</span><select className="form-control" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
        <label><span>Reported</span><select className="form-control" value={filters.reported} onChange={(event) => updateFilter("reported", event.target.value)}><option value="">All calls</option><option value="true">Reported</option><option value="false">Not reported</option></select></label>
      </div>
      <div className="requests-state" aria-live="polite">
        {loading ? <div className="requests-loading"><div className="loader"/><span>Loading calls...</span></div>
          : error ? <div className="alert alert-danger" role="alert"><p>{error}</p><button className="btn btn-outline-danger btn-sm" type="button" onClick={() => loadCalls()}>Retry</button></div>
            : calls.length === 0 ? <div className="requests-empty"><i className="fa fa-phone-slash" aria-hidden="true"/><h3>No calls found</h3><p>Try changing the search or filters.</p></div>
              : <div className="table-responsive"><table className="table table-bordered table-hover requests-table"><caption className="sr-only">Secure call metadata. No audio or personal phone numbers are shown.</caption><thead><tr><th>Call ID</th><th>Ride ID</th><th>Caller</th><th>Receiver</th><th>Status</th><th>Started</th><th>Duration</th><th>End reason</th><th>Reported</th></tr></thead><tbody>{calls.map((call) => <tr key={call.callId}><td data-label="Call ID"><strong>{call.callId}</strong></td><td data-label="Ride ID">{call.rideId}</td><td data-label="Caller">{participantName(call.caller)} <small>({call.caller?.role || "unknown"})</small></td><td data-label="Receiver">{participantName(call.receiver)} <small>({call.receiver?.role || "unknown"})</small></td><td data-label="Status"><span className={`badge ${statusClass(call.status)}`}>{String(call.status || "unknown").toUpperCase()}</span></td><td data-label="Started">{formatDate(call.startedAt)}</td><td data-label="Duration">{formatDuration(call.durationSeconds)}</td><td data-label="End reason">{call.endReason || "N/A"}</td><td data-label="Reported">{call.reported ? "Yes" : "No"}</td></tr>)}</tbody></table></div>}
      </div>
      {!loading && !error && pagination.total > 0 && <nav className="requests-pagination" aria-label="Calls pagination"><div><label>Rows <select value={pagination.limit} onChange={(event) => setPagination((current) => ({ ...current, page: 1, limit: Number(event.target.value) }))}>{PAGE_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label><span>Showing {first}-{last} of {pagination.total}</span></div><div><button type="button" className="btn btn-light" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {pagination.page} of {totalPages}</span><button type="button" className="btn btn-light" disabled={pagination.page >= totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></nav>}
    </section>
  </main>;
};

export default Calls;
