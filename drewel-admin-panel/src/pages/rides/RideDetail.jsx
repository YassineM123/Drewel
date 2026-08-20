import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import { ArrowLeft, Plus, X } from "lucide-react";
import {
  addRideNote,
  cancelRide,
  createRideActionKey,
  getRideDetail,
  markTechnicalFailure,
  openDispute,
  refundRidePoints,
  resolveRideDispute,
  ridesErrorMessage,
  unlockRide,
} from "../../api/domains/rides";
import {
  Badge, Button, Card, StatRow, Modal, LoadingState, ErrorState,
} from "../../components/ui";

const date = (value) => {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString() : "—";
};
const label = (value) => String(value || "unknown").replaceAll("_", " ");
const person = (value) => value?.fullName || value?.displayName || value?.name || "Drewel participant";
const place = (value) => value?.address || value?.label || value?.name || "—";
const money = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toLocaleString()} AED`;
};
const terminal = (status) => ["completed", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin", "cancelled"].includes(status);
const activeOrDisputed = (status) =>
  !terminal(status) && status !== "requested" && status !== "contacting" && status !== "offer_pending";

const ACTIONS = {
  cancel: { title: "Cancel stuck reservation", submit: "Cancel reservation", variant: "danger", help: "This ends the ride, releases participant locks through the backend transition service, and writes an audit record." },
  dispute: { title: "Open dispute", submit: "Open dispute", variant: "primary", help: "Flag this ride for resolution. The backend records the disputed status and notifies both participants." },
  resolve: { title: "Resolve dispute", submit: "Resolve dispute", variant: "primary", help: "Record the operational resolution. A points refund is a separate audited action." },
  failure: { title: "Mark technical failure", submit: "Mark technical failure", variant: "danger", help: "Classify this ride as a technical failure. It is cancelled by admin and flagged for points review." },
  unlock: { title: "Controlled participant unlock", submit: "Unlock participants", variant: "primary", help: "Use only after verifying that no active ride still owns these participant locks." },
  refund: { title: "Refund ride points", submit: "Refund points", variant: "primary", help: "Technical or dispute refunds require a reason and are written to the immutable points history." },
  note: { title: "Add a note", submit: "Add note", variant: "primary", help: "Internal notes are append-only and only visible to the admin panel with the ride audit trail." },
};

const ActionDialog = ({ action, busy, error, onClose, onSubmit }) => {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [points, setPoints] = useState("20");
  const [resolution, setResolution] = useState("completed");
  const config = ACTIONS[action];
  const invalid =
    (action === "note" ? text.trim().length < 3 : reason.trim().length < 3) ||
    (action === "refund" && (!Number.isSafeInteger(Number(points)) || Number(points) < 1));

  return (
    <Modal open onClose={onClose} title={config.title}>
      <form onSubmit={(event) => { event.preventDefault(); if (!invalid) onSubmit({ reason: reason.trim(), note: note.trim(), text: text.trim(), ...(action === "resolve" ? { resolution } : {}), ...(action === "refund" ? { points: Number(points) } : {}) }); }}>
        <div className="flex flex-col gap-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-[10px] px-3.5 py-2.5 text-sm text-red-700" role="alert">{error}</div>}
          <div className="bg-sky-50 border border-sky-200 rounded-[10px] px-3.5 py-2.5 text-xs text-sky-700">{config.help}</div>

          {action === "resolve" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Resolution</label>
              <select value={resolution} onChange={(event) => setResolution(event.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20">
                <option value="completed">Mark completed</option>
                <option value="cancelled_by_admin">Cancel by admin</option>
              </select>
            </div>
          )}
          {action === "refund" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Points</label>
              <input type="number" min="1" step="1" value={points} onChange={(event) => setPoints(event.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-700/20" />
            </div>
          )}
          {action === "note" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ride-action-note" className="text-sm font-medium text-slate-700">Note <span className="text-red-500">*</span></label>
              <textarea id="ride-action-note" rows={4} required minLength={3} maxLength={2000} value={text} onChange={(event) => setText(event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 resize-none" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ride-action-reason" className="text-sm font-medium text-slate-700">Reason <span className="text-red-500">*</span></label>
              <textarea id="ride-action-reason" rows={3} required minLength={3} value={reason} onChange={(event) => setReason(event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 resize-none" />
            </div>
          )}
          {action !== "note" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ride-action-internal-note" className="text-sm font-medium text-slate-700">Internal note (optional)</label>
              <textarea id="ride-action-internal-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 resize-none" />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Back</Button>
            <Button type="submit" variant={config.variant} disabled={invalid || busy} loading={busy}>{config.submit}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

ActionDialog.propTypes = {
  action: PropTypes.oneOf(Object.keys(ACTIONS)).isRequired,
  busy: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

function TimelineRow({ item }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0 mt-1.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label(item.action || item.toStatus || item.newStatus)}</p>
        <p className="text-xs text-slate-400">{item.actor?.fullName || item.actorName || label(item.actorRole || "system")} · {date(item.createdAt || item.timestamp || item.occurredAt)}</p>
        {item.reasonCode && <p className="text-xs text-slate-500 italic mt-0.5">— {item.reasonCode}</p>}
      </div>
    </div>
  );
}
TimelineRow.propTypes = { item: PropTypes.object.isRequired };

const RideDetail = () => {
  const navigate = useNavigate();
  const { rideId } = useParams();
  const [state, setState] = useState({ loading: true, error: "", ride: null });
  const [action, setAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const ride = await getRideDetail(rideId, signal);
      setState({ loading: false, error: "", ride: ride || null });
    } catch (error) {
      if (error?.code !== "ERR_CANCELED") {
        setState({ loading: false, error: ridesErrorMessage(error, "Unable to load this reservation."), ride: null });
      }
    }
  }, [rideId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const perform = async (payload) => {
    const handlers = { cancel: cancelRide, dispute: openDispute, resolve: resolveRideDispute, failure: markTechnicalFailure, unlock: unlockRide, refund: refundRidePoints, note: addRideNote };
    setBusy(true);
    setActionError("");
    try {
      const result = await handlers[action](rideId, payload, createRideActionKey(action));
      const updatedRide = result?.ride || state.ride;
      setState((current) => ({ ...current, ride: updatedRide }));
      if (action === "note") {
        const refreshed = await getRideDetail(rideId);
        setState({ loading: false, error: "", ride: refreshed || updatedRide });
      }
      setAction("");
    } catch (error) {
      setActionError(ridesErrorMessage(error, "The ride action could not be completed."));
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return <div className="flex flex-col gap-6"><Card className="p-0"><LoadingState label="Loading ride…" /></Card></div>;
  if (state.error || !state.ride) {
    return (
      <div className="flex flex-col gap-6">
        <Card className="p-0">
          <ErrorState title="Reservation unavailable" description={state.error || "Reservation not found."}
            action={<Button variant="secondary" size="sm" onClick={() => navigate("/rides/all")}>Back to reservations</Button>} />
        </Card>
      </div>
    );
  }

  const ride = state.ride;
  const audit = Array.isArray(ride.auditTrail) ? ride.auditTrail : Array.isArray(ride.audit) ? ride.audit : [];
  const notes = Array.isArray(ride.internalNotes) ? ride.internalNotes : [];
  const points = ride.pointsTransaction || ride.points;
  const tripOffer = ride.tripOffer;
  const cancel = ride.cancellation;
  const actsOnRide = activeOrDisputed(ride.status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button type="button" onClick={() => navigate("/rides/all")} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft size={15} /> All reservations
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Reservation {ride.reference || ride.id || ride._id}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Operational evidence and controlled resolution actions.</p>
          </div>
          <Badge variant={ride.status === "disputed" ? "warning" : terminal(ride.status) ? (String(ride.status).includes("cancel") ? "rejected" : "approved") : "info"} label={label(ride.status)} />
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Reservation Details</h2>
          <span className="text-xs text-slate-400">Updated {date(ride.updatedAt)}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-8">
          <StatRow label="User" value={person(ride.user || ride.passenger)} />
          <StatRow label="Driver" value={person(ride.driver)} />
          <StatRow label="State" value={label(ride.status)} />
          <StatRow label="Created" value={date(ride.createdAt)} />
          <StatRow label="Pickup" value={place(ride.pickup)} />
          <StatRow label="Destination" value={place(ride.destination)} />
          <StatRow label="Agreed price" value={money(ride.agreedPrice)} />
          <StatRow label="Points charged" value={ride.pointsCharged != null ? `${ride.pointsCharged} points` : "—"} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Trip Offer</h2>
        {tripOffer ? (
          <div className="grid grid-cols-2 gap-x-8">
            <StatRow label="Offered price" value={money(tripOffer.offeredPrice)} />
            <StatRow label="Points cost" value={tripOffer.pointsCost != null ? `${tripOffer.pointsCost} points` : "—"} />
            <StatRow label="Offer status" value={label(tripOffer.status)} />
            <StatRow label="Reservation state" value={label(tripOffer.reservationState)} />
            <StatRow label="Vehicle type" value={tripOffer.vehicleType || "—"} />
            <StatRow label="Client offer id" value={tripOffer.clientOfferId || "—"} />
          </div>
        ) : <p className="text-sm text-slate-400">No trip offer is attached to this reservation.</p>}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Route &amp; Points</h2>
        <div className="grid grid-cols-2 gap-x-8">
          <StatRow label="ETA" value={ride.etaMinutes != null ? `${ride.etaMinutes} minutes` : "—"} />
          <StatRow label="Remaining distance" value={ride.distanceMeters != null ? `${Math.round(ride.distanceMeters)} m` : "—"} />
          <StatRow label="Route phase" value={ride.routePhase ? label(ride.routePhase) : "—"} />
          <StatRow label="Route freshness" value={date(ride.routeUpdatedAt)} />
          <StatRow label="Last GPS fix" value={date(ride.lastGpsAt)} />
          <StatRow label="Points transaction" value={points?.type ? `${label(points.type)} · ${points.amount ?? points.points ?? 0} points` : "—"} />
          <StatRow label="Transaction ID" value={points?.id || points?._id || "—"} />
        </div>
      </Card>

      {ride.commission && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Commission Breakdown</h2>
          <div className="grid grid-cols-2 gap-x-8">
            <StatRow label="Ride price" value={money(ride.commission.ridePriceAED)} />
            <StatRow label="Commission rate" value={ride.commission.commissionRate != null ? `${(ride.commission.commissionRate * 100).toFixed(0)}%` : "—"} />
            <StatRow label="Commission (AED)" value={money(ride.commission.commissionAED)} />
            <StatRow label="Points per AED" value={ride.commission.pointsPerAED != null ? String(ride.commission.pointsPerAED) : "—"} />
            <StatRow label="Points charged" value={ride.commission.pointsCharged != null ? `${ride.commission.pointsCharged} points` : "—"} />
            <StatRow label="Driver net (AED)" value={money(ride.commission.driverNetAED)} />
            <StatRow label="Charged at" value={date(ride.commission.chargedAt)} />
            <StatRow label="Transaction ID" value={ride.commission.transactionId || "—"} />
          </div>
        </Card>
      )}

      {cancel?.reason && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Cancellation Details</h2>
          <div className="grid grid-cols-2 gap-x-8">
            <StatRow label="Cancelled by" value={label(cancel.actorRole || "")} />
            <StatRow label="Reason" value={cancel.reason} />
            <StatRow label="State before cancellation" value={label(cancel.stateBeforeCancellation)} />
            <StatRow label="Points decision" value={label(cancel.pointsDecision)} />
            <StatRow label="Admin review" value={label(cancel.adminReviewStatus)} />
            <StatRow label="Cancelled at" value={date(cancel.timestamp)} />
            {cancel.note && <StatRow label="Cancellation note" value={cancel.note} />}
          </div>
        </Card>
      )}

      {ride.status === "disputed" && (
        <div className="bg-amber-50 border border-amber-200 rounded-[12px] px-4 py-3 text-sm text-amber-800">
          This reservation is under review. Resolve it by marking it completed or cancelling it by admin; a points refund is a separate audited action.
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Status Timeline</h2>
        {audit.length ? (
          <div className="flex flex-col gap-4">
            {audit.map((item, index) => <TimelineRow key={item.id || item._id || index} item={item} />)}
          </div>
        ) : <p className="text-sm text-slate-400">No audit records were returned.</p>}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Internal Notes</h2>
          <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={() => setAction("note")}>Add note</Button>
        </div>
        {notes.length ? (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <div key={note.id || note._id} className="bg-slate-50 rounded-[10px] border border-slate-100 px-3.5 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-700">{note.adminName || "Admin"}</span>
                  <span className="text-[11px] text-slate-400">{date(note.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-600">{note.text}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-400">No internal notes yet. Add the first note to record operational context.</p>}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Controlled Actions</h2>
        <div className="flex flex-wrap gap-2">
          {!terminal(ride.status) && <Button variant="danger" size="sm" icon={<X size={13} />} onClick={() => setAction("cancel")}>Cancel reservation</Button>}
          {actsOnRide && ride.status !== "disputed" && <Button variant="warning" size="sm" onClick={() => setAction("dispute")}>Open dispute</Button>}
          {actsOnRide && <Button variant="danger" size="sm" onClick={() => setAction("failure")}>Mark technical failure</Button>}
          {ride.status === "disputed" && <Button variant="primary" size="sm" onClick={() => setAction("resolve")}>Resolve dispute</Button>}
          <Button variant="secondary" size="sm" onClick={() => setAction("unlock")}>Controlled unlock</Button>
          {points && <Button variant="secondary" size="sm" onClick={() => setAction("refund")}>Refund points</Button>}
        </div>
      </Card>

      {action && <ActionDialog action={action} busy={busy} error={actionError} onClose={() => { setAction(""); setActionError(""); }} onSubmit={perform} />}
    </div>
  );
};

export default RideDetail;
