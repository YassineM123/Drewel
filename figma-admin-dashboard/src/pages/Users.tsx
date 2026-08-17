import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Shield, ShieldOff, AlertTriangle, Eye, EyeOff,
  MessageSquare, Clock, CheckCircle, ExternalLink
} from "lucide-react";
import {
  Badge, Avatar, Button, Card, Drawer, StatRow, Toast,
  SectionHeader, EmptyState, Th, Td, Tr, Pagination
} from "../components/ui";
import { mockUsers } from "../data/mock";
import { mockRides, mockAuditLogs } from "../data/mockRides";
import { mockDisputes } from "../data/mockDisputes";
import { RideStatusBadge } from "./Dashboard";

// ─── Extended user data ───────────────────────────────────────────────────────

const USER_META: Record<string, {
  cancelledRides: number;
  completedRides: number;
  lastActivity: string;
  activeRideId?: string;
}> = {
  "USR-10021": { cancelledRides: 3,  completedRides: 84,  lastActivity: "2024-07-14T08:55:00Z" },
  "USR-10022": { cancelledRides: 12, completedRides: 131, lastActivity: "2024-07-10T19:30:00Z" },
  "USR-10023": { cancelledRides: 1,  completedRides: 28,  lastActivity: "2024-07-14T09:10:00Z" },
  "USR-10024": { cancelledRides: 5,  completedRides: 229, lastActivity: "2024-07-14T07:58:00Z" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(p: string) { return p.slice(0, 9) + " *** " + p.slice(-4); }
function maskEmail(e: string) { const [u, d] = e.split("@"); return u.slice(0, 2) + "***@" + d; }
function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Action modal ─────────────────────────────────────────────────────────────

function ActionModal({
  title, consequence, variant, onConfirm, onClose
}: {
  title: string; consequence: string; variant: "danger" | "primary";
  onConfirm: (reason: string) => void; onClose: () => void;
}) {
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
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Provide a reason for this action…"
              className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={variant} disabled={!reason.trim()} loading={loading}
            onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); onConfirm(reason); }, 900); }}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── User drawer tabs ─────────────────────────────────────────────────────────

type UTab = "overview" | "active_ride" | "ride_history" | "disputes" | "audit";

const UTABS: { id: UTab; label: string }[] = [
  { id: "overview",     label: "Overview" },
  { id: "active_ride",  label: "Active Ride" },
  { id: "ride_history", label: "Ride History" },
  { id: "disputes",     label: "Disputes" },
  { id: "audit",        label: "Audit Activity" },
];

function UserDetail({ user }: { user: typeof mockUsers[0] }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<UTab>("overview");
  const [revealed, setRevealed] = useState(false);
  const [modal, setModal] = useState<"restrict" | "restore" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const meta = USER_META[user.id] ?? { cancelledRides: 0, completedRides: user.totalRides, lastActivity: user.lastRide };
  const activeRide = mockRides.find(r => r.user.id === user.id && ["offer_sent","offer_accepted","driver_on_way","driver_arrived","pickup_confirmed","ride_started"].includes(r.status));
  const rideHistory = mockRides.filter(r => r.user.id === user.id || r.user.name === user.name).slice(0, 8);
  const userDisputes = mockDisputes.filter(d => d.user.id === user.id || d.user.name === user.name);
  const auditEntries = mockAuditLogs.filter(l => l.entityId === user.id || l.reason?.includes(user.name)).slice(0, 10);

  const handleAction = (action: "restrict" | "restore", _reason: string) => {
    setModal(null);
    setToast(action === "restrict"
      ? `${user.name}'s account has been restricted.`
      : `${user.name}'s account has been restored.`);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <Avatar initials={user.avatar} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">{user.name}</h2>
            <p className="text-xs font-mono text-slate-400">{user.id}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <Badge variant={user.restricted ? "restricted" : "active"} dot />
              {user.reports > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle size={9} /> {user.reports} report{user.reports > 1 ? "s" : ""}
                </span>
              )}
              {activeRide && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">
                  Active ride
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 overflow-x-auto border-b border-slate-200 shrink-0 px-1">
        {UTABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all
              ${tab === t.id ? "border-[#BE1B2C] text-[#BE1B2C]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
            {t.id === "disputes" && userDisputes.length > 0 && (
              <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">{userDisputes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <>
            {user.restricted && user.restrictedReason && (
              <div className="bg-red-50 border border-red-200 rounded-[12px] p-3.5">
                <p className="text-xs font-bold text-red-800 mb-1">Account Restricted</p>
                <p className="text-xs text-red-700">{user.restrictedReason}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Rides",  value: user.totalRides,           cls: "text-slate-800" },
                { label: "Completed",    value: meta.completedRides,       cls: "text-green-700" },
                { label: "Cancelled",    value: meta.cancelledRides,       cls: meta.cancelledRides > 5 ? "text-red-600" : "text-slate-800" },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-[12px] p-3 text-center border border-slate-100">
                  <div className={`text-xl font-black tabular-nums ${s.cls}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Contact */}
            <Card className="p-4">
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
              <StatRow label="Account created" value={fmtDate(user.joinedAt)} />
              <StatRow label="Last ride" value={user.lastRide} />
              <StatRow label="Last activity" value={fmtRelative(meta.lastActivity)} />
              <StatRow label="Reports filed" value={
                <span className={user.reports > 0 ? "text-amber-600 font-semibold" : "text-slate-700"}>{user.reports}</span>
              } />
            </Card>

            {/* Active ride */}
            {activeRide && (
              <div className="bg-sky-50 border border-sky-200 rounded-[12px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-sky-800">Active Ride</p>
                  <Button variant="secondary" size="sm" icon={<ExternalLink size={12} />}
                    onClick={() => navigate(`/rides/live?selected=${activeRide.id}`)}>View</Button>
                </div>
                <p className="font-mono text-sm font-bold text-sky-700">{activeRide.id}</p>
                <p className="text-xs text-[#BE1B2C] mt-0.5">{activeRide.pickup.address} → {activeRide.destination.address}</p>
              </div>
            )}

            {/* Disputes summary */}
            {userDisputes.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-3.5">
                <p className="text-xs font-bold text-amber-800">{userDisputes.length} dispute{userDisputes.length > 1 ? "s" : ""} on record</p>
                <p className="text-xs text-amber-700 mt-0.5">{userDisputes.filter(d => d.status === "open").length} open</p>
              </div>
            )}

            {/* Actions */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Admin Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                {user.restricted ? (
                  <Button variant="secondary" size="sm" icon={<ShieldOff size={13} />} onClick={() => setModal("restore")}>Restore Account</Button>
                ) : (
                  <Button variant="danger" size="sm" icon={<Shield size={13} />} onClick={() => setModal("restrict")}>Restrict Account</Button>
                )}
                <Button variant="secondary" size="sm" icon={<MessageSquare size={13} />}
                  onClick={() => navigate(`/chat?user=${user.id}`)}>Contact User</Button>
                <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                  onClick={() => navigate(`/audit-logs?entity=${user.id}`)}>Audit Log</Button>
              </div>
            </div>
          </>
        )}

        {/* ── ACTIVE RIDE ── */}
        {tab === "active_ride" && (
          activeRide ? (
            <div className="flex flex-col gap-4">
              <div className="bg-sky-50 border border-sky-200 rounded-[12px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-sky-800">{activeRide.id}</span>
                  <RideStatusBadge status={activeRide.status} />
                </div>
                <div className="flex flex-col gap-1 text-sm text-sky-700 mb-3">
                  <p>↑ {activeRide.pickup.address}</p>
                  <p>↓ {activeRide.destination.address}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[#BE1B2C]">Driver: </span><span className="text-sky-800 font-medium">{activeRide.driver.name}</span></div>
                  <div><span className="text-[#BE1B2C]">ETA: </span><span className="text-sky-800 font-medium">{activeRide.eta ?? "—"} min</span></div>
                  <div><span className="text-[#BE1B2C]">Distance: </span><span className="text-sky-800 font-medium">{activeRide.distanceKm ?? "—"} km</span></div>
                  <div><span className="text-[#BE1B2C]">Fare: </span><span className="text-sky-800 font-medium">₦{activeRide.fareNGN.toLocaleString()}</span></div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                  onClick={() => navigate(`/rides/live?selected=${activeRide.id}`)}>View on Live Map</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <CheckCircle size={24} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No active ride</p>
              <p className="text-xs text-slate-400">User is not currently on a trip.</p>
            </div>
          )
        )}

        {/* ── RIDE HISTORY ── */}
        {tab === "ride_history" && (
          rideHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Clock size={24} className="text-slate-300" />
              <p className="text-sm text-slate-500">No ride history found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rideHistory.map(r => (
                <div key={r.id} className="bg-white rounded-[12px] border border-slate-200 p-3.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-500">{r.id}</span>
                      <RideStatusBadge status={r.status} />
                    </div>
                    <p className="text-xs text-slate-600 truncate">{r.pickup.address} → {r.destination.address}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.driver.name} · ₦{r.fareNGN.toLocaleString()}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{fmtRelative(r.createdAt)}</span>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => navigate(`/rides/all`)}>View all rides</Button>
            </div>
          )
        )}

        {/* ── DISPUTES ── */}
        {tab === "disputes" && (
          userDisputes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <CheckCircle size={24} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No disputes on record.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {userDisputes.map(d => (
                <div key={d.id} className="bg-white rounded-[12px] border border-slate-200 p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-600">{d.id}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border
                      ${d.status === "open" ? "bg-red-50 text-red-700 border-red-200"
                      : d.status === "resolved" ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"}`}>{d.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-xs text-slate-600 capitalize">{d.reason.replace(/_/g, " ")} · Ride {d.rideId}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{d.pointsInvolved} pts involved · {fmtRelative(d.createdAt)}</p>
                  {d.resolution && (
                    <p className="text-xs text-slate-500 mt-1 italic">Resolution: {d.resolution.decision.replace("_", " ")} — {d.resolution.by}</p>
                  )}
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => navigate(`/rides/disputes`)}>View all disputes</Button>
            </div>
          )
        )}

        {/* ── AUDIT ACTIVITY ── */}
        {tab === "audit" && (
          auditEntries.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No audit entries for this user.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {auditEntries.map(log => (
                <div key={log.id} className="bg-white rounded-[10px] border border-slate-100 px-3.5 py-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Clock size={12} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 capitalize">{log.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">{log.actor} · {log.role}</p>
                    {log.reason && <p className="text-xs text-slate-400 mt-0.5 italic">"{log.reason}"</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{fmtRelative(log.createdAt)}</span>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => navigate(`/audit-logs?entity=${user.id}`)}>Full audit log</Button>
            </div>
          )
        )}
      </div>

      {modal === "restrict" && (
        <ActionModal title="Restrict User Account" consequence="User will be prevented from booking rides immediately. They will receive a notification. This action is reversible and logged." variant="danger" onConfirm={(r) => handleAction("restrict", r)} onClose={() => setModal(null)} />
      )}
      {modal === "restore" && (
        <ActionModal title="Restore User Account" consequence="User's ability to book rides will be restored. They will be notified. This action is logged." variant="primary" onConfirm={(r) => handleAction("restore", r)} onClose={() => setModal(null)} />
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Users() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "restricted">("all");
  const [selectedUser, setSelectedUser] = useState<typeof mockUsers[0] | null>(null);
  const [page, setPage] = useState(1);

  const filtered = mockUsers.filter(u => {
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search) ||
      u.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || (statusFilter === "restricted" ? u.restricted : !u.restricted);
    return matchSearch && matchStatus;
  });

  const perPage = 8;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const activeCount = mockUsers.filter(u => !u.restricted).length;
  const restrictedCount = mockUsers.filter(u => u.restricted).length;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Users"
        description="Manage passenger accounts, view activity and handle restrictions."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-full font-medium">{activeCount} active</span>
            <span className="text-xs text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full font-medium">{restrictedCount} restricted</span>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone or user ID…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-[10px] p-1">
          {(["all", "active", "restricted"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all capitalize
                ${statusFilter === s ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Phone</Th>
                <Th>Status</Th>
                <Th>Total Rides</Th>
                <Th>Last Ride</Th>
                <Th>Reports</Th>
                <Th>Joined</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8}><EmptyState title="No users match your filters" description="Try adjusting the search or status filter." /></td></tr>
              ) : paginated.map(user => (
                <Tr key={user.id} onClick={() => setSelectedUser(user)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar initials={user.avatar} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.id}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="font-mono text-xs text-slate-600">{maskPhone(user.phone)}</span></Td>
                  <Td><Badge variant={user.restricted ? "restricted" : "active"} dot /></Td>
                  <Td><span className="text-sm tabular-nums">{user.totalRides}</span></Td>
                  <Td><span className="text-xs text-slate-500">{user.lastRide}</span></Td>
                  <Td>
                    {user.reports > 0
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} /> {user.reports}
                        </span>
                      : <span className="text-xs text-slate-400">—</span>}
                  </Td>
                  <Td><span className="text-xs text-slate-500">{user.joinedAt}</span></Td>
                  <Td>
                    <Button variant="secondary" size="sm" onClick={e => { e.stopPropagation(); setSelectedUser(user); }}>
                      Inspect
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </Card>

      <Drawer open={!!selectedUser} onClose={() => setSelectedUser(null)} title="" width="w-[580px]">
        {selectedUser && <UserDetail key={selectedUser.id} user={selectedUser} />}
      </Drawer>
    </div>
  );
}
