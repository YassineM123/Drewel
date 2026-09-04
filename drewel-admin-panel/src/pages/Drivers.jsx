import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Star, Eye, EyeOff, CheckCircle, XCircle,
  ShieldOff, Shield, MessageSquare, Plus, AlertTriangle,
  Navigation, ExternalLink, FileText, Clock,
} from "lucide-react";
import { getDriverList, updateDriverReviewStatus } from "../utils/api";
import { addDriver, getDriverDetail, updateDriverRestriction } from "../api/domains/drivers";
import { getPointsAccess } from "../utils/pointsPermissions";

function maskEmail(e) { if (!e) return "N/A"; const [u, d] = e.split("@"); return (u?.slice(0, 2) || "") + "***@" + (d || ""); }
function fmtDate(iso) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
const driverName = (d) => `${d.firstName || ""} ${d.lastName || ""}`.trim() || d.fullName || "N/A";
const driverInitials = (d) => {
  const name = driverName(d);
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase()).slice(0, 2).join("") || "?";
};
const statusLabel = (v) => String(v || "unknown").replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
const gpsLabel = (d) => {
  const s = Number(d.locationAgeSeconds);
  if (!Number.isFinite(s)) return "No GPS";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
};
const driverOnlineStatus = (d) => {
  if (d.availabilityStatus === "Online") return "online_available";
  if (d.availabilityStatus === "Busy") return "online_busy";
  return "offline";
};
const driverVerificationStatus = (d) => {
  const s = String(d.status || "pending").toLowerCase();
  if (s === "completed") return "approved";
  return s;
};

function OnlineBadge({ status }) {
  const map = {
    online_available: { label: "Online", cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
    online_busy: { label: "Busy", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
    offline: { label: "Offline", cls: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-300" },
  };
  const s = map[status] || map.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Badge({ variant, dot }) {
  const map = {
    approved: { label: "Approved", cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
    restricted: { label: "Restricted", cls: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
    active: { label: "Active", cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  };
  const s = map[variant] || map.pending;
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

function ActionModal({ title, consequence, variant, requiresReason, confirmLabel, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmit = !requiresReason || reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className={`rounded-[10px] p-3.5 text-sm border
            ${variant === "danger" ? "bg-red-50 text-red-800 border-red-200"
            : variant === "warning" ? "bg-amber-50 text-amber-800 border-amber-200"
            : "bg-sky-50 text-sky-800 border-blue-200"}`}>
            {consequence}
          </div>
          {requiresReason && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Reason <span className="text-red-500">*</span></label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Provide your reason for this action…"
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button type="button" disabled={!canSubmit || loading} onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); onConfirm(reason); }, 900); }}
            className={`h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] text-xs font-semibold text-white transition-all disabled:opacity-50
              ${variant === "danger" ? "bg-red-600 hover:bg-red-700" : variant === "warning" ? "bg-amber-500 hover:bg-amber-600" : "bg-[#BE1B2C] hover:bg-[#A31725]"}`}>
            {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Drawer({ open, onClose, width = "w-[640px]", children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`drawer-enter relative bg-white ${width} max-w-[calc(100vw-2rem)] h-full shadow-2xl flex flex-col`}>
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors z-10">
          <XCircle size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

function MarketplaceBadge({ discoverable }) {
  return discoverable ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
      DISCOVERABLE
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
      BLOCKED
    </span>
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

function DriverCard({ driver, onClick }) {
  const status = driverOnlineStatus(driver);
  const vStatus = driverVerificationStatus(driver);
  const restricted = driver.isRestricted;
  const pts = Number(driver.pointsWallet?.availablePoints || 0);
  const hasLowBalance = pts < 20;
  const statusDot = { online_available: "bg-green-500", online_busy: "bg-blue-500", offline: "bg-slate-300" };
  const vehicleType = driver.vehicleType || "N/A";

  return (
    <div className="bg-white rounded-[14px] border border-slate-200 p-5 cursor-pointer hover:shadow-sm hover:border-slate-300 transition-all"
      onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-sm font-bold text-[#BE1B2C]">
              {driverInitials(driver)}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot[status]}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{driverName(driver)}</p>
            <p className="text-xs text-slate-400">{driver._id?.slice(-8) || "N/A"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Star size={12} className="text-amber-400 fill-amber-400" />
          {Number(driver.rating || 0).toFixed(2)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <OnlineBadge status={status} />
        <Badge variant={vStatus} />
        {restricted && <Badge variant="restricted" />}
        <MarketplaceBadge discoverable={driver.isDiscoverable === true} />
        {hasLowBalance && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
            <AlertTriangle size={9} /> Low balance
          </span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-slate-400">Vehicle</p><p className="text-slate-600 font-medium truncate">{vehicleType}</p></div>
        <div><p className="text-slate-400">Documents</p><p className="text-slate-600 font-medium">{driver.documentSummary?.available || 0}/{driver.documentSummary?.total || 0}</p></div>
        <div><p className="text-slate-400">Balance</p><p className="text-slate-600 font-medium">{pts}</p></div>
        <div className="flex items-center justify-between"><p className="text-slate-400">Rides</p><p className="text-slate-600 font-medium">{Number(driver.rideSummary?.completed || 0).toLocaleString()} completed</p></div>
        <div><p className="text-slate-400">Cancel rate</p><p className={`text-slate-600 font-medium ${Number(driver.cancellationRate || 0) > 5 ? "text-red-600" : ""}`}>{Number(driver.cancellationRate || 0).toFixed(1)}%</p></div>
        <div><p className="text-slate-400">Last GPS</p><p className="text-slate-600 font-medium">{gpsLabel(driver)}</p></div>
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400">Marketplace</span>
        <MarketplaceBadge discoverable={driver.isDiscoverable === true} />
      </div>
    </div>
  );
}

function DriverDetailDrawer({ driver, onToast, onChanged }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [revealed, setRevealed] = useState(false);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const access = getPointsAccess();

  useEffect(() => {
    if (!driver?._id) return;
    setDetailLoading(true);
    getDriverDetail(driver._id)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [driver?._id]);

  const d = detail || driver;
  const status = driverOnlineStatus(d);
  const vStatus = driverVerificationStatus(d);
  const restricted = d.isRestricted;
  const pts = Number(d.pointsWallet?.availablePoints || 0);
  const hasLowBalance = pts < 20;
  const rideSummary = d.rideSummary || {};

  const DTABS = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "active_ride", label: "Active Ride" },
    { id: "ride_history", label: "Ride History" },
    { id: "points", label: "Balance" },
  ];

  const handleAction = async (action, reason) => {
    setModal(null);
    setActionError("");
    try {
      if (action === "approve") {
        await updateDriverReviewStatus(d._id, { status: "approved", reason: reason || "" });
        onToast("Driver approved. They have been notified and can now accept rides.");
      } else if (action === "reject") {
        await updateDriverReviewStatus(d._id, { status: "rejected", rejection_reason: reason || "" });
        onToast("Driver application rejected. Reason sent to driver.");
      } else if (action === "suspend") {
        await updateDriverRestriction(d._id, "suspend", { reason: reason || "" });
        onToast("Driver account suspended. They cannot accept new rides.");
      } else if (action === "restore") {
        await updateDriverRestriction(d._id, "restore", { reason: reason || "" });
        onToast("Driver account restored. They can now accept rides again.");
      }
      onChanged?.();
    } catch (error) {
      setActionError(error?.response?.data?.message || "The action could not be completed. Please retry.");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-base font-bold text-[#BE1B2C]">
              {driverInitials(d)}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white
              ${status === "online_available" ? "bg-green-500" : status === "online_busy" ? "bg-blue-500" : "bg-slate-300"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">{driverName(d)}</h2>
            <p className="text-xs font-mono text-slate-400">{d._id}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <OnlineBadge status={status} />
              <Badge variant={vStatus} />
              {restricted && <Badge variant="restricted" />}
              {hasLowBalance && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle size={9} /> Low balance
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-0 overflow-x-auto border-b border-slate-200 shrink-0 px-1">
        {DTABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all
              ${tab === t.id ? "border-[#BE1B2C] text-[#BE1B2C]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {detailLoading && tab === "overview" && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-[#BE1B2C]/30 border-t-[#BE1B2C] rounded-full animate-spin" />
          </div>
        )}

        {tab === "overview" && !detailLoading && (
          <>
            {restricted && d.restrictedReason && (
              <div className="bg-red-50 border border-red-200 rounded-[12px] p-3.5">
                <p className="text-xs font-bold text-red-800 mb-1">Account Suspended</p>
                <p className="text-xs text-red-700">{d.restrictedReason}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Rating", value: `${Number(d.rating || 0).toFixed(2)} \u2605`, color: "text-amber-600" },
                { label: "Completed", value: Number(rideSummary.completed || 0).toLocaleString(), color: "text-slate-800" },
                { label: "Cancel rate", value: `${Number(d.cancellationRate || 0).toFixed(1)}%`, color: Number(d.cancellationRate || 0) > 5 ? "text-red-600" : "text-slate-800" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-50 rounded-[12px] p-3 text-center border border-slate-100">
                  <div className={`text-lg font-black tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {pts !== undefined && (
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-[12px] p-3.5 border ${hasLowBalance ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"}`}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Available balance</p>
                  <p className={`text-2xl font-black tabular-nums ${hasLowBalance ? "text-amber-700" : "text-slate-900"}`}>{pts}</p>
                  {hasLowBalance && <p className="text-[10px] text-amber-700 mt-0.5 font-medium">Below 20pt minimum</p>}
                </div>
                <div className="bg-slate-50 rounded-[12px] p-3.5 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Reserved balance</p>
                  <p className="text-2xl font-black tabular-nums text-slate-700">{Number(d.pointsWallet?.reservedPoints || 0)}</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[14px] border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</h4>
                <button onClick={() => setRevealed(!revealed)}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                  {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
                  {revealed ? "Mask" : "Reveal"}
                </button>
              </div>
              <StatRow label="Phone" value={<span className="font-mono text-xs">{d.phone || "N/A"}</span>} />
              <StatRow label="Email" value={<span className="font-mono text-xs">{revealed ? d.email : maskEmail(d.email)}</span>} />
              <StatRow label="Area" value={d.area || "N/A"} />
              <StatRow label="Member since" value={fmtDate(d.createdAt)} />
            </div>

            <div className="bg-white rounded-[14px] border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Vehicle</h4>
              <StatRow label="Type" value={d.vehicleType || "N/A"} />
              <StatRow label="Model" value={d.vehicleModel || "N/A"} />
              {d.registration && <StatRow label="Plate" value={d.registration} />}
            </div>

            <div className="bg-white rounded-[14px] border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Last GPS Update</h4>
              <div className="flex items-center gap-2">
                <Navigation size={15} className={Number(d.locationAgeSeconds) > 1800 ? "text-amber-500" : "text-green-500"} />
                <span className={`text-sm font-semibold ${Number(d.locationAgeSeconds) > 1800 ? "text-amber-700" : "text-slate-700"}`}>
                  {gpsLabel(d)}
                </span>
                {Number(d.locationAgeSeconds) > 1800 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Stale</span>}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Admin Actions</h4>
              {actionError && <div className="bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 text-xs text-red-700 mb-3" role="alert">{actionError}</div>}
              <div className="grid grid-cols-2 gap-2">
                {access.canAdjust && vStatus === "pending" && (
                  <>
                    <button type="button" onClick={() => setModal("approve")}
                      className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] bg-[#BE1B2C] text-xs font-semibold text-white hover:bg-[#A31725] transition-all">
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button type="button" onClick={() => setModal("reject")}
                      className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-all">
                      <XCircle size={13} /> Reject
                    </button>
                  </>
                )}
                {access.canAdjust && vStatus === "approved" && !restricted && (
                  <button type="button" onClick={() => setModal("suspend")}
                    className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-all">
                    <ShieldOff size={13} /> Suspend Account
                  </button>
                )}
                {access.canAdjust && restricted && (
                  <button type="button" onClick={() => setModal("restore")}
                    className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                    <Shield size={13} /> Restore Account
                  </button>
                )}
                {rideSummary.activeRide && (
                  <button type="button" onClick={() => navigate(`/rides/${rideSummary.activeRide.id}`)}
                    className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                    <Navigation size={13} /> View Active Ride
                  </button>
                )}
                {access.canAddPurchasedPoints && (
                  <button type="button" onClick={() => navigate(`/points/balances/${d._id}`)}
                    className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] bg-green-600 text-xs font-semibold text-white hover:bg-green-700 transition-all">
                    <Plus size={13} /> Add Balance
                  </button>
                )}
                <button type="button" onClick={() => navigate(`/support-chat?participant=driver&id=${encodeURIComponent(d._id)}`)}
                  className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                  <MessageSquare size={13} /> Contact Driver
                </button>
                <button type="button" onClick={() => navigate(`/driver-detail/${d._id}`)}
                  className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
                  <ExternalLink size={13} /> Full Detail Page
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "documents" && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText size={24} className="text-slate-300" />
            <p className="text-sm text-slate-500">Document details available on the full driver detail page.</p>
            <button type="button" onClick={() => navigate(`/driver-detail/${d._id}`)}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
              <ExternalLink size={13} /> Open Detail Page
            </button>
          </div>
        )}

        {tab === "active_ride" && (
          rideSummary.activeRide ? (
            <div className="flex flex-col gap-4">
              <div className="bg-sky-50 border border-sky-200 rounded-[12px] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-sky-800">{rideSummary.activeRide.reference || "Active"}</span>
                  <span className="text-xs font-semibold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">{statusLabel(rideSummary.activeRide.status)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Navigation size={24} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No active ride</p>
              <p className="text-xs text-slate-400">Driver is currently {status === "offline" ? "offline" : "available"}.</p>
            </div>
          )
        )}

        {tab === "ride_history" && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Clock size={24} className="text-slate-300" />
            <p className="text-sm text-slate-500">View full ride history on the detail page.</p>
            <button type="button" onClick={() => navigate(`/driver-detail/${d._id}`)}
              className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
              <ExternalLink size={13} /> Open Detail Page
            </button>
          </div>
        )}

        {tab === "points" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Available", value: pts, warn: hasLowBalance },
                { label: "Reserved", value: Number(d.pointsWallet?.reservedPoints || 0), warn: false },
              ].map((s) => (
                <div key={s.label} className={`rounded-[12px] p-3.5 border ${s.warn ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"}`}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
                  <p className={`text-xl font-black tabular-nums ${s.warn ? "text-amber-700" : "text-slate-900"}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[10px] border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800" role="note">
              <strong>Reserved balance</strong> is temporarily held while this driver has a pending ride offer. It is released if the offer expires, is rejected or is cancelled, and cannot be spent meanwhile.
            </div>
            {access.canAddPurchasedPoints && (
              <button type="button" onClick={() => navigate(`/points/balances/${d._id}`)}
                className="h-9 self-start inline-flex items-center gap-2 px-3.5 rounded-[10px] bg-green-600 text-xs font-semibold text-white hover:bg-green-700 transition-all">
                <Plus size={13} /> Add Balance
              </button>
            )}
          </>
        )}
      </div>

      {modal === "approve" && (
        <ActionModal title="Approve Driver" consequence="Driver will be approved and can start accepting rides. They will be notified immediately." variant="primary" requiresReason={false} confirmLabel="Approve" onConfirm={(r) => handleAction("approve", r)} onClose={() => setModal(null)} />
      )}
      {modal === "reject" && (
        <ActionModal title="Reject Driver Application" consequence="Driver application will be rejected. Your reason will be sent to them." variant="danger" requiresReason confirmLabel="Reject" onConfirm={(r) => handleAction("reject", r)} onClose={() => setModal(null)} />
      )}
      {modal === "suspend" && (
        <ActionModal title="Suspend Driver Account" consequence="Driver will be suspended immediately and cannot accept new rides. This action is logged." variant="danger" requiresReason confirmLabel="Suspend Account" onConfirm={(r) => handleAction("suspend", r)} onClose={() => setModal(null)} />
      )}
      {modal === "restore" && (
        <ActionModal title="Restore Driver Account" consequence="Driver's account will be reinstated. They can accept rides again. This action is logged." variant="primary" requiresReason confirmLabel="Restore Account" onConfirm={(r) => handleAction("restore", r)} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

const initialDriverForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  password: "",
  countryCode: "+971",
  vehicleType: "",
  vehicleModel: "",
  registration: "",
  city: "",
  address: "",
  contractNumber: "",
  licenseCompany: "",
  initialBalance: "",
};

function AddDriverDrawer({ onClose, onCreated, onToast }) {
  const [form, setForm] = useState(initialDriverForm);
  const [files, setFiles] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const setFile = (key) => (event) => setFiles((value) => ({ ...value, [key]: event.target.files?.[0] || null }));

  const requiredMissing =
    !form.firstName.trim() ||
    !form.lastName.trim() ||
    form.phone.replace(/\D/g, "").length < 6 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ||
    !form.vehicleType.trim() ||
    !form.city.trim();

  const submit = async (event) => {
    event.preventDefault();
    if (requiredMissing || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key !== "initialBalance") payload.append(key, String(value || "").trim());
      });
      payload.append("fullName", `${form.firstName.trim()} ${form.lastName.trim()}`.trim());
      Object.entries(files).forEach(([key, file]) => {
        if (file) payload.append(key, file);
      });
      await addDriver(payload);
      onToast("Driver created successfully.");
      onCreated();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Driver could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
        <h2 className="text-base font-bold text-slate-900">New Driver</h2>
        <p className="text-xs text-slate-500 mt-1">Create a verified driver using the existing Drewel driver account flow.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {error && <div className="bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 text-xs text-red-700" role="alert">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={form.firstName} onChange={set("firstName")} required />
          <Field label="Last name" value={form.lastName} onChange={set("lastName")} required />
          <Field label="Country code" value={form.countryCode} onChange={set("countryCode")} required />
          <Field label="Phone" value={form.phone} onChange={set("phone")} required inputMode="tel" />
          <Field label="Email" value={form.email} onChange={set("email")} required type="email" />
          <Field label="Password" value={form.password} onChange={set("password")} type="password" />
          <Field label="Vehicle type" value={form.vehicleType} onChange={set("vehicleType")} required />
          <Field label="Vehicle model" value={form.vehicleModel} onChange={set("vehicleModel")} />
          <Field label="Plate number" value={form.registration} onChange={set("registration")} />
          <Field label="City" value={form.city} onChange={set("city")} required />
          <Field label="Address" value={form.address} onChange={set("address")} />
          <Field label="Contract number" value={form.contractNumber} onChange={set("contractNumber")} />
          <Field label="License company" value={form.licenseCompany} onChange={set("licenseCompany")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["profileImage", "Profile image"],
            ["licenseCompany", "Company licence"],
            ["carLicenseFront", "Vehicle registration front"],
            ["carLicenseBack", "Vehicle registration back"],
            ["drivingLicenseFront", "Driving licence front"],
            ["drivingLicenseBack", "Driving licence back"],
            ["idProofFront", "ID front"],
            ["idProofBack", "ID back"],
            ["passportCopy", "Passport copy"],
          ].map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1.5 text-xs font-medium text-slate-700">
              {label}
              <input type="file" onChange={setFile(key)}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-[8px] file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200" />
            </label>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-3 text-xs text-amber-800">
          Initial balance is managed through the audited Add Balance action after the driver is created.
        </div>
      </div>
      <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
        <button type="button" onClick={onClose}
          className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all">
          Cancel
        </button>
        <button type="submit" disabled={requiredMissing || saving}
          className="h-9 inline-flex items-center gap-2 px-3.5 rounded-[10px] bg-[#BE1B2C] text-xs font-semibold text-white hover:bg-[#A31725] disabled:opacity-50 transition-all">
          {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={13} />}
          Create Driver
        </button>
      </div>
    </form>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-700">
      {label}{props.required && <span className="sr-only"> required</span>}
      <input {...props}
        className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
    </label>
  );
}

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [addingDriver, setAddingDriver] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchDrivers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getDriverList({
        status: tab === "verification" ? "pending" : "all",
        availability: tab === "online" ? "Online,Busy" : availabilityFilter,
        restricted: tab === "restricted" ? "true" : undefined,
        search,
        page,
        limit: 20,
        sort: "updatedAt",
        dir: "desc",
      });
      const list = Array.isArray(result.drivers) ? result.drivers : [];
      setDrivers(list);
      setPagination(result.pagination || { page, limit: 20, total: 0, totalPages: 1 });
    } catch (e) {
      setDrivers([]);
      setError(e?.response?.data?.message || "Unable to load drivers right now.");
    } finally {
      setLoading(false);
    }
  }, [tab, search, availabilityFilter, page]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);
  useEffect(() => { setPage(1); }, [tab, search, availabilityFilter]);

  const tabs = [
    { id: "all", label: "All Drivers" },
    { id: "online", label: "Online" },
    { id: "verification", label: "Verification" },
    { id: "restricted", label: "Restricted" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">Drivers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your driver network, verification status and account health.</p>
        </div>
        <button type="button" onClick={() => setAddingDriver(true)}
          className="h-10 shrink-0 inline-flex items-center gap-2 px-4 rounded-[10px] bg-[#BE1B2C] text-sm font-semibold text-white hover:bg-[#A31725] transition-all">
          <Plus size={15} /> New Driver
        </button>
      </div>

      <div className="flex items-center border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all
              ${tab === t.id ? "border-[#BE1B2C] text-[#BE1B2C]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or WhatsApp..."
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Availability filter</span>
          <select aria-label="Availability filter" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all">
            <option value="all">All availability</option>
            <option value="Online">Online</option>
            <option value="Busy">Busy</option>
            <option value="Offline">Offline</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={fetchDrivers} className="text-xs font-semibold text-red-700 hover:text-red-900 mt-1">Retry</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[14px] border border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1"><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /><div className="h-3 w-16 bg-slate-100 rounded animate-pulse mt-1" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <EmptyState title="No drivers match your filters" description="Try adjusting your search or tab selection." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drivers.map((driver) => (
            <DriverCard key={driver._id} driver={driver} onClick={() => setSelectedDriver(driver)} />
          ))}
        </div>
      )}

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Page {pagination.page} of {pagination.totalPages} &middot; {pagination.total} drivers
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="h-8 px-3 rounded-[8px] border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
              Previous
            </button>
            <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
              className="h-8 px-3 rounded-[8px] border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
              Next
            </button>
          </div>
        </div>
      )}

      <Drawer open={!!selectedDriver} onClose={() => setSelectedDriver(null)} width="w-[640px]">
        {selectedDriver && <DriverDetailDrawer key={selectedDriver._id} driver={selectedDriver} onClose={() => setSelectedDriver(null)} onToast={(msg, type = "success") => { setToast({ message: msg, type }); if (type === "error") return; setSelectedDriver(null); fetchDrivers(); }} />}
      </Drawer>

      <Drawer open={addingDriver} onClose={() => setAddingDriver(false)} width="w-[720px]">
        <AddDriverDrawer
          onClose={() => setAddingDriver(false)}
          onToast={(msg, type = "success") => setToast({ message: msg, type })}
          onCreated={() => { setAddingDriver(false); fetchDrivers(); }}
        />
      </Drawer>

      {toast && <Toast message={toast?.message || toast} type={toast?.type || "success"} onClose={() => setToast(null)} />}
    </div>
  );
}
