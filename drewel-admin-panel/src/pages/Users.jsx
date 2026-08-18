import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Shield, ShieldOff, AlertTriangle, Eye, EyeOff,
  MessageSquare, Clock, ExternalLink, FileText,
} from "lucide-react";
import { getUserList } from "../utils/api";
import { toggleUserRestriction } from "../api/domains/users";

function maskPhone(p) { return p && p.length > 7 ? p.slice(0, 4) + "***" + p.slice(-3) : p || "N/A"; }
function maskEmail(e) { if (!e) return "N/A"; const [u, d] = e.split("@"); return (u?.slice(0, 2) || "") + "***@" + (d || ""); }
function fmtRelative(iso) {
  if (!iso) return "N/A";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDate(iso) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
const userName = (u) => u.fullName || u.name || "N/A";
const userInitials = (u) => {
  const name = userName(u);
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase()).slice(0, 2).join("") || "?";
};

function Badge({ variant, dot }) {
  const map = {
    approved: { label: "Approved", cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
    restricted: { label: "Restricted", cls: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
    active: { label: "Active", cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  };
  const s = map[variant] || map.active;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />}
      {s.label}
    </span>
  );
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-[12px] shadow-xl text-sm font-semibold transition-all fade-in-up
      ${type === "success" ? "bg-green-600 text-white" : type === "error" ? "bg-red-600 text-white" : "bg-slate-800 text-white"}`}>
      {message}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
        <FileText size={22} className="text-slate-300" />
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400">{description}</p>}
    </div>
  );
}

function ActionModal({ title, consequence, variant, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-100"><h3 className="text-base font-bold text-slate-900">{title}</h3></div>
        <div className="p-6 flex flex-col gap-4">
          <div className={`rounded-[10px] p-3.5 text-sm border ${variant === "danger" ? "bg-red-50 text-red-800 border-red-200" : "bg-sky-50 text-sky-800 border-blue-200"}`}>
            {consequence}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Reason <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Provide a reason for this action…"
              className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button type="button" disabled={!reason.trim() || loading}
            onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); onConfirm(reason); }, 900); }}
            className={`h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] text-xs font-semibold text-white transition-all disabled:opacity-50
              ${variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-[#BE1B2C] hover:bg-[#A31725]"}`}>
            {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, width = "w-[580px]", children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`drawer-enter relative bg-white ${width} max-w-[calc(100vw-2rem)] h-full shadow-2xl flex flex-col`}>
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors z-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-medium text-slate-700">{value}</span>
    </div>
  );
}

function UserDetailDrawer({ user, onToast }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [revealed, setRevealed] = useState(false);
  const [modal, setModal] = useState(null);

  const isRestricted = !user.isActive;
  const rideSummary = user.rideSummary || {};
  const supportSummary = user.supportSummary || {};

  const handleAction = async (action) => {
    setModal(null);
    try {
      await toggleUserRestriction(user._id);
      onToast(action === "restrict"
        ? `${userName(user)}'s account has been restricted.`
        : `${userName(user)}'s account has been restored.`);
    } catch {
      onToast("Failed to update user status.");
    }
  };

  const UTABS = [
    { id: "overview", label: "Overview" },
    { id: "ride_history", label: "Ride History" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-base font-bold text-[#BE1B2C]">
            {userInitials(user)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">{userName(user)}</h2>
            <p className="text-xs font-mono text-slate-400">{user._id}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge variant={isRestricted ? "restricted" : "active"} dot />
              {user.supportSummary?.disputed > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle size={9} /> {user.supportSummary.disputed} report{user.supportSummary.disputed > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-0 overflow-x-auto border-b border-slate-200 shrink-0 px-1">
        {UTABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all
              ${tab === t.id ? "border-[#BE1B2C] text-[#BE1B2C]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {tab === "overview" && (
          <>
            {isRestricted && user.restrictedReason && (
              <div className="bg-red-50 border border-red-200 rounded-[12px] p-3.5">
                <p className="text-xs font-bold text-red-800 mb-1">Account Restricted</p>
                <p className="text-xs text-red-700">{user.restrictedReason}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Rides", value: Number(rideSummary.completed || 0) + Number(rideSummary.cancelled || 0), cls: "text-slate-800" },
                { label: "Completed", value: rideSummary.completed || 0, cls: "text-green-700" },
                { label: "Cancelled", value: rideSummary.cancelled || 0, cls: Number(rideSummary.cancelled || 0) > 5 ? "text-red-600" : "text-slate-800" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 rounded-[12px] p-3 text-center border border-slate-100">
                  <div className={`text-xl font-black tabular-nums ${s.cls}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[14px] border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</h4>
                <button onClick={() => setRevealed(!revealed)}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                  {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
                  {revealed ? "Mask" : "Reveal"}
                </button>
              </div>
              <StatRow label="Phone" value={<span className="font-mono text-xs">{revealed ? user.phone : maskPhone(user.phone)}</span>} />
              <StatRow label="Email" value={<span className="font-mono text-xs">{revealed ? user.email : maskEmail(user.email)}</span>} />
              <StatRow label="Account created" value={fmtDate(user.createdAt)} />
              <StatRow label="Last activity" value={user.lastActivityAt ? fmtRelative(user.lastActivityAt) : "N/A"} />
              <StatRow label="Reports filed" value={
                <span className={supportSummary.messagesSent > 0 ? "text-amber-600 font-semibold" : "text-slate-700"}>{supportSummary.messagesSent || 0}</span>
              } />
            </div>

            {rideSummary.activeRide && (
              <div className="bg-sky-50 border border-sky-200 rounded-[12px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-sky-800">Active Ride</p>
                  <button type="button" onClick={() => navigate(`/rides/live`)}
                    className="h-7 inline-flex items-center gap-1 px-2.5 rounded-[8px] border border-sky-200 bg-white text-[10px] font-semibold text-sky-700 hover:bg-sky-100 transition-all">
                    <ExternalLink size={10} /> View
                  </button>
                </div>
                <p className="font-mono text-sm font-bold text-sky-700">{rideSummary.activeRide.reference || "Active"}</p>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Admin Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                {isRestricted ? (
                  <button type="button" onClick={() => setModal("restore")}
                    className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                    <ShieldOff size={13} /> Restore Account
                  </button>
                ) : (
                  <button type="button" onClick={() => setModal("restrict")}
                    className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-all">
                    <Shield size={13} /> Restrict Account
                  </button>
                )}
                <button type="button" onClick={() => navigate(`/chat?user=${user._id}`)}
                  className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                  <MessageSquare size={13} /> Contact User
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "ride_history" && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Clock size={24} className="text-slate-300" />
            <p className="text-sm text-slate-500">View full ride history on the user detail page.</p>
            <button type="button" onClick={() => navigate(`/users/${user._id}`)}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
              <ExternalLink size={13} /> Open Detail Page
            </button>
          </div>
        )}
      </div>

      {modal === "restrict" && (
        <ActionModal title="Restrict User Account" consequence="User will be prevented from booking rides immediately. They will receive a notification. This action is reversible and logged." variant="danger" onConfirm={() => handleAction("restrict")} onClose={() => setModal(null)} />
      )}
      {modal === "restore" && (
        <ActionModal title="Restore User Account" consequence="User's ability to book rides will be restored. They will be notified. This action is logged." variant="primary" onConfirm={() => handleAction("restore")} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const itemsPerPage = 10;
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getUserList({
        search,
        status: statusFilter,
        page: page + 1,
        limit: itemsPerPage,
        sort: "updatedAt",
        dir: "desc",
      });
      setUsers(res.users || []);
      setPagination(res.pagination || { page: page + 1, limit: itemsPerPage, total: 0, totalPages: 1 });
    } catch {
      setUsers([]);
      setError("Failed to fetch user data.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const totalPages = pagination.totalPages;
  const activeCount = users.filter((u) => u.isActive !== false).length;
  const restrictedCount = users.filter((u) => u.isActive === false).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage passenger accounts, view activity and handle restrictions.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-medium">{activeCount} active</span>
          <span className="text-xs text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full font-medium">{restrictedCount} restricted</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone or user ID…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status filter</span>
          <select aria-label="User status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="restricted">Restricted</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={fetchUsers} className="text-xs font-semibold text-red-700 hover:text-red-900 mt-1">Retry</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[14px] border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">User</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Phone</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Rides</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Active Ride</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Support</th>
                <th className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">Last Activity</th>
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
              ) : users.length === 0 ? (
                <tr><td colSpan={8}><EmptyState title="No users match your filters" description="Try adjusting the search or status filter." /></td></tr>
              ) : users.map((user) => (
                <tr key={user._id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedUser(user)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-[11px] font-bold text-[#BE1B2C] shrink-0">
                        {userInitials(user)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{userName(user)}</p>
                        <p className="text-xs text-slate-400">{user._id?.slice(-8) || ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="font-mono text-xs text-slate-600">{maskPhone(user.phone)}</span></td>
                  <td className="px-5 py-3">
                    <Badge variant={user.isActive === false ? "restricted" : "active"} dot />
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm tabular-nums text-slate-700">{Number(user.rideSummary?.completed || 0).toLocaleString()} completed</span>
                    <span className="text-xs text-slate-400 ml-1.5">{Number(user.rideSummary?.cancelled || 0)} cancelled</span>
                  </td>
                  <td className="px-5 py-3">
                    {user.rideSummary?.activeRide ? (
                      <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        {user.rideSummary.activeRide.reference || "Active"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {Number(user.supportSummary?.messagesSent || 0) > 0 ? (
                      <span className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                        {user.supportSummary.messagesSent} {user.supportSummary.messagesSent === 1 ? "message" : "messages"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-5 py-3"><span className="text-xs text-slate-500">{user.lastActivityAt ? fmtRelative(user.lastActivityAt) : "N/A"}</span></td>
                  <td className="px-5 py-3">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }}
                      className="h-7 inline-flex items-center gap-1.5 px-2.5 rounded-[8px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-all">
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-400">
              Showing {pagination.total === 0 ? 0 : page * itemsPerPage + 1} to {Math.min((page + 1) * itemsPerPage, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(0)} disabled={page === 0}
                className="h-7 px-2 rounded-[6px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">&laquo;</button>
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="h-7 px-2 rounded-[6px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">&lsaquo;</button>
              {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => {
                let start = Math.max(0, page - Math.floor(4 / 2));
                if (start + 4 > totalPages) start = Math.max(0, totalPages - 4);
                const idx = start + i;
                if (idx >= totalPages) return null;
                return (
                  <button key={idx} type="button" onClick={() => setPage(idx)}
                    className={`h-7 min-w-[28px] px-2 rounded-[6px] text-[10px] font-semibold transition-all
                      ${idx === page ? "bg-[#BE1B2C] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {idx + 1}
                  </button>
                );
              })}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="h-7 px-2 rounded-[6px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">&rsaquo;</button>
              <button type="button" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                className="h-7 px-2 rounded-[6px] border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">&raquo;</button>
            </div>
          </div>
        )}
      </div>

      <Drawer open={!!selectedUser} onClose={() => setSelectedUser(null)} width="w-[580px]">
        {selectedUser && <UserDetailDrawer key={selectedUser._id} user={selectedUser} onClose={() => setSelectedUser(null)} onToast={(msg) => { setToast(msg); setSelectedUser(null); fetchUsers(); }} />}
      </Drawer>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}
