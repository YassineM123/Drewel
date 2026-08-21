import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, MessageSquare, Shield, ShieldAlert, AlertTriangle,
  ExternalLink, Eye, Clock, CheckCheck, Send, StickyNote, Mic,
} from "lucide-react";
import {
  addConversationNote,
  chatErrorMessage,
  getChatMetadata,
  getChatThreads,
  getConversationMessages,
} from "../api/domains/chat";

const fmtRelative = (iso) => {
  if (!iso) return "N/A";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDuration = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function StatusBadge({ status }) {
  const map = {
    active: { label: "Active", cls: "bg-green-50 text-green-700 border-green-200" },
    completed: { label: "Completed", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const s = map[status] || map.active;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-[12px] shadow-xl text-sm font-semibold
      ${type === "success" ? "bg-green-600 text-white" : type === "error" ? "bg-red-600 text-white" : "bg-slate-800 text-white"}`}>
      {message}
    </div>
  );
}

function Drawer({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="drawer-enter relative bg-white w-[640px] max-w-[calc(100vw-2rem)] h-full shadow-2xl flex flex-col">
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors z-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
}

function ThreadDetail({ thread, onToast }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    setNote("");
    getConversationMessages(thread.id, { page: 1, limit: 100 })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(chatErrorMessage(err, "Unable to load conversation messages.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [thread.id]);

  const saveNote = async () => {
    if (!note.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      const result = await addConversationNote(thread.id, note.trim());
      setData((prev) => ({ ...prev, conversation: { ...prev.conversation, adminNote: result.conversation.adminNote } }));
      setNote("");
      onToast("Internal note saved and audited.");
    } catch (err) {
      onToast(chatErrorMessage(err, "Unable to save note."), "error");
    } finally {
      setNoteSaving(false);
    }
  };

  const conversation = data?.conversation || {};
  const messages = data?.messages || [];
  const supports = data?.supports || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 truncate">
                {conversation.rideReference || "Conversation"}
              </h2>
              <StatusBadge status={conversation.status || thread.status} />
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1">{thread.id}</p>
          </div>
          {thread.rideId && (
            <button type="button" onClick={() => navigate(`/rides/${thread.rideId}`)}
              className="h-8 shrink-0 inline-flex items-center gap-1.5 px-3 rounded-[9px] border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all">
              <ExternalLink size={12} /> Ride
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-[12px] border border-slate-200 bg-slate-50/50 p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Passenger</p>
            <p className="text-sm font-semibold text-slate-800">{conversation.passenger?.fullName || "Passenger"}</p>
          </div>
          <div className="rounded-[12px] border border-slate-200 bg-slate-50/50 p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Driver</p>
            <p className="text-sm font-semibold text-slate-800">{conversation.driver?.fullName || "Driver"}</p>
            {(conversation.driver?.vehicleType || conversation.driver?.vehicleModel) && (
              <p className="text-xs text-slate-500 mt-0.5">
                {[conversation.driver?.vehicleType, conversation.driver?.vehicleModel].filter(Boolean).join(" · ") || "—"}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#BE1B2C]/30 border-t-[#BE1B2C] rounded-full animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3" role="alert">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
              <button type="button" onClick={() => window.location.reload()}
                className="text-xs font-semibold text-red-700 hover:text-red-900 mt-1">Retry</button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={14} className="text-slate-400" />
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Messages ({messages.length})</h4>
              </div>
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 border border-slate-100 rounded-[12px] p-4 text-center">
                  No messages recorded for this conversation.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {messages.map((message) => (
                    <div key={message.id} className="rounded-[12px] border border-slate-100 bg-white p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                          ${message.senderRole === "driver" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>
                          {message.senderRole === "driver" ? "Driver" : "Passenger"}
                        </span>
                        <span className="text-[10px] text-slate-400">{fmtTime(message.createdAt)}</span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400">
                          {message.status === "read" ? <CheckCheck size={11} className="text-sky-500" /> : <Clock size={11} />}
                          {message.status}
                        </span>
                      </div>
                      {message.messageType === "voice" ? (
                        <p className="text-sm text-slate-700 inline-flex items-center gap-1.5">
                          <Mic size={14} className="text-[#BE1B2C]" />
                          <span className="font-medium">Voice message</span>
                          {message.audioDuration != null && (
                            <span className="text-xs text-slate-400 font-mono">
                              {fmtDuration(message.audioDuration)}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{message.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {supports.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldAlert size={14} className="text-amber-500" />
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Support reports</h4>
                </div>
                <div className="flex flex-col gap-2">
                  {supports.map((report) => (
                    <div key={report.id} className="rounded-[12px] border border-amber-200 bg-amber-50/50 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          {report.category}
                        </span>
                        <span className="text-[10px] text-amber-700 capitalize">{report.status}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{fmtRelative(report.createdAt)}</span>
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2">{report.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <StickyNote size={14} className="text-slate-400" />
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Internal admin note</h4>
              </div>
              {(conversation.adminNote || "") && (
                <div className="bg-slate-50 border border-slate-200 rounded-[12px] p-3 mb-2">
                  <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">{conversation.adminNote}</p>
                </div>
              )}
              <div className="flex gap-2">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                  placeholder="Add an internal note for the operations team (never sent to participants)…"
                  className="flex-1 bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
                <button type="button" onClick={saveNote} disabled={!note.trim() || noteSaving}
                  className="h-9 self-end inline-flex items-center gap-1.5 px-3.5 rounded-[10px] bg-[#BE1B2C] text-xs font-semibold text-white hover:bg-[#A31725] disabled:opacity-50 transition-all">
                  {noteSaving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={12} />}
                  Save
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminChat() {
  const navigate = useNavigate();
  const [metadata, setMetadata] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [reportedOnly, setReportedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const searchTimer = useRef(null);

  const fetchMetadata = useCallback(async () => {
    try {
      setMetadata(await getChatMetadata());
    } catch {
      // Metadata is non-critical; the list still renders.
    }
  }, []);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getChatThreads({
        q: search,
        status: status === "all" ? undefined : status,
        unread: unreadOnly ? "true" : undefined,
        reported: reportedOnly ? "true" : undefined,
        page,
        limit: 25,
      });
      setThreads(result.threads || []);
      setPagination(result.pagination || { page, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      setThreads([]);
      setError(chatErrorMessage(err, "Unable to load conversations."));
    } finally {
      setLoading(false);
    }
  }, [search, status, unreadOnly, reportedOnly, page]);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);
  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const totalPages = pagination.totalPages;

  const kpis = [
    { label: "Total conversations", value: metadata?.totalConversations ?? "—", icon: MessageSquare },
    { label: "Active", value: metadata?.activeConversations ?? "—", icon: Shield },
    { label: "Messages", value: metadata?.totalMessages ?? "—", icon: Send },
    { label: "Unread", value: metadata?.unreadMessages ?? "—", icon: Eye },
    { label: "Today", value: metadata?.messagesToday ?? "—", icon: Clock },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">Chat Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            In-app ride conversations. Chat stays inside Drewel — no public phone numbers or external contacts.
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
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ride reference, names or message…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex items-center gap-3 pb-1">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="w-3.5 h-3.5 accent-[#BE1B2C]" />
            Unread only
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={reportedOnly} onChange={(e) => { setReportedOnly(e.target.checked); setPage(1); }}
              className="w-3.5 h-3.5 accent-[#BE1B2C]" />
            Reported only
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3" role="alert">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={fetchThreads} className="text-xs font-semibold text-red-700 hover:text-red-900 mt-1">Retry</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Ride</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Passenger</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Driver</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Last message</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Unread</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Flags</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}>
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-[#BE1B2C]/30 border-t-[#BE1B2C] rounded-full animate-spin" />
                  </div>
                </td></tr>
              ) : threads.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <MessageSquare size={24} className="text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No conversations match your filters</p>
                    <p className="text-xs text-slate-400">Try adjusting the search, status or unread filter.</p>
                  </div>
                </td></tr>
              ) : threads.map((thread) => (
                <tr key={thread.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => setSelected(thread)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/rides/${thread.rideId}`); }}
                        className="w-8 h-8 rounded-[9px] bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                        aria-label="Open ride">
                        <ExternalLink size={13} />
                      </button>
                      <span className="font-mono text-xs font-semibold text-slate-700">{thread.rideReference || "—"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-800">{thread.passenger?.fullName || "Passenger"}</p>
                    <p className="text-[10px] font-mono text-slate-400">{thread.passenger?.id?.slice(-8) || ""}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-800">{thread.driver?.fullName || "Driver"}</p>
                    <p className="text-[10px] text-slate-400">
                      {[thread.driver?.vehicleType, thread.driver?.vehicleModel].filter(Boolean).join(" · ") || ""}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs text-slate-600 max-w-[220px] truncate">
                      <span className="text-slate-400">{thread.lastMessageSenderRole ? `${thread.lastMessageSenderRole}: ` : ""}</span>
                      {thread.lastMessagePreview || "No messages"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtRelative(thread.lastMessageAt)}</p>
                  </td>
                  <td className="px-5 py-3">
                    {(thread.passengerUnreadCount || thread.driverUnreadCount) > 0 ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        {thread.passengerUnreadCount + thread.driverUnreadCount} unread
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={thread.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {thread.reportedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <ShieldAlert size={10} /> Reported
                        </span>
                      )}
                      {thread.adminNote && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                          <StickyNote size={10} /> Note
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelected(thread); }}
                      className="h-7 inline-flex items-center gap-1.5 px-2.5 rounded-[8px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-all">
                      <Eye size={11} /> Inspect
                    </button>
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

      <Drawer open={!!selected} onClose={() => setSelected(null)}>
        {selected && <ThreadDetail thread={selected}
          onToast={(msg, type = "success") => { setToast({ message: msg, type }); }} />}
      </Drawer>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}