import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Star, Eye, EyeOff, CheckCircle,
  XCircle, ShieldOff, Shield, MessageSquare, Plus, AlertTriangle,
  Navigation, ExternalLink, FileText, Clock
} from "lucide-react";
import {
  Badge, OnlineBadge, Avatar, Button, Card, Drawer, StatRow,
  Toast, SectionHeader, EmptyState, Select
} from "../components/ui";
import { mockDrivers } from "../data/mock";
import { mockRides, mockDriverPointBalances, mockPointTransactions, mockAuditLogs } from "../data/mockRides";
import { mockDisputes } from "../data/mockDisputes";
import { RideStatusBadge } from "./Dashboard";

// ─── Extended driver metadata ─────────────────────────────────────────────────

const DRIVER_META: Record<string, {
  cancellationRate: number;
  vehicleType: "sedan" | "suv" | "premium";
  vehicleYear: string;
  city: string;
  lastGps: string;
  completedRides: number;
  suspendedReason?: string;
  accountCreated: string;
}> = {
  "DRV-4421": { cancellationRate: 2.1, vehicleType: "sedan", vehicleYear: "2022", city: "Lagos", lastGps: "2024-07-14T09:12:00Z", completedRides: 1241, accountCreated: "2023-03-12" },
  "DRV-3814": { cancellationRate: 4.8, vehicleType: "sedan", vehicleYear: "2021", city: "Lagos", lastGps: "2024-07-14T05:30:00Z", completedRides: 851, accountCreated: "2023-07-08" },
  "DRV-2908": { cancellationRate: 1.2, vehicleType: "suv", vehicleYear: "2023", city: "Abuja", lastGps: "2024-07-12T16:00:00Z", completedRides: 2100, suspendedReason: "Vehicle registration expired. Failed re-verification check on 13 Jul.", accountCreated: "2022-11-20" },
  "DRV-1823": { cancellationRate: 5.4, vehicleType: "sedan", vehicleYear: "2020", city: "Lagos", lastGps: "2024-07-14T08:58:00Z", completedRides: 539, accountCreated: "2024-01-15" },
  "DRV-5102": { cancellationRate: 0.9, vehicleType: "sedan", vehicleYear: "2022", city: "Lagos", lastGps: "2024-07-14T09:15:00Z", completedRides: 410, accountCreated: "2024-07-13" },
};

const DRIVER_DOCS: Record<string, { name: string; docType: string; expiry: string | null; status: "valid" | "expired" | "expiring_soon" | "missing" }[]> = {
  "DRV-4421": [
    { name: "National ID (NIN)", docType: "Identity",   expiry: null,         status: "valid" },
    { name: "Driver's License",  docType: "License",    expiry: "2025-08-14", status: "valid" },
    { name: "Vehicle Registration",docType: "Vehicle",  expiry: "2025-03-31", status: "valid" },
    { name: "Motor Insurance",   docType: "Insurance",  expiry: "2024-08-15", status: "expiring_soon" },
    { name: "Roadworthiness",    docType: "Vehicle",    expiry: "2024-12-20", status: "valid" },
  ],
  "DRV-3814": [
    { name: "National ID (NIN)", docType: "Identity",   expiry: null,         status: "valid" },
    { name: "Driver's License",  docType: "License",    expiry: "2026-02-20", status: "valid" },
    { name: "Vehicle Registration",docType: "Vehicle",  expiry: "2025-07-08", status: "valid" },
    { name: "Vehicle Roadworthiness",docType: "Vehicle",expiry: "2025-01-10", status: "valid" },
    { name: "Motor Insurance",   docType: "Insurance",  expiry: null,         status: "missing" },
  ],
  "DRV-2908": [
    { name: "National ID (NIN)", docType: "Identity",   expiry: null,         status: "valid" },
    { name: "Driver's License",  docType: "License",    expiry: "2024-07-01", status: "expired" },
    { name: "Vehicle Registration",docType: "Vehicle",  expiry: "2024-06-30", status: "expired" },
    { name: "Motor Insurance",   docType: "Insurance",  expiry: "2025-11-20", status: "valid" },
    { name: "Roadworthiness",    docType: "Vehicle",    expiry: "2024-05-15", status: "expired" },
  ],
  "DRV-1823": [
    { name: "National ID (NIN)", docType: "Identity",   expiry: null,         status: "valid" },
    { name: "Driver's License",  docType: "License",    expiry: "2026-01-15", status: "valid" },
    { name: "Vehicle Registration",docType: "Vehicle",  expiry: "2025-01-15", status: "valid" },
    { name: "Motor Insurance",   docType: "Insurance",  expiry: "2025-01-15", status: "valid" },
    { name: "Background Check",  docType: "Background", expiry: "2025-01-15", status: "valid" },
  ],
  "DRV-5102": [
    { name: "National ID (NIN)", docType: "Identity",   expiry: null,         status: "valid" },
    { name: "Driver's License",  docType: "License",    expiry: "2027-07-13", status: "valid" },
    { name: "Vehicle Registration",docType: "Vehicle",  expiry: "2025-07-13", status: "valid" },
    { name: "Motor Insurance",   docType: "Insurance",  expiry: "2025-07-13", status: "valid" },
    { name: "Background Check",  docType: "Background", expiry: "2025-07-13", status: "valid" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(p: string) { return p.slice(0, 9) + " *** " + p.slice(-4); }
function maskEmail(e: string) { const [u, d] = e.split("@"); return u.slice(0, 2) + "***@" + d; }
function fmtRelative(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Action confirmation modal ────────────────────────────────────────────────

interface ActionModalProps {
  title: string;
  consequence: string;
  variant: "danger" | "warning" | "primary";
  requiresReason: boolean;
  confirmLabel: string;
  extra?: React.ReactNode;
  onConfirm: (reason: string, extra?: string) => void;
  onClose: () => void;
}

function ActionModal({ title, consequence, variant, requiresReason, confirmLabel, extra, onConfirm, onClose }: ActionModalProps) {
  const [reason, setReason] = useState("");
  const [extraVal, setExtraVal] = useState("");
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
          {extra}
          {requiresReason && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Reason <span className="text-red-500">*</span></label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                placeholder="Provide your reason for this action…"
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
            </div>
          )}
          {extra && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Amount (points) <span className="text-red-500">*</span></label>
              <input type="number" value={extraVal} onChange={e => setExtraVal(e.target.value)} min={1}
                placeholder="e.g. 50"
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400" />
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={variant} disabled={!canSubmit} loading={loading}
            onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); onConfirm(reason, extraVal); }, 900); }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab IDs ──────────────────────────────────────────────────────────────────

type DTab = "overview" | "documents" | "active_ride" | "ride_history" | "points" | "disputes" | "audit";

const DTABS: { id: DTab; label: string }[] = [
  { id: "overview",     label: "Overview" },
  { id: "documents",    label: "Documents" },
  { id: "active_ride",  label: "Active Ride" },
  { id: "ride_history", label: "Ride History" },
  { id: "points",       label: "Points" },
  { id: "disputes",     label: "Disputes" },
  { id: "audit",        label: "Audit Activity" },
];

// ─── Driver Detail ────────────────────────────────────────────────────────────

function DriverDetail({ driver }: { driver: typeof mockDrivers[0] }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<DTab>("overview");
  const [revealed, setRevealed] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const meta = DRIVER_META[driver.id] ?? { cancellationRate: 0, vehicleType: "sedan", vehicleYear: "2022", city: "Lagos", lastGps: new Date().toISOString(), completedRides: driver.totalRides, accountCreated: driver.joinedAt };
  const points = mockDriverPointBalances.find(p => p.driverId === driver.id);
  const docs = DRIVER_DOCS[driver.id] ?? [];
  const activeRide = mockRides.find(r => (r.driver.id === driver.id || r.driver.name === driver.name) && ["offer_sent","offer_accepted","driver_on_way","driver_arrived","pickup_confirmed","ride_started"].includes(r.status));
  const rideHistory = mockRides.filter(r => r.driver.name === driver.name).slice(0, 8);
  const driverDisputes = mockDisputes.filter(d => d.driver.name === driver.name);
  const auditEntries = mockAuditLogs.filter(l => l.entityId === driver.id || l.entityId.includes(driver.id)).slice(0, 12);
  const ptxs = mockPointTransactions.filter(t => t.driverId === driver.id).slice(0, 10);

  const isPending = driver.verificationStatus === "pending";
  const isApproved = driver.verificationStatus === "approved";
  const isRestricted = driver.restricted;
  const hasLowBalance = (points?.available ?? 0) < 20;

  const handleAction = (action: string, _reason: string) => {
    setModal(null);
    const msgs: Record<string, string> = {
      approve: "Driver approved. They have been notified and can now accept rides.",
      reject: "Driver application rejected. Reason sent to driver.",
      suspend: "Driver account suspended. They cannot accept new rides.",
      restore: "Driver account restored. They can now accept rides again.",
      add_points: "Points added successfully. Audit log updated.",
    };
    setToast(msgs[action] ?? "Action completed.");
  };

  const gpsMin = Math.floor((Date.now() - new Date(meta.lastGps).getTime()) / 60000);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Profile header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar initials={driver.avatar} size="lg" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white
              ${driver.onlineStatus === "online_available" ? "bg-green-500"
              : driver.onlineStatus === "online_busy" ? "bg-blue-500" : "bg-slate-300"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900">{driver.name}</h2>
            <p className="text-xs font-mono text-slate-400">{driver.id}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <OnlineBadge status={driver.onlineStatus as "online_available" | "online_busy" | "offline"} />
              <Badge variant={driver.verificationStatus as "approved" | "pending" | "rejected"} />
              {isRestricted && <Badge variant="restricted" />}
              {hasLowBalance && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <AlertTriangle size={9} /> Low balance
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-0 overflow-x-auto border-b border-slate-200 shrink-0 px-1">
        {DTABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all
              ${tab === t.id ? "border-[#BE1B2C] text-[#BE1B2C]" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
            {t.id === "disputes" && driverDisputes.length > 0 && (
              <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">{driverDisputes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <>
            {isRestricted && meta.suspendedReason && (
              <div className="bg-red-50 border border-red-200 rounded-[12px] p-3.5">
                <p className="text-xs font-bold text-red-800 mb-1">Account Suspended</p>
                <p className="text-xs text-red-700">{meta.suspendedReason}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Rating", value: `${driver.rating.toFixed(2)} ★`, color: "text-amber-600" },
                { label: "Completed", value: meta.completedRides.toLocaleString(), color: "text-slate-800" },
                { label: "Cancel rate", value: `${meta.cancellationRate}%`, color: meta.cancellationRate > 5 ? "text-red-600" : "text-slate-800" },
              ].map(s => (
                <div key={s.label} className="bg-slate-50 rounded-[12px] p-3 text-center border border-slate-100">
                  <div className={`text-lg font-black tabular-nums ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Points */}
            {points && (
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-[12px] p-3.5 border ${hasLowBalance ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"}`}>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Available points</p>
                  <p className={`text-2xl font-black tabular-nums ${hasLowBalance ? "text-amber-700" : "text-slate-900"}`}>{points.available}</p>
                  {hasLowBalance && <p className="text-[10px] text-amber-700 mt-0.5 font-medium">Below 20pt minimum</p>}
                </div>
                <div className="bg-slate-50 rounded-[12px] p-3.5 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Reserved points</p>
                  <p className="text-2xl font-black tabular-nums text-slate-700">{points.reserved}</p>
                </div>
              </div>
            )}

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
              <StatRow label="Phone" value={
                <span className="font-mono text-xs">{revealed ? driver.phone : maskPhone(driver.phone)}</span>
              } />
              <StatRow label="Email" value={
                <span className="font-mono text-xs">{revealed ? driver.email : maskEmail(driver.email)}</span>
              } />
              <StatRow label="City" value={meta.city} />
              <StatRow label="Area" value={driver.area} />
              <StatRow label="Member since" value={fmtDate(meta.accountCreated)} />
            </Card>

            {/* Vehicle */}
            <Card className="p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Vehicle</h4>
              <StatRow label="Make / Model" value={driver.vehicle.split(" · ")[0]} />
              <StatRow label="Type" value={<span className="capitalize">{meta.vehicleType}</span>} />
              <StatRow label="Year" value={meta.vehicleYear} />
              <StatRow label="Color" value={driver.vehicleColor} />
              {driver.vehicle.includes("·") && <StatRow label="Plate" value={driver.vehicle.split("·")[1]?.trim() ?? "—"} />}
            </Card>

            {/* GPS */}
            <Card className="p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Last GPS Update</h4>
              <div className="flex items-center gap-2">
                <Navigation size={15} className={gpsMin > 30 ? "text-amber-500" : "text-green-500"} />
                <span className={`text-sm font-semibold ${gpsMin > 30 ? "text-amber-700" : "text-slate-700"}`}>
                  {fmtRelative(meta.lastGps)}
                </span>
                {gpsMin > 30 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Stale</span>}
              </div>
            </Card>

            {/* Active ride callout */}
            {activeRide && (
              <div className="bg-sky-50 border border-sky-200 rounded-[12px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-sky-800">Active Ride</p>
                  <Button variant="secondary" size="sm" icon={<ExternalLink size={12} />}
                    onClick={() => navigate(`/rides/live?selected=${activeRide.id}`)}>
                    View on map
                  </Button>
                </div>
                <p className="font-mono text-sm font-bold text-sky-700">{activeRide.id}</p>
                <p className="text-xs text-[#BE1B2C] mt-0.5">{activeRide.pickup.address} → {activeRide.destination.address}</p>
              </div>
            )}

            {/* Actions */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Admin Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                {isPending && <>
                  <Button variant="primary" size="sm" icon={<CheckCircle size={13} />} onClick={() => setModal("approve")}>Approve</Button>
                  <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => setModal("reject")}>Reject</Button>
                </>}
                {isApproved && !isRestricted && (
                  <Button variant="danger" size="sm" icon={<ShieldOff size={13} />} onClick={() => setModal("suspend")}>Suspend Account</Button>
                )}
                {isRestricted && (
                  <Button variant="secondary" size="sm" icon={<Shield size={13} />} onClick={() => setModal("restore")}>Restore Account</Button>
                )}
                {activeRide && (
                  <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                    onClick={() => navigate(`/rides/live?selected=${activeRide.id}`)}>
                    View Active Ride
                  </Button>
                )}
                <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={() => setModal("add_points")}>Add Points</Button>
                <Button variant="secondary" size="sm" icon={<MessageSquare size={13} />}
                  onClick={() => navigate(`/chat?driver=${driver.id}`)}>
                  Contact Driver
                </Button>
                <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                  onClick={() => navigate(`/audit-logs?entity=${driver.id}`)}>
                  Audit Log
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── DOCUMENTS ── */}
        {tab === "documents" && (
          <>
            {docs.some(d => d.status === "missing") && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-[12px] p-3.5">
                <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 font-medium">{docs.filter(d => d.status === "missing").length} required document(s) missing.</p>
              </div>
            )}
            {docs.some(d => d.status === "expired") && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-[12px] p-3.5">
                <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 font-medium">{docs.filter(d => d.status === "expired").length} document(s) expired.</p>
              </div>
            )}
            {docs.some(d => d.status === "expiring_soon") && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-[12px] p-3.5">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium">{docs.filter(d => d.status === "expiring_soon").length} document(s) expiring within 30 days.</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {docs.map((doc, i) => {
                const statusConfig = {
                  valid:         { cls: "border-slate-200 bg-white",        icon: <CheckCircle size={14} className="text-green-500" />,   label: "Valid",          lCls: "text-green-600" },
                  expired:       { cls: "border-red-200 bg-red-50/40",       icon: <XCircle size={14} className="text-red-500" />,         label: "Expired",        lCls: "text-red-600" },
                  expiring_soon: { cls: "border-amber-200 bg-amber-50/40",   icon: <AlertTriangle size={14} className="text-amber-500" />, label: "Expiring soon",  lCls: "text-amber-600" },
                  missing:       { cls: "border-red-200 bg-red-50/30",       icon: <AlertTriangle size={14} className="text-red-400" />,   label: "Missing",        lCls: "text-red-600" },
                }[doc.status];
                return (
                  <div key={i} className={`rounded-[12px] p-4 border flex items-start gap-3 ${statusConfig.cls}`}>
                    <div className="w-9 h-9 rounded-[8px] bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{doc.name}</p>
                      <p className="text-xs text-slate-400">{doc.docType}</p>
                      {doc.expiry && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Expiry: {new Date(doc.expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {statusConfig.icon}
                      <span className={`text-xs font-semibold ${statusConfig.lCls}`}>{statusConfig.label}</span>
                    </div>
                  </div>
                );
              })}
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
                  <RideStatusBadge status={activeRide.isStuck ? "stuck" : activeRide.status} />
                </div>
                <div className="flex flex-col gap-1 text-sm text-sky-700">
                  <p>↑ {activeRide.pickup.address}</p>
                  <p>↓ {activeRide.destination.address}</p>
                </div>
                {activeRide.eta !== null && (
                  <p className="text-xs text-[#BE1B2C] mt-2">ETA: {activeRide.eta} min · {activeRide.distanceKm} km</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                  onClick={() => navigate(`/rides/live?selected=${activeRide.id}`)}>View on Live Map</Button>
                <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                  onClick={() => navigate(`/rides/all?id=${activeRide.id}`)}>Ride Details</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Navigation size={24} className="text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No active ride</p>
              <p className="text-xs text-slate-400">Driver is currently {driver.onlineStatus === "offline" ? "offline" : "available"}.</p>
            </div>
          )
        )}

        {/* ── RIDE HISTORY ── */}
        {tab === "ride_history" && (
          rideHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Clock size={24} className="text-slate-300" />
              <p className="text-sm text-slate-500">No ride history found for this driver.</p>
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
                    <p className="text-xs text-slate-400 mt-0.5">{r.city} · {r.distanceKm ? `${r.distanceKm} km` : "—"} · ₦{r.fareNGN.toLocaleString()}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{fmtRelative(r.createdAt)}</span>
                </div>
              ))}
              <Button variant="secondary" size="sm" className="mt-1" onClick={() => navigate(`/rides/all`)}>View all rides</Button>
            </div>
          )
        )}

        {/* ── POINTS ── */}
        {tab === "points" && (
          <>
            {points && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Available", value: points.available, warn: hasLowBalance },
                  { label: "Reserved", value: points.reserved, warn: false },
                  { label: "Total Purchased", value: points.totalPurchased, warn: false },
                  { label: "Total Consumed", value: points.totalConsumed, warn: false },
                ].map(s => (
                  <div key={s.label} className={`rounded-[12px] p-3.5 border ${s.warn ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"}`}>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
                    <p className={`text-xl font-black tabular-nums ${s.warn ? "text-amber-700" : "text-slate-900"}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Transactions</h4>
              {ptxs.length === 0 ? (
                <p className="text-xs text-slate-400">No transactions found.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ptxs.map(tx => (
                    <div key={tx.id} className="bg-white rounded-[10px] border border-slate-200 px-3.5 py-2.5 flex items-center gap-3">
                      <span className={`text-sm font-bold tabular-nums ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 capitalize">{tx.type.replace(/_/g, " ")}</p>
                        <p className="text-[10px] text-slate-400">{tx.rideId ?? "—"}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{fmtRelative(tx.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="secondary" size="sm" className="mt-3" icon={<Plus size={13} />} onClick={() => setModal("add_points")}>
                Add Points
              </Button>
            </div>
          </>
        )}

        {/* ── DISPUTES ── */}
        {tab === "disputes" && (
          driverDisputes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <CheckCircle size={24} className="text-slate-300" />
              <p className="text-sm text-slate-500">No disputes found for this driver.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {driverDisputes.map(d => (
                <div key={d.id} className="bg-white rounded-[12px] border border-slate-200 p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-600">{d.id}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border
                      ${d.status === "open" ? "bg-red-50 text-red-700 border-red-200"
                      : d.status === "resolved" ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"}`}>{d.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-xs text-slate-600">{d.reason.replace(/_/g, " ")} · Ride {d.rideId}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{d.pointsInvolved} pts · {fmtRelative(d.createdAt)}</p>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => navigate(`/rides/disputes`)}>View all disputes</Button>
            </div>
          )
        )}

        {/* ── AUDIT ACTIVITY ── */}
        {tab === "audit" && (
          auditEntries.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No audit entries for this driver.</p>
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
              <Button variant="secondary" size="sm" onClick={() => navigate(`/audit-logs?entity=${driver.id}`)}>Full audit log</Button>
            </div>
          )
        )}
      </div>

      {/* ── Modals ── */}
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
      {modal === "add_points" && (
        <ActionModal title="Add Points" consequence="Points will be credited to this driver's account. The action and reason will be written to the immutable audit log." variant="primary" requiresReason confirmLabel="Add Points" extra={<div />} onConfirm={(r) => handleAction("add_points", r)} onClose={() => setModal(null)} />
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "all",          label: "All Drivers",   count: mockDrivers.length },
  { id: "online",       label: "Online",        count: mockDrivers.filter(d => d.onlineStatus !== "offline").length },
  { id: "verification", label: "Verification",  count: mockDrivers.filter(d => d.verificationStatus === "pending").length },
  { id: "restricted",   label: "Restricted",    count: mockDrivers.filter(d => d.restricted).length },
];

export default function Drivers() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [cityF, setCityF] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState<typeof mockDrivers[0] | null>(null);

  const filtered = mockDrivers.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === "all" || (tab === "online" && d.onlineStatus !== "offline") || (tab === "verification" && d.verificationStatus === "pending") || (tab === "restricted" && d.restricted);
    const meta = DRIVER_META[d.id];
    const matchCity = cityF === "all" || (meta?.city.toLowerCase() === cityF);
    return matchSearch && matchTab && matchCity;
  });

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Drivers"
        description="Manage your driver network, verification status and account health."
        actions={
          <div className="flex items-center gap-2">
            <Select value={cityF} onChange={setCityF} className="w-32"
              options={[{ value: "all", label: "All Cities" }, { value: "lagos", label: "Lagos" }, { value: "abuja", label: "Abuja" }]} />
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2
              ${tab === t.id ? "border-[#BE1B2C] text-[#BE1B2C]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or driver ID..."
          className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No drivers match your filters" description="Try adjusting your search or tab selection." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(driver => <DriverCard key={driver.id} driver={driver} onClick={() => setSelectedDriver(driver)} />)}
        </div>
      )}

      <Drawer open={!!selectedDriver} onClose={() => setSelectedDriver(null)} title="" width="w-[640px]">
        {selectedDriver && <DriverDetail key={selectedDriver.id} driver={selectedDriver} />}
      </Drawer>
    </div>
  );
}

function DriverCard({ driver, onClick }: { driver: typeof mockDrivers[0]; onClick: () => void }) {
  const points = mockDriverPointBalances.find(p => p.driverId === driver.id);
  const hasLowBalance = (points?.available ?? 999) < 20;
  const statusDot: Record<string, string> = {
    online_available: "bg-green-500", online_busy: "bg-blue-500", offline: "bg-slate-300",
  };
  return (
    <Card className="p-5 cursor-pointer hover:shadow-sm hover:border-slate-300 transition-all" onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar initials={driver.avatar} size="md" />
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot[driver.onlineStatus]}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{driver.name}</p>
            <p className="text-xs text-slate-400">{driver.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Star size={12} className="text-amber-400 fill-amber-400" />
          {driver.rating.toFixed(2)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <OnlineBadge status={driver.onlineStatus as "online_available" | "online_busy" | "offline"} />
        <Badge variant={driver.verificationStatus as "approved" | "pending" | "rejected"} />
        {driver.restricted && <Badge variant="restricted" />}
        {hasLowBalance && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
            <AlertTriangle size={9} /> {points?.available}pts
          </span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
        <div><p className="text-slate-400">Vehicle</p><p className="text-slate-600 font-medium truncate">{driver.vehicle.split(" · ")[0]}</p></div>
        <div><p className="text-slate-400">Area</p><p className="text-slate-600 font-medium">{driver.area}</p></div>
        <div><p className="text-slate-400">Rides</p><p className="text-slate-600 font-medium">{driver.totalRides.toLocaleString()}</p></div>
        <div><p className="text-slate-400">Last seen</p><p className="text-slate-600 font-medium">{driver.lastSeen}</p></div>
      </div>
    </Card>
  );
}
