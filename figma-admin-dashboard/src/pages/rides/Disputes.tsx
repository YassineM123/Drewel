import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search, X, ChevronRight,
  MessageSquare, Phone, ArrowUpRight, CheckCircle,
  XCircle, Clock, User, Car, Shield, Flag, Download, ExternalLink,
  RefreshCw
} from "lucide-react";
import {
  Card, Button, SectionHeader, Th, Td, Tr, Pagination, Avatar,
  Select, EmptyState, Drawer, Toast, TabBar
} from "../../components/ui";
import {
  mockDisputes,
  type Dispute,
  type DisputeStatus,
  type DisputePriority,
  type DisputeReason,
  type ResolutionDecision,
} from "../../data/mockDisputes";

// ─── Constants ────────────────────────────────────────────────────────────────

type TabId = "open" | "under_review" | "waiting_user" | "waiting_driver" | "resolved" | "rejected";

const TABS: { id: TabId; label: string }[] = [
  { id: "open",           label: "Open" },
  { id: "under_review",   label: "Under Review" },
  { id: "waiting_user",   label: "Waiting for User" },
  { id: "waiting_driver", label: "Waiting for Driver" },
  { id: "resolved",       label: "Resolved" },
  { id: "rejected",       label: "Rejected" },
];

const REASON_LABELS: Record<DisputeReason, string> = {
  overcharge: "Overcharge",
  route_deviation: "Route Deviation",
  driver_misconduct: "Driver Misconduct",
  no_show: "No Show",
  safety_concern: "Safety Concern",
  payment_issue: "Payment Issue",
  app_malfunction: "App Malfunction",
  driver_cancelled: "Driver Cancelled",
  trip_not_completed: "Trip Not Completed",
};

const PRIORITY_CONFIG: Record<DisputePriority, { label: string; cls: string; dot: string }> = {
  critical: { label: "Critical", cls: "bg-red-100 text-red-800 border border-red-200",   dot: "bg-red-500" },
  high:     { label: "High",     cls: "bg-orange-100 text-orange-800 border border-orange-200", dot: "bg-orange-500" },
  medium:   { label: "Medium",   cls: "bg-amber-50 text-amber-800 border border-amber-200",   dot: "bg-amber-500" },
  low:      { label: "Low",      cls: "bg-slate-100 text-slate-600 border border-slate-200",   dot: "bg-slate-400" },
};

const STATUS_CONFIG: Record<DisputeStatus, { label: string; cls: string }> = {
  open:            { label: "Open",                cls: "bg-red-50 text-red-700 border border-red-200" },
  under_review:    { label: "Under Review",        cls: "bg-sky-50 text-sky-700 border border-sky-200" },
  waiting_user:    { label: "Waiting for User",    cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  waiting_driver:  { label: "Waiting for Driver",  cls: "bg-violet-50 text-violet-700 border border-violet-200" },
  resolved:        { label: "Resolved",            cls: "bg-green-50 text-green-700 border border-green-200" },
  rejected:        { label: "Rejected",            cls: "bg-slate-100 text-slate-500 border border-slate-200" },
};

const DECISION_CONFIG: Record<ResolutionDecision, { label: string; cls: string }> = {
  user:     { label: "Resolved for User",   cls: "text-green-700" },
  driver:   { label: "Resolved for Driver", cls: "text-sky-700" },
  split:    { label: "Split Decision",      cls: "text-violet-700" },
  rejected: { label: "Rejected",            cls: "text-slate-600" },
};

type ActionId =
  | "request_info"
  | "assign_admin"
  | "refund_points"
  | "resolve_driver"
  | "resolve_user"
  | "reject"
  | "escalate";

interface ActionConfig {
  id: ActionId;
  label: string;
  variant: "primary" | "secondary" | "danger" | "warning";
  icon: React.ReactNode;
  consequence: string;
  requiresReason: boolean;
  confirmLabel: string;
}

const ACTIONS: ActionConfig[] = [
  {
    id: "request_info",
    label: "Request More Information",
    variant: "secondary",
    icon: <MessageSquare size={14} />,
    consequence: "Dispute status will be updated and a message will be sent to both parties requesting additional information.",
    requiresReason: true,
    confirmLabel: "Send Request",
  },
  {
    id: "assign_admin",
    label: "Assign Admin",
    variant: "secondary",
    icon: <User size={14} />,
    consequence: "This dispute will be assigned to the specified admin for investigation.",
    requiresReason: false,
    confirmLabel: "Assign",
  },
  {
    id: "refund_points",
    label: "Refund Points",
    variant: "warning",
    icon: <ArrowUpRight size={14} />,
    consequence: "Specified points will be refunded to the user's balance. This action is logged to the immutable audit trail.",
    requiresReason: true,
    confirmLabel: "Confirm Refund",
  },
  {
    id: "resolve_driver",
    label: "Resolve for Driver",
    variant: "primary",
    icon: <Car size={14} />,
    consequence: "Dispute will be marked resolved in driver's favour. No refund issued. Both parties will be notified. This decision is permanent and logged.",
    requiresReason: true,
    confirmLabel: "Resolve for Driver",
  },
  {
    id: "resolve_user",
    label: "Resolve for User",
    variant: "primary",
    icon: <User size={14} />,
    consequence: "Dispute will be marked resolved in user's favour. Points will be refunded. Both parties will be notified. This decision is permanent and logged.",
    requiresReason: true,
    confirmLabel: "Resolve for User",
  },
  {
    id: "reject",
    label: "Reject Dispute",
    variant: "danger",
    icon: <XCircle size={14} />,
    consequence: "Dispute will be permanently closed with no action taken. Both parties will be notified. This decision cannot be reversed.",
    requiresReason: true,
    confirmLabel: "Reject Dispute",
  },
  {
    id: "escalate",
    label: "Escalate",
    variant: "warning",
    icon: <Flag size={14} />,
    consequence: "Dispute priority will be raised to Critical and it will be flagged for senior admin review. An escalation note will be logged.",
    requiresReason: true,
    confirmLabel: "Escalate",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: DisputePriority }) {
  const c = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: DisputeStatus }) {
  const c = STATUS_CONFIG[status];
  return <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
}

function ReasonBadge({ reason }: { reason: DisputeReason }) {
  return (
    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      {REASON_LABELS[reason] ?? reason}
    </span>
  );
}

function EvidencePill({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border
      ${active ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-400 border-slate-200 line-through"}`}>
      {icon}{label}
    </span>
  );
}

function TimelineEntry({ status, at, actor }: { status: string; at: string; actor: string }) {
  return (
    <div className="flex items-start gap-3 pb-3 last:pb-0">
      <div className="w-2 h-2 rounded-full bg-[#BE1B2C] relative z-10 mt-1.5 shrink-0" />
      <div>
        <p className="text-xs font-medium text-slate-700 capitalize">{status.replace(/_/g, " ")}</p>
        <p className="text-xs text-slate-400">{actor} · {fmtTs(at)}</p>
      </div>
    </div>
  );
}

// ─── Dispute Detail Drawer ────────────────────────────────────────────────────

interface ConfirmModalProps {
  action: ActionConfig | null;
  dispute: Dispute;
  onConfirm: (reason: string, extra: string) => void;
  onClose: () => void;
}

function ConfirmModal({ action, dispute, onConfirm, onClose }: ConfirmModalProps) {
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);

  if (!action) return null;

  const isDanger = action.variant === "danger";
  const isWarning = action.variant === "warning";

  const handleSubmit = () => {
    if (action.requiresReason && !reason.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onConfirm(reason, extra);
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center
              ${isDanger ? "bg-red-100" : isWarning ? "bg-amber-100" : "bg-blue-100"}`}>
              <span className={isDanger ? "text-red-600" : isWarning ? "text-amber-600" : "text-[#BE1B2C]"}>
                {action.icon}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{action.label}</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">Dispute {dispute.id} · Ride {dispute.rideId}</p>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className={`rounded-[10px] p-3.5 text-sm
            ${isDanger ? "bg-red-50 text-red-800 border border-red-200"
            : isWarning ? "bg-amber-50 text-amber-800 border border-amber-200"
            : "bg-sky-50 text-sky-800 border border-sky-200"}`}>
            {action.consequence}
          </div>

          {action.id === "assign_admin" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Assign to admin <span className="text-red-500">*</span></label>
              <select value={extra} onChange={e => setExtra(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400">
                <option value="">Select admin…</option>
                <option value="Sarah Eze">Sarah Eze</option>
                <option value="Tobi Olatunji">Tobi Olatunji</option>
                <option value="Mohammed Ibrahim">Mohammed Ibrahim</option>
                <option value="Amara Nwosu">Amara Nwosu</option>
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={4}
                placeholder="Provide your reasoning for this action…"
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none"
              />
            </div>
          )}

          {action.id === "refund_points" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Points to refund</label>
              <input
                type="number"
                value={extra}
                onChange={e => setExtra(e.target.value)}
                min={1}
                max={dispute.pointsInvolved}
                placeholder={`Max ${dispute.pointsInvolved} pts`}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400"
              />
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={action.variant}
            loading={loading}
            disabled={action.requiresReason && !reason.trim() && action.id !== "assign_admin"}
            onClick={handleSubmit}
          >
            {action.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DisputeDetail({ dispute }: { dispute: Dispute }) {
  const navigate = useNavigate();
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState(dispute.internalNotes);

  const isTerminal = dispute.status === "resolved" || dispute.status === "rejected";

  const visibleActions: ActionConfig[] = ACTIONS.filter(a => {
    if (isTerminal) return false;
    if (a.id === "escalate" && dispute.priority === "critical") return false;
    if (a.id === "resolve_driver" && dispute.status === "rejected") return false;
    if (a.id === "resolve_user" && dispute.status === "rejected") return false;
    return true;
  });

  const handleConfirm = (reason: string, extra: string) => {
    const action = activeAction!;
    const note = {
      id: `N${Date.now()}`,
      text: `${action.label}: ${reason}${extra ? ` (${extra})` : ""}`,
      author: "Admin (you)",
      at: new Date().toISOString(),
      type: "action" as const,
    };
    setLocalNotes(prev => [...prev, note]);
    setActiveAction(null);
    const messages: Partial<Record<ActionId, string>> = {
      request_info: "Information request sent to both parties.",
      assign_admin: `Dispute assigned to ${extra}.`,
      refund_points: `${extra || dispute.pointsInvolved} points refunded. Audit log updated.`,
      resolve_driver: "Resolved in driver's favour. Both parties notified.",
      resolve_user: "Resolved in user's favour. Refund processed.",
      reject: "Dispute rejected and closed.",
      escalate: "Dispute escalated to Critical priority.",
    };
    setToast(messages[action.id] ?? "Action recorded.");
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-slate-100 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-sm font-bold text-slate-900">{dispute.id}</span>
              <StatusBadge status={dispute.status} />
              <PriorityBadge priority={dispute.priority} />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ReasonBadge reason={dispute.reason} />
              <span>·</span>
              <span>Ride {dispute.rideId}</span>
              <span>·</span>
              <span>{dispute.city}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" icon={<ExternalLink size={13} />}
              onClick={() => navigate(`/audit-logs?entity=${dispute.id}`)}>
              Audit Log
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-5 flex flex-col gap-6">
        {/* ── Resolution banner ── */}
        {dispute.resolution && (
          <div className={`rounded-[12px] p-4 border
            ${dispute.resolution.decision === "rejected"
              ? "bg-slate-50 border-slate-200"
              : "bg-green-50 border-green-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              {dispute.resolution.decision === "rejected"
                ? <XCircle size={16} className="text-slate-500" />
                : <CheckCircle size={16} className="text-green-600" />}
              <span className={`text-sm font-bold ${DECISION_CONFIG[dispute.resolution.decision].cls}`}>
                {DECISION_CONFIG[dispute.resolution.decision].label}
              </span>
              {dispute.resolution.pointsRefunded !== undefined && (
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full ml-1">
                  +{dispute.resolution.pointsRefunded} pts refunded
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{dispute.resolution.reason}</p>
            <p className="text-xs text-slate-400 mt-1.5">{dispute.resolution.by} · {fmtTs(dispute.resolution.at)}</p>
          </div>
        )}

        {/* ── Parties ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-[12px] p-3.5 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Passenger</div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 shrink-0">
                {dispute.user.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{dispute.user.name}</p>
                <p className="text-xs text-slate-400">{dispute.user.phone}</p>
              </div>
            </div>
            <div className="mt-2 text-xs">
              <span className={`font-medium ${dispute.reportedBy === "user" ? "text-red-600" : "text-slate-400"}`}>
                {dispute.reportedBy === "user" ? "← Raised dispute" : "Responding party"}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-[12px] p-3.5 border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Driver</div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0">
                {dispute.driver.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{dispute.driver.name}</p>
                <p className="text-xs text-slate-400">{dispute.driver.phone}</p>
              </div>
            </div>
            <div className="mt-2 text-xs">
              <span className={`font-medium ${dispute.reportedBy === "driver" ? "text-red-600" : "text-slate-400"}`}>
                {dispute.reportedBy === "driver" ? "← Raised dispute" : "Responding party"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Ride summary ── */}
        <section>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ride Summary</h4>
          <div className="bg-white rounded-[12px] border border-slate-200 divide-y divide-slate-100">
            {[
              ["Ride ID", dispute.rideId],
              ["Pickup", dispute.ridePickup],
              ["Destination", dispute.rideDestination],
              ["Distance", `${dispute.rideDistanceKm} km`],
              ["Duration", `${dispute.rideDurationMin} min`],
              ["Fare", dispute.amountNGN > 0 ? `₦${dispute.amountNGN.toLocaleString()}` : "—"],
              ["Points involved", `${dispute.pointsInvolved} pts`],
              ["Vehicle", dispute.vehicleType],
              ["City", dispute.city],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-slate-500">{k}</span>
                <span className="text-xs font-medium text-slate-700 text-right max-w-[60%]">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Ride timeline ── */}
        <section>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ride Timeline</h4>
          <div className="relative pl-5">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-200" />
            {dispute.rideTimeline.map((t, i) => (
              <TimelineEntry key={i} status={t.status} at={t.at} actor={t.actor} />
            ))}
          </div>
        </section>

        {/* ── Statements ── */}
        <section>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Statements</h4>
          <div className="flex flex-col gap-3">
            <div className="bg-sky-50/60 rounded-[12px] p-4 border border-sky-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-sky-200 flex items-center justify-center text-[9px] font-bold text-sky-800">{dispute.user.avatar}</div>
                <span className="text-xs font-semibold text-sky-800">{dispute.user.name}</span>
                <span className="text-[10px] text-sky-500 ml-auto">User statement</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{dispute.userStatement}</p>
            </div>

            {dispute.driverStatement ? (
              <div className="bg-green-50/60 rounded-[12px] p-4 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-[9px] font-bold text-green-800">{dispute.driver.avatar}</div>
                  <span className="text-xs font-semibold text-green-800">{dispute.driver.name}</span>
                  <span className="text-[10px] text-green-500 ml-auto">Driver statement</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{dispute.driverStatement}</p>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-[12px] p-4 border border-dashed border-slate-200 text-center">
                <Clock size={16} className="text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-400">No driver statement yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Evidence ── */}
        <section>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Evidence</h4>
          <div className="flex flex-wrap gap-2 mb-3">
            <EvidencePill icon={<MessageSquare size={12} />} label="Chat history" active={dispute.chatEvidence} />
            <EvidencePill icon={<Phone size={12} />} label="Call events" active={dispute.callEvidence} />
          </div>

          {dispute.chatEvidence && (
            <div className="bg-slate-50 rounded-[12px] p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600">Chat History Placeholder</span>
                </div>
                <Button variant="secondary" size="sm" icon={<ExternalLink size={11} />}>Open Chat</Button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { from: "user", text: "Are you almost here?", t: "04:46" },
                  { from: "driver", text: "Yes, 5 minutes away", t: "04:47" },
                  { from: "user", text: "This route doesn't look right", t: "05:20" },
                ].map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.from === "user" ? "" : "flex-row-reverse"}`}>
                    <div className={`max-w-[70%] rounded-[10px] px-3 py-2 text-xs
                      ${m.from === "user" ? "bg-sky-100 text-sky-900" : "bg-white text-slate-700 border border-slate-200"}`}>
                      {m.text}
                    </div>
                    <span className="text-[10px] text-slate-400 self-end">{m.t}</span>
                  </div>
                ))}
                <p className="text-[10px] text-slate-400 text-center pt-1">Full transcript available in Chat module</p>
              </div>
            </div>
          )}

          {dispute.callEvidence && (
            <div className="bg-slate-50 rounded-[12px] p-4 border border-slate-200 mt-3">
              <div className="flex items-center gap-2 mb-3">
                <Phone size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">Call Event Metadata</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { event: "Call initiated", from: dispute.driver.name, to: dispute.user.name, at: "14:08", duration: "0s — no answer" },
                  { event: "Call initiated", from: dispute.driver.name, to: dispute.user.name, at: "14:11", duration: "0s — no answer" },
                ].map((c, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-[8px] px-3 py-2 border border-slate-100 text-xs text-slate-600">
                    <Phone size={11} className="text-slate-400 shrink-0" />
                    <span className="font-medium">{c.event}</span>
                    <span className="text-slate-400">{c.from} → {c.to}</span>
                    <span className="ml-auto text-slate-400">{c.at} · {c.duration}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Points transactions ── */}
        <section>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Points Transactions</h4>
          <div className="bg-white rounded-[12px] border border-slate-200 divide-y divide-slate-100">
            {dispute.pointsTransactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`text-sm font-bold tabular-nums ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700">{tx.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-400 truncate">{tx.note}</p>
                </div>
                <span className="text-xs text-slate-400 tabular-nums shrink-0">{fmtTs(tx.at)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Previous admin actions ── */}
        {dispute.previousAdminActions.length > 0 && (
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Previous Admin Actions</h4>
            <div className="flex flex-col gap-2">
              {dispute.previousAdminActions.map(a => (
                <div key={a.id} className="bg-slate-50 rounded-[10px] px-4 py-3 border border-slate-100 flex items-start gap-3">
                  <Shield size={13} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 capitalize">{a.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">{a.note}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{a.by} · {fmtTs(a.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Internal notes ── */}
        <section>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Internal Notes</h4>
          {localNotes.length === 0 ? (
            <div className="bg-slate-50 rounded-[12px] p-4 border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No internal notes yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {localNotes.map(n => (
                <div key={n.id} className={`rounded-[10px] px-4 py-3 border
                  ${n.type === "action" ? "bg-sky-50/50 border-sky-100" : "bg-white border-slate-100"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700">{n.author}</span>
                    <span className="text-[10px] text-slate-400">{fmtTs(n.at)}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Admin actions ── */}
        {!isTerminal && (
          <section>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Admin Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              {visibleActions.map(action => (
                <Button
                  key={action.id}
                  variant={action.variant}
                  size="sm"
                  icon={action.icon}
                  className="justify-start"
                  onClick={() => setActiveAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </section>
        )}
      </div>

      {activeAction && (
        <ConfirmModal
          action={activeAction}
          dispute={dispute}
          onConfirm={handleConfirm}
          onClose={() => setActiveAction(null)}
        />
      )}

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Disputes() {
  const [searchParams] = useSearchParams();
  const preSelected = searchParams.get("id");
  const initialTab = (searchParams.get("tab") as TabId) ?? "open";

  const [tab, setTab] = useState<TabId>(initialTab);
  const [search, setSearch] = useState("");
  const [priorityF, setPriorityF] = useState("all");
  const [reasonF, setReasonF] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Dispute | null>(
    preSelected ? (mockDisputes.find(d => d.id === preSelected) ?? null) : null
  );

  const tabCounts = useMemo(() => {
    const counts: Record<TabId, number> = { open: 0, under_review: 0, waiting_user: 0, waiting_driver: 0, resolved: 0, rejected: 0 };
    mockDisputes.forEach(d => { counts[d.status]++; });
    return counts;
  }, []);

  const filtered = useMemo(() =>
    mockDisputes.filter(d => {
      if (d.status !== tab) return false;
      if (priorityF !== "all" && d.priority !== priorityF) return false;
      if (reasonF !== "all" && d.reason !== reasonF) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!d.id.toLowerCase().includes(q) && !d.rideId.toLowerCase().includes(q) &&
            !d.user.name.toLowerCase().includes(q) && !d.driver.name.toLowerCase().includes(q)) return false;
      }
      return true;
    }), [tab, priorityF, reasonF, search]);

  const perPage = 8;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const openCritical = mockDisputes.filter(d => d.status === "open" && d.priority === "critical").length;
  const unassigned = mockDisputes.filter(d => ["open", "under_review"].includes(d.status) && !d.assignedAdmin).length;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Disputes"
        description="Review and resolve ride disputes raised by users, drivers, and automated detection."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Download size={14} />}>Export</Button>
          </div>
        }
      />

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open disputes",       value: tabCounts.open,         cls: tabCounts.open > 0 ? "text-red-700" : "text-slate-900", bg: tabCounts.open > 0 ? "bg-red-50 border-red-200" : "" },
          { label: "Critical priority",   value: openCritical,           cls: openCritical > 0 ? "text-red-700" : "text-slate-900", bg: openCritical > 0 ? "bg-red-50 border-red-200" : "" },
          { label: "Unassigned",          value: unassigned,             cls: unassigned > 0 ? "text-amber-700" : "text-slate-900", bg: unassigned > 0 ? "bg-amber-50 border-amber-200" : "" },
          { label: "Resolved this week",  value: tabCounts.resolved,     cls: "text-green-700", bg: "" },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-[14px] border border-slate-200 px-4 py-3.5 ${s.bg}`}>
            <div className={`text-2xl font-black tabular-nums ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <TabBar
        tabs={TABS.map(t => ({ id: t.id, label: t.label, count: tabCounts[t.id] > 0 ? tabCounts[t.id] : undefined }))}
        active={tab}
        onChange={t => { setTab(t as TabId); setPage(1); }}
      />

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Dispute ID, ride, user, driver…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
        </div>
        <Select value={priorityF} onChange={setPriorityF} className="w-36"
          options={[{ value: "all", label: "All Priorities" }, { value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
        <Select value={reasonF} onChange={setReasonF} className="w-44"
          options={[
            { value: "all", label: "All Reasons" },
            ...Object.entries(REASON_LABELS).map(([v, l]) => ({ value: v, label: l })),
          ]} />
        <span className="text-xs text-slate-400">{filtered.length} dispute{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Table ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Dispute / Ride</Th>
                <Th>Reported by</Th>
                <Th>User</Th>
                <Th>Driver</Th>
                <Th>Reason</Th>
                <Th>Priority</Th>
                <Th>Points</Th>
                <Th>Assigned to</Th>
                <Th>Created</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      title={`No ${tab.replace("_", " ")} disputes`}
                      description={search ? "Try adjusting your search." : `No disputes in this state.`}
                    />
                  </td>
                </tr>
              ) : paginated.map(d => (
                <Tr key={d.id} onClick={() => setSelected(d)}>
                  <Td>
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-700">{d.id}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{d.rideId}</div>
                    </div>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full
                      ${d.reportedBy === "user" ? "bg-sky-50 text-sky-700 border border-sky-200"
                      : d.reportedBy === "driver" ? "bg-green-50 text-green-700 border border-green-200"
                      : d.reportedBy === "system" ? "bg-violet-50 text-violet-700 border border-violet-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                      {d.reportedBy}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar initials={d.user.avatar} size="xs" />
                      <span className="text-xs text-slate-700">{d.user.name}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar initials={d.driver.avatar} size="xs" />
                      <span className="text-xs text-slate-700">{d.driver.name}</span>
                    </div>
                  </Td>
                  <Td><ReasonBadge reason={d.reason} /></Td>
                  <Td><PriorityBadge priority={d.priority} /></Td>
                  <Td><span className="text-xs font-semibold text-slate-700 tabular-nums">{d.pointsInvolved} pts</span></Td>
                  <Td>
                    {d.assignedAdmin
                      ? <span className="text-xs text-slate-600">{d.assignedAdmin}</span>
                      : <span className="text-xs text-slate-400 italic">Unassigned</span>}
                  </Td>
                  <Td><span className="text-xs text-slate-400">{fmtRelative(d.createdAt)}</span></Td>
                  <Td><StatusBadge status={d.status} /></Td>
                  <Td>
                    <Button variant="secondary" size="sm" icon={<ChevronRight size={13} />} onClick={e => { e.stopPropagation(); setSelected(d); }}>
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

      {/* ── Detail drawer ── */}
      <Drawer open={!!selected} onClose={() => setSelected(null)} title="" width="w-[680px]">
        {selected && <DisputeDetail dispute={selected} />}
      </Drawer>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
