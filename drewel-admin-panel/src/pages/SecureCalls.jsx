import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, PhoneMissed, PhoneOff, Clock, Shield, ShieldCheck,
  AlertTriangle, ExternalLink, Search,
} from "lucide-react";
import { getSecureCalls, secureCallsErrorMessage } from "../api/domains/secureCalls";

const fmtTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDuration = (sec) => {
  const value = Number(sec) || 0;
  if (value <= 0) return "—";
  const m = Math.floor(value / 60);
  const s = value % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

function StatusBadge({ status }) {
  const map = {
    planned: { label: "Planned", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    ringing: { label: "Ringing", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    in_call: { label: "In call", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    completed: { label: "Completed", cls: "bg-green-50 text-green-700 border-green-200" },
    missed: { label: "Missed", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    failed: { label: "Failed", cls: "bg-red-50 text-red-700 border-red-200" },
    cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  };
  const s = map[status] || map.planned;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function SecureCalls() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rideId, setRideId] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getSecureCalls({
        page,
        limit: 25,
        rideId: rideId.trim() || undefined,
        status: status === "all" ? undefined : status,
        from: from || undefined,
        to: to || undefined,
      });
      setEvents(result.events);
      setSummary(result.summary || {});
      setPagination(result.pagination || { page, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      setEvents([]);
      setError(secureCallsErrorMessage(err, "Unable to load secure-call metadata."));
    } finally {
      setLoading(false);
    }
  }, [page, rideId, status, from, to]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);
  useEffect(() => { setPage(1); }, [rideId, status, from, to]);

  const totalPages = pagination.totalPages;

  const kpis = [
    { label: "Total calls", value: summary.total ?? pagination.total, icon: Phone },
    { label: "Completed", value: summary.completed ?? 0, icon: ShieldCheck },
    { label: "Failed", value: summary.failed ?? 0, icon: PhoneOff },
    { label: "Missed", value: summary.missed ?? 0, icon: PhoneMissed },
    { label: "Total talk time", value: fmtDuration(summary.totalDurationSec), icon: Clock },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">Secure Calls</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Call metadata only. Recordings are never surfaced unless explicitly and legally enabled.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-[14px] border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={14} className="text-[#BE1B2C]" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-xl font-black tabular-nums text-slate-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Ride ID</span>
          <input value={rideId} onChange={(e) => setRideId(e.target.value)}
            placeholder="Ride reference / ID"
            className="h-10 w-56 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all">
            <option value="all">All statuses</option>
            <option value="planned">Planned</option>
            <option value="ringing">Ringing</option>
            <option value="in_call">In call</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <div className="pb-1">
          <button type="button" onClick={() => { setPage(1); fetchCalls(); }}
            className="h-10 inline-flex items-center gap-2 px-4 rounded-[10px] bg-[#BE1B2C] text-xs font-semibold text-white hover:bg-[#A31725] transition-all">
            <Search size={13} /> Filter
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3" role="alert">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={fetchCalls} className="text-xs font-semibold text-red-700 hover:text-red-900 mt-1">Retry</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Call</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Ride</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Participants</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Started</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Ended</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Duration</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Failure reason</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Provider ref</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Recording</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10}>
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-[#BE1B2C]/30 border-t-[#BE1B2C] rounded-full animate-spin" />
                  </div>
                </td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <Phone size={24} className="text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No call metadata matches your filters</p>
                    <p className="text-xs text-slate-400">Adjust the ride ID, status or date range.</p>
                  </div>
                </td></tr>
              ) : events.map((event) => (
                <tr key={event.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-mono text-xs font-semibold text-slate-700">{event.callId}</p>
                    <p className="text-[10px] font-mono text-slate-400">{event.id}</p>
                  </td>
                  <td className="px-5 py-3">
                    {event.rideId ? (
                      <button type="button" onClick={() => navigate(`/rides/${event.rideId}`)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-[#BE1B2C] transition-colors">
                        <ExternalLink size={11} /> Ride
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-slate-700">
                        {event.participants?.passenger?.name || "Passenger"}
                      </span>
                      <span className="text-xs text-slate-700">
                        {event.participants?.driver?.name || "Driver"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="text-xs text-slate-600">{fmtTime(event.startedAt)}</span></td>
                  <td className="px-5 py-3"><span className="text-xs text-slate-600">{fmtTime(event.endedAt)}</span></td>
                  <td className="px-5 py-3"><span className="text-sm tabular-nums text-slate-700">{fmtDuration(event.durationSec)}</span></td>
                  <td className="px-5 py-3"><StatusBadge status={event.status} /></td>
                  <td className="px-5 py-3">
                    {event.failureReason ? (
                      <span className="text-xs text-red-700">{event.failureReason}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {event.providerReference ? (
                      <span className="font-mono text-xs text-slate-600">{event.providerReference}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {event.recordingEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        <ShieldCheck size={10} /> Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                        <Shield size={10} /> Unavailable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              Showing {pagination.total === 0 ? 0 : (page - 1) * pagination.limit + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="h-7 px-2 rounded-[6px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">&lsaquo;</button>
              {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => {
                let start = Math.max(1, page - Math.floor(4 / 2));
                if (start + 4 - 1 > totalPages) start = Math.max(1, totalPages - 3);
                const idx = start + i;
                if (idx > totalPages) return null;
                return (
                  <button key={idx} type="button" onClick={() => setPage(idx)}
                    className={`h-7 min-w-[28px] px-2 rounded-[6px] text-[10px] font-semibold transition-all
                      ${idx === page ? "bg-[#BE1B2C] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {idx}
                  </button>
                );
              })}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="h-7 px-2 rounded-[6px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">&rsaquo;</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}