import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, X, Phone, MapPin, Clock, Lock, Unlock,
  XCircle, AlertOctagon, FileText, CheckCircle2, RefreshCw,
  ChevronRight, Star, Car, User, MessageSquare,
} from "lucide-react";
import { Avatar, Button, Modal, Toast, StatRow } from "../../components/ui";
import { type Ride, type RideStatus, mockDriverPointBalances } from "../../data/mockRides";
import { RideStatusBadge } from "../Dashboard";

// ─── Status label map ─────────────────────────────────────────────────────────

const STATUS_LABEL: Partial<Record<RideStatus, string>> = {
  offer_sent:        "Offer Pending",
  offer_accepted:    "Confirmed",
  driver_on_way:     "Driver on the Way",
  driver_arrived:    "Driver Arrived",
  pickup_confirmed:  "Pickup Confirmed",
  ride_started:      "In Progress",
  completed:         "Completed",
  cancelled_user:    "Cancelled by User",
  cancelled_driver:  "Cancelled by Driver",
  cancelled_admin:   "Cancelled by Admin",
  cancelled:         "Cancelled",
  disputed:          "Disputed",
  technical_failure: "Technical Failure",
};

// ─── Admin action configs ─────────────────────────────────────────────────────

interface ActionConfig {
  id: string;
  label: string;
  title: string;
  consequence: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  variant: "danger" | "warning" | "primary" | "secondary";
  confirmLabel: string;
  requiresNote: boolean;
}

const ACTIONS: ActionConfig[] = [
  {
    id: "cancel_stuck",
    label: "Cancel Stuck Ride",
    title: "Cancel Stuck Ride",
    consequence: "This will forcefully cancel the ride and release the driver's reserved points. The passenger will be notified. The driver will be marked as available. This action is logged in the immutable audit trail and cannot be undone.",
    reasonLabel: "Reason for cancellation",
    reasonPlaceholder: "e.g. Driver unresponsive for 4+ hours, GPS stale, escalating to admin cancel…",
    variant: "danger",
    confirmLabel: "Cancel Ride",
    requiresNote: true,
  },
  {
    id: "release_lock",
    label: "Release Ride Lock",
    title: "Release Active Ride Lock",
    consequence: "Releasing the ride lock will allow this driver to receive new ride offers before the current ride is resolved. Use only if the driver's app has crashed or the ride is in an invalid state. Any subsequent ride actions may conflict with this one.",
    reasonLabel: "Reason for releasing lock",
    reasonPlaceholder: "e.g. Driver app crashed, confirmed no active GPS signal since…",
    variant: "warning",
    confirmLabel: "Release Lock",
    requiresNote: true,
  },
  {
    id: "technical_failure",
    label: "Mark Technical Failure",
    title: "Mark as Technical Failure",
    consequence: "The ride will be marked as failed due to a technical platform issue. No points will be charged to the driver. The passenger will receive a system notification. This is audited.",
    reasonLabel: "Technical failure reason",
    reasonPlaceholder: "e.g. Google Routes API outage, GPS pipeline failure, ride matching error…",
    variant: "warning",
    confirmLabel: "Mark as Failed",
    requiresNote: true,
  },
  {
    id: "open_dispute",
    label: "Open Dispute",
    title: "Open a Dispute",
    consequence: "This will flag the ride for dispute review. Both the driver and passenger will receive a notification. Disputed rides are paused for point settlement until resolved.",
    reasonLabel: "Reason for opening dispute",
    reasonPlaceholder: "e.g. Passenger reported route deviation, driver reported dangerous passenger behaviour…",
    variant: "warning",
    confirmLabel: "Open Dispute",
    requiresNote: true,
  },
  {
    id: "resolve_dispute",
    label: "Resolve Dispute",
    title: "Resolve Dispute",
    consequence: "This will close the dispute. Your decision will be recorded and both parties notified. Specify who the decision favors and why. The resolution is immutable.",
    reasonLabel: "Resolution decision",
    reasonPlaceholder: "e.g. GPS trace confirmed direct route. No route deviation found. Closing in driver's favour…",
    variant: "primary",
    confirmLabel: "Resolve Dispute",
    requiresNote: true,
  },
  {
    id: "refund_points",
    label: "Refund Points",
    title: "Refund Driver Points",
    consequence: "This will credit points back to the driver's account. This action creates a new audit log entry and will appear in the driver's transaction history. You cannot remove a refund once issued.",
    reasonLabel: "Refund reason",
    reasonPlaceholder: "e.g. GPS failure caused premature ride termination, admin error on RDE-…",
    variant: "secondary",
    confirmLabel: "Issue Refund",
    requiresNote: true,
  },
  {
    id: "add_note",
    label: "Add Internal Note",
    title: "Add Internal Note",
    consequence: "This note will be visible to all admin users and logged in the audit trail. It is not shown to drivers or passengers.",
    reasonLabel: "Internal note",
    reasonPlaceholder: "e.g. Contacted driver by phone at 09:35, no answer. Will retry in 30 minutes…",
    variant: "secondary",
    confirmLabel: "Save Note",
    requiresNote: false,
  },
];

// ─── Tiny route map ───────────────────────────────────────────────────────────

function MiniRouteMap({ pickup, destination }: { pickup: Ride["pickup"]; destination: Ride["destination"] }) {
  const W = 320, H = 100;
  const PAD = 20;

  // Project lat/lng to SVG coords; use Lagos bounding box for local rides,
  // fall back to a simple horizontal layout for off-map cities (e.g. Abuja)
  const LAG_LAT = [6.38, 6.62] as const;
  const LAG_LNG = [3.28, 3.62] as const;
  const inLagos = (lat: number, lng: number) =>
    lat >= LAG_LAT[0] && lat <= LAG_LAT[1] && lng >= LAG_LNG[0] && lng <= LAG_LNG[1];

  let px: number, py: number, dx: number, dy: number;
  if (inLagos(pickup.lat, pickup.lng) && inLagos(destination.lat, destination.lng)) {
    const toX = (lng: number) => PAD + ((lng - LAG_LNG[0]) / (LAG_LNG[1] - LAG_LNG[0])) * (W - PAD * 2);
    const toY = (lat: number) => H - PAD - ((lat - LAG_LAT[0]) / (LAG_LAT[1] - LAG_LAT[0])) * (H - PAD * 2);
    px = toX(pickup.lng); py = toY(pickup.lat);
    dx = toX(destination.lng); dy = toY(destination.lat);
  } else {
    px = PAD + 20; py = H / 2;
    dx = W - PAD - 20; dy = H / 2;
  }

  const midX = (px + dx) / 2;
  const midY = Math.min(py, dy) - 18;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[10px] border border-slate-200 bg-[#EFF3F8]">
      {/* Subtle grid */}
      {[20, 40, 60, 80].map(y => <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#DDE3EC" strokeWidth="0.5" />)}
      {[60, 120, 180, 240, 280].map(x => <line key={x} x1={x} y1="0" x2={x} y2={H} stroke="#DDE3EC" strokeWidth="0.5" />)}
      {/* Dashed route */}
      <path d={`M${px},${py} Q${midX},${midY} ${dx},${dy}`} stroke="#BE1B2C" strokeWidth="2" strokeDasharray="5,3" fill="none" />
      {/* Pickup (blue circle) */}
      <circle cx={px} cy={py} r="6" fill="#BE1B2C" />
      <circle cx={px} cy={py} r="10" fill="#BE1B2C" fillOpacity="0.15" />
      {/* Destination (red) */}
      <circle cx={dx} cy={dy} r="6" fill="#DC2626" />
      <circle cx={dx} cy={dy} r="10" fill="#DC2626" fillOpacity="0.15" />
      {/* Labels */}
      <text x={px} y={py - 14} textAnchor="middle" fill="#BE1B2C" fontSize="9" fontWeight="600">Pickup</text>
      <text x={dx} y={dy - 14} textAnchor="middle" fill="#DC2626" fontSize="9" fontWeight="600">Drop-off</text>
    </svg>
  );
}

// ─── Vertical timeline ────────────────────────────────────────────────────────

const TIMELINE_STEPS: RideStatus[] = [
  "offer_sent", "offer_accepted", "driver_on_way", "driver_arrived",
  "pickup_confirmed", "ride_started", "completed",
];

function VerticalTimeline({ timeline, status }: { timeline: Ride["timeline"]; status: RideStatus }) {
  const isFinal = ["completed", "cancelled_user", "cancelled_driver", "cancelled_admin", "cancelled", "disputed", "technical_failure"].includes(status);
  const cancelledStatuses: RideStatus[] = ["cancelled_user", "cancelled_driver", "cancelled_admin", "cancelled", "technical_failure"];
  const isCancelled = cancelledStatuses.includes(status);

  const eventMap = new Map(timeline.map(t => [t.status, t]));

  const steps = isCancelled || status === "disputed"
    ? timeline
    : TIMELINE_STEPS.map(s => eventMap.get(s) ?? { status: s, at: "", actor: "" });

  const currentIdx = isFinal
    ? steps.length - 1
    : TIMELINE_STEPS.indexOf(status as RideStatus);

  return (
    <div className="relative pl-6">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-200" />
      {steps.map((step, i) => {
        const done = i <= currentIdx && step.at;
        const active = i === currentIdx && step.at;
        const isDispo = step.status === "disputed";
        const isCancel = cancelledStatuses.includes(step.status as RideStatus);
        return (
          <div key={i} className="flex items-start gap-3 pb-4 last:pb-0">
            <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 -ml-0.5 mt-0.5 border-2 transition-all
              ${active && isDispo ? "bg-orange-500 border-orange-500" : active && isCancel ? "bg-red-500 border-red-500" : active ? "bg-[#BE1B2C] border-[#BE1B2C]" : done ? "bg-[#BE1B2C] border-[#BE1B2C]" : "bg-white border-slate-300"}`}>
              {done && !active && <CheckCircle2 size={11} className="text-white" />}
              {active && !isCancelled && !isDispo && <span className="w-2 h-2 rounded-full bg-white" />}
              {active && (isCancel || isDispo) && <X size={9} className="text-white" />}
              {!done && <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className={`text-xs font-semibold capitalize leading-tight
                ${active && isCancel ? "text-red-700" : active && isDispo ? "text-orange-700" : done ? "text-slate-800" : "text-slate-400"}`}>
                {STATUS_LABEL[step.status as RideStatus] ?? step.status.replace(/_/g, " ")}
              </p>
              {step.at && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {step.actor} · {new Date(step.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {!step.at && <p className="text-[11px] text-slate-300 mt-0.5">Pending</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Confirm action modal ─────────────────────────────────────────────────────

function ConfirmActionModal({
  config, onClose, onConfirm,
}: {
  config: ActionConfig;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const isDanger  = config.variant === "danger";
  const isWarning = config.variant === "warning";

  const handleConfirm = () => {
    if (!reason.trim()) { setError("Please provide a reason before confirming."); return; }
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onConfirm(reason, note);
    }, 1200);
  };

  return (
    <Modal open onClose={onClose} title={config.title}>
      <div className="flex flex-col gap-4">
        {/* Consequence banner */}
        <div className={`flex items-start gap-3 rounded-[10px] p-3.5 border text-sm leading-relaxed
          ${isDanger ? "bg-red-50 border-red-200 text-red-800" : isWarning ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-sky-50 border-sky-200 text-sky-800"}`}>
          <AlertTriangle size={15} className={`shrink-0 mt-0.5 ${isDanger ? "text-red-500" : isWarning ? "text-amber-500" : "text-sky-500"}`} />
          <p>{config.consequence}</p>
        </div>

        {/* Reason field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            {config.requiresNote ? "Note (internal, visible to admins only)" : config.reasonLabel}
            {" "}<span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setError(""); }}
            rows={3}
            placeholder={config.reasonPlaceholder}
            className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none transition-all"
          />
        </div>

        {/* Optional extra note */}
        {config.requiresNote && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-600">Additional context (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Any extra context for the audit record…"
              className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none transition-all"
            />
          </div>
        )}

        {/* Inline error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2">
            <XCircle size={14} className="shrink-0" /> {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant={isDanger ? "danger" : isWarning ? "warning" : config.variant === "secondary" ? "secondary" : "primary"}
            disabled={!reason.trim()}
            loading={loading}
            onClick={handleConfirm}
          >
            {config.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Driver lock badge ────────────────────────────────────────────────────────

function ActiveRideLockBadge({ rideId, lockedAt }: { rideId: string; lockedAt: string }) {
  const lockedMin = Math.floor((Date.now() - new Date(lockedAt).getTime()) / 60000);
  const lockedLabel = lockedMin < 60 ? `${lockedMin}m` : `${Math.floor(lockedMin / 60)}h ${lockedMin % 60}m`;
  return (
    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 text-xs font-semibold text-amber-700">
      <Lock size={11} /> Locked · {rideId} · {lockedLabel}
    </div>
  );
}

// ─── Main RideDetails component ───────────────────────────────────────────────

interface Props {
  ride: Ride;
  onClose: () => void;
}

export default function RideDetails({ ride, onClose }: Props) {
  const navigate = useNavigate();
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [notes, setNotes] = useState(ride.internalNotes);

  const driverBalance = mockDriverPointBalances.find(d => d.driverId === ride.driver.id);
  const driverActiveRide = driverBalance?.activeRideId;
  const driverLockRide   = driverActiveRide && driverActiveRide !== ride.id ? driverActiveRide : null;

  const isActive     = ["offer_sent","offer_accepted","driver_on_way","driver_arrived","pickup_confirmed","ride_started"].includes(ride.status);
  const isCompleted  = ride.status === "completed";
  const isTerminal   = !isActive;

  const duration = ride.startedAt && ride.completedAt
    ? Math.round((new Date(ride.completedAt).getTime() - new Date(ride.startedAt).getTime()) / 60000)
    : null;

  const visibleActions = ACTIONS.filter(a => {
    if (a.id === "cancel_stuck")    return ride.isStuck;
    if (a.id === "release_lock")    return isActive;
    if (a.id === "technical_failure") return isActive;
    if (a.id === "open_dispute")    return isCompleted && !ride.isDisputed;
    if (a.id === "resolve_dispute") return ride.isDisputed;
    if (a.id === "refund_points")   return isTerminal;
    return true; // add_note always visible
  });

  const handleActionConfirm = (actionId: string, reason: string) => {
    const newNote = {
      id: `NOTE-${Date.now()}`,
      text: `[${actionId.replace(/_/g, " ").toUpperCase()}] ${reason}`,
      author: "S. Chen",
      at: new Date().toISOString(),
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveAction(null);
    setToast({ msg: `Action completed and logged to audit trail.`, type: "success" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-[8px] shrink-0">{ride.id}</span>
          <RideStatusBadge status={ride.isStuck ? "stuck" : ride.status} />
          {ride.isStaleLocation && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Stale GPS</span>
          )}
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[8px] transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6">

          {/* ── Urgent banners ── */}
          {ride.isStuck && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] p-4">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Ride is stuck — 4h 30m in current state</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Last GPS update: {ride.lastLocationUpdate ? new Date(ride.lastLocationUpdate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "unknown"}.
                  No further GPS data received. Driver may be unreachable.
                </p>
              </div>
            </div>
          )}
          {ride.isDisputed && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[10px] p-4">
              <AlertOctagon size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Disputed ride</p>
                <p className="text-xs text-amber-700 mt-0.5">{ride.disputeNote}</p>
              </div>
            </div>
          )}
          {driverLockRide && (
            <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-[10px] p-4">
              <Lock size={15} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-700">Driver locked to another active ride</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {ride.driver.name} is already on ride{" "}
                  <button onClick={() => { onClose(); navigate(`/rides/live?selected=${driverLockRide}`); }}
                    className="font-mono text-[#BE1B2C] hover:underline">{driverLockRide}</button>.
                  New offer creation for this driver is blocked.
                </p>
              </div>
            </div>
          )}

          {/* ── Participants ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Driver card */}
            <div className="bg-slate-50 rounded-[12px] p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <Car size={12} className="text-slate-400" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Driver</p>
              </div>
              <div className="flex items-center gap-2.5 mt-2 mb-3">
                <Avatar initials={ride.driver.avatar} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{ride.driver.name}</p>
                  <p className="text-[11px] font-mono text-slate-400">{ride.driver.id}</p>
                </div>
              </div>
              {driverBalance?.activeRideId === ride.id && (
                <ActiveRideLockBadge rideId={ride.id} lockedAt={ride.startedAt ?? ride.createdAt} />
              )}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone size={11} className="shrink-0" />
                  <span className="font-mono">{ride.driver.phone}</span>
                </div>
                {driverBalance && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Star size={11} className="shrink-0" />
                    <span>{driverBalance.available} pts available · {driverBalance.reserved} reserved</span>
                  </div>
                )}
              </div>
              <button onClick={() => navigate(`/drivers`)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
                Driver profile <ChevronRight size={11} />
              </button>
            </div>

            {/* Passenger card */}
            <div className="bg-slate-50 rounded-[12px] p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-1">
                <User size={12} className="text-slate-400" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Passenger</p>
              </div>
              <div className="flex items-center gap-2.5 mt-2 mb-3">
                <Avatar initials={ride.user.avatar} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{ride.user.name}</p>
                  <p className="text-[11px] font-mono text-slate-400">{ride.user.id}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone size={11} className="shrink-0" />
                  <span className="font-mono">{ride.user.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin size={11} className="shrink-0" />
                  <span className="truncate">{ride.pickup.address}</span>
                </div>
              </div>
              <button onClick={() => navigate(`/users`)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
                User profile <ChevronRight size={11} />
              </button>
            </div>
          </div>

          {/* ── Route map ── */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Route</p>
            <MiniRouteMap pickup={ride.pickup} destination={ride.destination} />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-50 rounded-[10px] p-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Pickup</p>
                <p className="text-xs text-slate-700 mt-1 leading-snug">{ride.pickup.address}</p>
              </div>
              <div className="bg-slate-50 rounded-[10px] p-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Drop-off</p>
                <p className="text-xs text-slate-700 mt-1 leading-snug">{ride.destination.address}</p>
              </div>
            </div>
          </div>

          {/* ── Trip Offer & fare ── */}
          <div className="bg-slate-50 rounded-[12px] p-4 border border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Trip Offer & Fare</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Offer ID",       value: ride.offerId },
                { label: "Vehicle Type",   value: ride.vehicleType.charAt(0).toUpperCase() + ride.vehicleType.slice(1) },
                { label: "Fare (NGN)",     value: ride.fareNGN > 0 ? `₦${ride.fareNGN.toLocaleString()}` : "—" },
                { label: "Points Charged", value: ride.pointsCharged > 0 ? `${ride.pointsCharged} pts` : "—" },
                { label: "Points Reserved",value: `${ride.pointsReserved} pts` },
                { label: "Distance",       value: ride.distanceKm ? `${ride.distanceKm} km` : "—" },
                { label: "ETA",            value: ride.eta !== null ? `${ride.eta} min` : "—" },
                { label: "Duration",       value: duration !== null ? `${duration} min` : "—" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-[8px] p-2.5">
                  <p className="text-[10px] text-slate-400">{s.label}</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── GPS / timestamps ── */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Timestamps</p>
            <div className="rounded-[10px] border border-slate-200 divide-y divide-slate-100">
              <StatRow label="Created"    value={formatTs(ride.createdAt)} />
              {ride.startedAt   && <StatRow label="Started"    value={formatTs(ride.startedAt)} />}
              {ride.completedAt && <StatRow label="Completed"  value={formatTs(ride.completedAt)} />}
              {ride.cancelledAt && <StatRow label="Cancelled"  value={formatTs(ride.cancelledAt)} />}
              <StatRow label="Last GPS"
                value={
                  <span className={ride.isStaleLocation ? "text-red-600 font-semibold" : undefined}>
                    {ride.lastLocationUpdate ? formatTs(ride.lastLocationUpdate) : "No data"}
                    {ride.isStaleLocation && " ⚠"}
                  </span>
                }
              />
              {ride.cancelReason && <StatRow label="Cancel Reason" value={ride.cancelReason} />}
              {ride.cancelledBy  && <StatRow label="Cancelled By"  value={ride.cancelledBy} />}
            </div>
          </div>

          {/* ── Ride timeline ── */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ride Timeline</p>
            <VerticalTimeline timeline={ride.timeline} status={ride.status} />
          </div>

          {/* ── Internal notes ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Internal Notes</p>
              <button
                onClick={() => setActiveAction(ACTIONS.find(a => a.id === "add_note")!)}
                className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
                <MessageSquare size={11} /> Add note
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No internal notes yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {notes.map(n => (
                  <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-[10px] p-3.5">
                    <p className="text-xs text-slate-700 leading-relaxed">{n.text}</p>
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <Clock size={9} /> {n.author} · {formatTs(n.at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Admin actions ── */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Admin Actions</p>
            <div className="flex flex-col gap-2">
              {visibleActions.map(action => {
                const isDanger  = action.variant === "danger";
                const isWarning = action.variant === "warning";
                const ActionIcon = isDanger ? XCircle : isWarning ? AlertTriangle : action.id === "release_lock" ? Unlock : action.id === "refund_points" ? RefreshCw : action.id === "resolve_dispute" ? CheckCircle2 : FileText;
                return (
                  <button key={action.id} onClick={() => setActiveAction(action)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-[10px] border text-left w-full transition-all hover:shadow-sm
                      ${isDanger ? "bg-red-50 border-red-200 hover:bg-red-100 text-red-700" : isWarning ? "bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-700" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"}`}>
                    <ActionIcon size={14} className="shrink-0" />
                    <span className="text-sm font-semibold">{action.label}</span>
                    <ChevronRight size={13} className="ml-auto text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audit log link */}
          <div className="pb-4">
            <button
              onClick={() => navigate("/audit-logs")}
              className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-[#BE1B2C] transition-colors">
              <FileText size={12} /> View full audit log for this ride
              <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Action modal */}
      {activeAction && (
        <ConfirmActionModal
          config={activeAction}
          onClose={() => setActiveAction(null)}
          onConfirm={(reason, note) => handleActionConfirm(activeAction.id, reason + (note ? `\n\nNote: ${note}` : ""))}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
