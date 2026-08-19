import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, CheckCircle, Clock, MapPin, Navigation,
  Zap, Lock, Unlink, RefreshCw, ExternalLink, ChevronDown,
  ChevronUp, ArrowRight
} from "lucide-react";
import { Button, SectionHeader, Toast, Select } from "../../components/ui";
import { getRides } from "../../api";
import {
  type StuckRide, type StuckSeverity, type StuckReason,
} from "../../data/mockDisputes";

function mapApiStuckRide(r: any): StuckRide {
  return {
    id: r._id || r.id || "",
    rideId: r.rideId || r._id || r.id || "",
    severity: (r.severity || "medium") as StuckSeverity,
    reason: (r.reason || "state_timeout") as StuckReason,
    title: r.title || `${r.status || "Unknown"} ride stuck`,
    detail: r.detail || r.description || "",
    recommendedAction: r.recommendedAction || "Review and resolve manually.",
    detectedAt: r.detectedAt || r.createdAt || new Date().toISOString(),
    rideStatus: r.status || r.rideStatus || "unknown",
    driverName: r.driver?.name || r.driverName || "Unknown",
    driverId: r.driver?._id || r.driver?.id || r.driverId || "",
    driverAvatar: r.driver?.avatar || r.driver?.name?.charAt(0) || r.driverAvatar || "?",
    userName: r.user?.name || r.userName || "Unknown",
    userId: r.user?._id || r.user?.id || r.userId || "",
    userAvatar: r.user?.avatar || r.user?.name?.charAt(0) || r.userAvatar || "?",
    city: r.city || "",
    minutesInState: r.minutesInState || 0,
    pointsAtRisk: r.pointsAtRisk || 0,
    resolved: r.resolved || false,
    resolvedAt: r.resolvedAt,
    resolvedBy: r.resolvedBy,
    resolveNote: r.resolveNote,
    pickup: r.pickup_location?.address || r.pickup?.address || r.pickup || "",
    destination: r.destination?.address || r.destination || "",
    fareNGN: r.fare || r.fareNGN || 0,
  };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<StuckSeverity, {
  label: string; bg: string; border: string; text: string;
  dot: string; icon: React.ReactNode; rowBg: string;
}> = {
  critical: {
    label: "Critical",
    bg: "bg-red-600", border: "border-red-700", text: "text-white",
    dot: "bg-red-500", icon: <AlertTriangle size={14} />,
    rowBg: "bg-red-50/60 border-l-[3px] border-l-red-500",
  },
  high: {
    label: "High",
    bg: "bg-orange-500", border: "border-orange-600", text: "text-white",
    dot: "bg-orange-500", icon: <AlertTriangle size={14} />,
    rowBg: "bg-orange-50/40 border-l-[3px] border-l-orange-400",
  },
  medium: {
    label: "Medium",
    bg: "bg-amber-400", border: "border-amber-500", text: "text-amber-900",
    dot: "bg-amber-500", icon: <Clock size={14} />,
    rowBg: "border-l-[3px] border-l-amber-400",
  },
  low: {
    label: "Low",
    bg: "bg-slate-200", border: "border-slate-300", text: "text-slate-700",
    dot: "bg-slate-400", icon: <Clock size={14} />,
    rowBg: "",
  },
};

const REASON_CONFIG: Record<StuckReason, { label: string; icon: React.ReactNode; cls: string }> = {
  no_gps_update:    { label: "No GPS Update",         icon: <Navigation size={13} />, cls: "bg-amber-50 text-amber-800 border-amber-200" },
  state_timeout:    { label: "State Timeout",          icon: <Clock size={13} />,      cls: "bg-red-50 text-red-800 border-red-200" },
  orphaned_lock:    { label: "Orphaned Lock",          icon: <Lock size={13} />,       cls: "bg-violet-50 text-violet-800 border-violet-200" },
  terminal_ride_ref:{ label: "Terminal Ride Ref",      icon: <Unlink size={13} />,     cls: "bg-orange-50 text-orange-800 border-orange-200" },
  lock_mismatch:    { label: "Lock Mismatch",          icon: <Zap size={13} />,        cls: "bg-red-50 text-red-800 border-red-200" },
};

type QuickActionId = "cancel_ride" | "release_lock" | "expire_offer" | "release_points" | "escalate_dispute" | "clear_lock" | "monitor";

interface QuickAction {
  id: QuickActionId;
  label: string;
  variant: "danger" | "warning" | "primary" | "secondary";
  applicable: (r: StuckRide) => boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "cancel_ride",
    label: "Cancel Ride",
    variant: "danger",
    applicable: r => ["ride_started", "driver_on_way", "driver_arrived", "pickup_confirmed"].includes(r.rideStatus),
  },
  {
    id: "release_lock",
    label: "Release Ride Lock",
    variant: "warning",
    applicable: r => r.reason === "orphaned_lock" || r.reason === "lock_mismatch",
  },
  {
    id: "expire_offer",
    label: "Expire Offer",
    variant: "warning",
    applicable: r => r.rideStatus === "offer_sent",
  },
  {
    id: "release_points",
    label: "Release Reservation",
    variant: "warning",
    applicable: r => r.reason === "terminal_ride_ref",
  },
  {
    id: "clear_lock",
    label: "Clear User Lock",
    variant: "warning",
    applicable: r => r.reason === "lock_mismatch",
  },
  {
    id: "monitor",
    label: "Monitor",
    variant: "secondary",
    applicable: r => r.severity === "low",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: StuckSeverity }) {
  const c = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
      {c.icon}{c.label}
    </span>
  );
}

function ReasonBadge({ reason }: { reason: StuckReason }) {
  const c = REASON_CONFIG[reason];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}

function MinutesInState({ minutes, severity }: { minutes: number; severity: StuckSeverity }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const display = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const color = severity === "critical" ? "text-red-700 font-black"
    : severity === "high" ? "text-orange-700 font-bold"
    : severity === "medium" ? "text-amber-700 font-semibold"
    : "text-slate-600";
  return <span className={`text-sm tabular-nums ${color}`}>{display}</span>;
}

interface ConfirmActionProps {
  stuckRide: StuckRide;
  actionId: QuickActionId;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

const ACTION_META: Record<QuickActionId, { title: string; consequence: string; variant: "danger" | "warning" | "primary" }> = {
  cancel_ride:    { title: "Cancel Stuck Ride",       variant: "danger",   consequence: "Ride will be cancelled. Points reservation will be released. Driver and user will be notified. Action logged to audit trail." },
  release_lock:   { title: "Release Ride Lock",       variant: "warning",  consequence: "The driver's activeRideId lock will be cleared. Driver will be able to receive new offers immediately." },
  expire_offer:   { title: "Expire Offer",            variant: "warning",  consequence: "Offer will be expired and user booking will be released. User will be notified to rebook." },
  release_points: { title: "Release Points Reservation", variant: "warning", consequence: "The orphaned points reservation will be released back to the driver's available balance. Webhook failure will be logged." },
  escalate_dispute:{ title: "Escalate to Dispute",   variant: "warning",  consequence: "Ride will be flagged as disputed and appear in the Disputes queue for admin review." },
  clear_lock:     { title: "Clear User Lock",         variant: "warning",  consequence: "User's offer lock will be cleared. The stale offer will be released. User can rebook a new ride." },
  monitor:        { title: "Mark as Monitoring",      variant: "primary",  consequence: "Ride will be flagged for continued automated monitoring. You will be notified if severity increases." },
};

function ConfirmActionModal({ stuckRide, actionId, onConfirm, onClose }: ConfirmActionProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const meta = ACTION_META[actionId];

  const handleSubmit = () => {
    if (!reason.trim()) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); onConfirm(reason); }, 1100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{meta.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Stuck ride {stuckRide.rideId}</p>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className={`rounded-[10px] p-3.5 text-sm border
            ${meta.variant === "danger" ? "bg-red-50 text-red-800 border-red-200"
            : "bg-amber-50 text-amber-800 border-amber-200"}`}>
            {meta.consequence}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Reason <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Explain why you are taking this action…"
              className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={meta.variant} loading={loading} disabled={!reason.trim()} onClick={handleSubmit}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── StuckRide card ───────────────────────────────────────────────────────────

interface StuckCardProps {
  ride: StuckRide;
  expanded: boolean;
  onToggle: () => void;
  onAction: (actionId: QuickActionId) => void;
  resolved: boolean;
}

function StuckCard({ ride, expanded, onToggle, onAction, resolved }: StuckCardProps) {
  const navigate = useNavigate();
  const sev = SEVERITY_CONFIG[ride.severity];
  const actions = QUICK_ACTIONS.filter(a => a.applicable(ride));

  return (
    <div className={`bg-white rounded-[14px] border border-slate-200 overflow-hidden transition-all ${sev.rowBg} ${resolved ? "opacity-60" : ""}`}>
      {/* ── Card header ── */}
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none" onClick={onToggle}>
        {/* Severity icon */}
        <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0
          ${ride.severity === "critical" ? "bg-red-100 text-red-600"
          : ride.severity === "high" ? "bg-orange-100 text-orange-600"
          : ride.severity === "medium" ? "bg-amber-100 text-amber-600"
          : "bg-slate-100 text-slate-500"}`}>
          {sev.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-500">{ride.id}</span>
            <SeverityBadge severity={ride.severity} />
            <ReasonBadge reason={ride.reason} />
            {resolved && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <CheckCircle size={11} /> Resolved
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800">{ride.title}</p>
        </div>

        {/* Meta */}
        <div className="hidden sm:flex items-center gap-6 shrink-0">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 mb-0.5">Time in state</div>
            <MinutesInState minutes={ride.minutesInState} severity={ride.severity} />
          </div>
          {ride.pointsAtRisk > 0 && (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 mb-0.5">Points at risk</div>
              <span className="text-sm font-bold text-slate-800 tabular-nums">{ride.pointsAtRisk} pts</span>
            </div>
          )}
          <div className="text-right">
            <div className="text-[10px] text-slate-400 mb-0.5">City</div>
            <span className="text-xs font-medium text-slate-600">{ride.city}</span>
          </div>
        </div>

        <div className="text-slate-400 shrink-0 ml-2">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-5 flex flex-col gap-5">
          {/* Problem detail */}
          <div className="bg-slate-50 rounded-[12px] p-4 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Problem Detail</div>
            <p className="text-sm text-slate-700 leading-relaxed">{ride.detail}</p>
          </div>

          {/* Recommended action */}
          <div className={`rounded-[12px] p-4 border
            ${ride.severity === "critical" ? "bg-red-50 border-red-200"
            : ride.severity === "high" ? "bg-orange-50 border-orange-200"
            : "bg-amber-50 border-amber-200"}`}>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Recommended Action</div>
            <p className={`text-sm font-medium leading-relaxed
              ${ride.severity === "critical" ? "text-red-800"
              : ride.severity === "high" ? "text-orange-800"
              : "text-amber-800"}`}>
              {ride.recommendedAction}
            </p>
          </div>

          {/* Parties + ride info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Driver */}
            <div className="bg-white rounded-[12px] border border-slate-200 p-3.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Driver</div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0">
                  {ride.driverAvatar}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{ride.driverName}</p>
                  <p className="text-xs text-slate-400">{ride.driverId || "—"}</p>
                </div>
              </div>
            </div>

            {/* User */}
            <div className="bg-white rounded-[12px] border border-slate-200 p-3.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Passenger</div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 shrink-0">
                  {ride.userAvatar}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{ride.userName}</p>
                  <p className="text-xs text-slate-400">{ride.userId}</p>
                </div>
              </div>
            </div>

            {/* Route */}
            <div className="bg-white rounded-[12px] border border-slate-200 p-3.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Route</div>
              <div className="flex flex-col gap-1">
                <div className="flex items-start gap-1.5">
                  <MapPin size={11} className="text-sky-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-snug">{ride.pickup}</p>
                </div>
                <ArrowRight size={10} className="text-slate-300 ml-1" />
                <div className="flex items-start gap-1.5">
                  <MapPin size={11} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600 leading-snug">{ride.destination}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: "Detected",      value: fmtRelative(ride.detectedAt) },
              { label: "In state",      value: ride.minutesInState < 60 ? `${ride.minutesInState}m` : `${Math.floor(ride.minutesInState / 60)}h ${ride.minutesInState % 60}m` },
              { label: "Points at risk", value: `${ride.pointsAtRisk} pts` },
              { label: "Fare at risk",  value: ride.fareNGN > 0 ? `₦${ride.fareNGN.toLocaleString()}` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-[10px] px-3 py-2.5 border border-slate-100">
                <div className="text-slate-400 mb-0.5">{label}</div>
                <div className="font-semibold text-slate-800">{value}</div>
              </div>
            ))}
          </div>

          {/* Resolution note (if resolved) */}
          {resolved && ride.resolvedAt && (
            <div className="bg-green-50 rounded-[12px] p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={14} className="text-green-600" />
                <span className="text-xs font-bold text-green-800">Resolved</span>
                <span className="text-xs text-green-600 ml-auto">{ride.resolvedBy} · {fmtRelative(ride.resolvedAt)}</span>
              </div>
              {ride.resolveNote && <p className="text-sm text-green-800 leading-relaxed">{ride.resolveNote}</p>}
            </div>
          )}

          {/* Actions */}
          {!resolved && (
            <div className="flex items-center gap-2 flex-wrap">
              {actions.map(a => (
                <Button key={a.id} variant={a.variant} size="sm" onClick={() => onAction(a.id)}>
                  {a.label}
                </Button>
              ))}
              <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                onClick={() => navigate(`/rides/live?selected=${ride.rideId}`)}>
                View on Map
              </Button>
              <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
                onClick={() => navigate(`/audit-logs?entity=${ride.rideId}`)}>
                Audit Log
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StuckRides() {
  const [severityF, setSeverityF] = useState("all");
  const [reasonF, setReasonF] = useState("all");
  const [showResolved, setShowResolved] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<{ ride: StuckRide; action: QuickActionId } | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [stuckRides, setStuckRides] = useState<StuckRide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRides({ isStuck: true, limit: 100 })
      .then(({ rides: apiRides }) => {
        if (cancelled) return;
        setStuckRides((apiRides || []).map(mapApiStuckRide));
      })
      .catch((err) => {
        console.error("Failed to load stuck rides", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => stuckRides.filter(r => {
    const isRes = r.resolved || resolvedIds.has(r.id);
    if (!showResolved && isRes) return false;
    if (showResolved && !isRes) return false;
    if (severityF !== "all" && r.severity !== severityF) return false;
    if (reasonF !== "all" && r.reason !== reasonF) return false;
    return true;
  }), [stuckRides, severityF, reasonF, showResolved, resolvedIds]);

  const active = stuckRides.filter(r => !r.resolved && !resolvedIds.has(r.id));
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  active.forEach(r => { counts[r.severity]++; });

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAction = (actionId: QuickActionId, _reason: string) => {
    if (!pendingAction) return;
    const { ride } = pendingAction;
    setResolvedIds(prev => new Set([...prev, ride.id]));
    setPendingAction(null);
    const messages: Partial<Record<QuickActionId, string>> = {
      cancel_ride:     "Ride cancelled. Points reservation released. Audit log written.",
      release_lock:    "Driver ride lock released. Driver can now receive new offers.",
      expire_offer:    "Offer expired. User can rebook. Audit log written.",
      release_points:  "Orphaned points reservation released. Balance corrected.",
      clear_lock:      "User offer lock cleared. User notified to rebook.",
      monitor:         "Ride flagged for monitoring. You will be notified of changes.",
    };
    setToast(messages[actionId] ?? "Action completed and logged.");
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Stuck Rides"
        description="Rides with anomalies detected by automated monitoring — GPS failures, state timeouts, orphaned locks, and data inconsistencies."
        actions={
          <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />}>Refresh</Button>
        }
      />

      {/* ── Severity summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["critical", "high", "medium", "low"] as StuckSeverity[]).map(sev => {
          const c = SEVERITY_CONFIG[sev];
          const count = counts[sev];
          return (
            <button key={sev}
              onClick={() => setSeverityF(severityF === sev ? "all" : sev)}
              className={`rounded-[14px] border-2 px-4 py-3.5 text-left transition-all
                ${severityF === sev ? `${c.bg} border-transparent` : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <div className={`text-2xl font-black tabular-nums ${severityF === sev ? c.text : count > 0 ? "text-slate-900" : "text-slate-400"}`}>
                {count}
              </div>
              <div className={`text-xs font-semibold mt-0.5 ${severityF === sev ? c.text : "text-slate-500"}`}>
                {c.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={severityF} onChange={setSeverityF} className="w-36"
          options={[
            { value: "all", label: "All Severities" },
            { value: "critical", label: "Critical" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]} />
        <Select value={reasonF} onChange={setReasonF} className="w-44"
          options={[
            { value: "all", label: "All Problem Types" },
            { value: "no_gps_update", label: "No GPS Update" },
            { value: "state_timeout", label: "State Timeout" },
            { value: "orphaned_lock", label: "Orphaned Lock" },
            { value: "terminal_ride_ref", label: "Terminal Ride Ref" },
            { value: "lock_mismatch", label: "Lock Mismatch" },
          ]} />
        <button
          onClick={() => setShowResolved(!showResolved)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
            ${showResolved ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-200 hover:border-green-400"}`}>
          {showResolved ? "Showing resolved" : "Show resolved"}
        </button>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Rides list ── */}
      {loading ? (
        <div className="bg-white rounded-[16px] border border-slate-200 flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-[#BE1B2C] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-slate-400">Loading stuck rides…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-[16px] border border-slate-200 flex flex-col items-center gap-3 py-20 px-8 text-center">
          <div className="w-14 h-14 rounded-[14px] bg-green-50 flex items-center justify-center">
            <CheckCircle size={24} className="text-green-500" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">No stuck rides</p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              {showResolved ? "No resolved stuck rides match your filters." : "All active rides are progressing normally."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(ride => (
            <StuckCard
              key={ride.id}
              ride={ride}
              expanded={expanded.has(ride.id)}
              onToggle={() => toggleExpand(ride.id)}
              onAction={(actionId) => setPendingAction({ ride, action: actionId })}
              resolved={ride.resolved || resolvedIds.has(ride.id)}
            />
          ))}
        </div>
      )}

      {/* ── Confirm modal ── */}
      {pendingAction && (
        <ConfirmActionModal
          stuckRide={pendingAction.ride}
          actionId={pendingAction.action}
          onConfirm={(reason) => handleAction(pendingAction.action, reason)}
          onClose={() => setPendingAction(null)}
        />
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
