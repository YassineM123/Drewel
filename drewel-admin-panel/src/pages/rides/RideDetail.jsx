import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PropTypes from "prop-types";
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
import "../../assets/css/admin-rides.css";

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
  cancel: {
    title: "Cancel stuck reservation",
    submit: "Cancel reservation",
    help: "This ends the ride, releases participant locks through the backend transition service, and writes an audit record.",
  },
  dispute: {
    title: "Open dispute",
    submit: "Open dispute",
    help: "Flag this ride for resolution. The backend records the disputed status and notifies both participants.",
  },
  resolve: {
    title: "Resolve dispute",
    submit: "Resolve dispute",
    help: "Record the operational resolution. A points refund is a separate audited action.",
  },
  failure: {
    title: "Mark technical failure",
    submit: "Mark technical failure",
    help: "Classify this ride as a technical failure. It is cancelled by admin and flagged for points review.",
  },
  unlock: {
    title: "Controlled participant unlock",
    submit: "Unlock participants",
    help: "Use only after verifying that no active ride still owns these participant locks.",
  },
  refund: {
    title: "Refund ride points",
    submit: "Refund points",
    help: "Technical or dispute refunds require a reason and are written to the immutable points history.",
  },
  note: {
    title: "Add a note",
    submit: "Add note",
    help: "Internal notes are append-only and only visible to the admin panel with the ride audit trail.",
  },
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
  return <div className="ride-modal" role="presentation"><section className="ride-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ride-action-title">
    <header><h2 id="ride-action-title">{config.title}</h2><button type="button" className="points-icon-button" aria-label="Close" onClick={onClose}>&times;</button></header>
    <form onSubmit={(event) => { event.preventDefault(); if (!invalid) onSubmit({ reason: reason.trim(), note: note.trim(), text: text.trim(), ...(action === "resolve" ? { resolution } : {}), ...(action === "refund" ? { points: Number(points) } : {}) }); }}>
      <div className="ride-form">
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="points-alert" role="note">{config.help}</div>
        {action === "resolve" && <label>Resolution<select value={resolution} onChange={(event) => setResolution(event.target.value)}><option value="completed">Mark completed</option><option value="cancelled_by_admin">Cancel by admin</option></select></label>}
        {action === "refund" && <label>Points<input type="number" min="1" step="1" value={points} onChange={(event) => setPoints(event.target.value)} /></label>}
        {action === "note" ? (
          <label>Note<textarea rows="4" required minLength="3" maxLength="2000" value={text} onChange={(event) => setText(event.target.value)} /></label>
        ) : (
          <label>Reason<textarea rows="3" required minLength="3" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        )}
        {action !== "note" && <label>Internal note (optional)<textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} /></label>}
      </div>
      <footer><button type="button" className="btn btn-light" onClick={onClose}>Back</button><button type="submit" className={`btn ${action === "cancel" || action === "failure" ? "btn-danger" : "btn-primary"}`} disabled={invalid || busy}>{busy ? "Saving…" : config.submit}</button></footer>
    </form>
  </section></div>;
};

const TimelineRow = ({ item }) => (
  <li>
    <strong>{label(item.action || item.toStatus || item.newStatus)}</strong>
    <span>{item.actor?.fullName || item.actorName || label(item.actorRole || "system")}</span>
    <span>{date(item.createdAt || item.timestamp || item.occurredAt)}</span>
    {item.reasonCode ? <em>— {item.reasonCode}</em> : null}
  </li>
);

ActionDialog.propTypes = {
  action: PropTypes.oneOf(Object.keys(ACTIONS)).isRequired,
  busy: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

TimelineRow.propTypes = {
  item: PropTypes.object.isRequired,
};

const RideDetail = () => {
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
    const handlers = {
      cancel: cancelRide,
      dispute: openDispute,
      resolve: resolveRideDispute,
      failure: markTechnicalFailure,
      unlock: unlockRide,
      refund: refundRidePoints,
      note: addRideNote,
    };
    setBusy(true);
    setActionError("");
    try {
      const result = await handlers[action](rideId, payload, createRideActionKey(action));
      const updatedRide = result?.ride || state.ride;
      setState((current) => ({
        ...current,
        ride: updatedRide,
      }));
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

  if (state.loading) return <main className="app-content admin-rides"><div className="tile ride-state"><div className="loader"/><span>Loading ride…</span></div></main>;
  if (state.error || !state.ride) return <main className="app-content admin-rides"><div className="tile ride-state" role="alert"><h1>Reservation unavailable</h1><p>{state.error || "Reservation not found."}</p><Link className="btn btn-light" to="/reservations">Back to reservations</Link></div></main>;

  const ride = state.ride;
  const audit = Array.isArray(ride.auditTrail) ? ride.auditTrail : Array.isArray(ride.audit) ? ride.audit : [];
  const notes = Array.isArray(ride.internalNotes) ? ride.internalNotes : [];
  const points = ride.pointsTransaction || ride.points;
  const tripOffer = ride.tripOffer;
  const cancel = ride.cancellation;
  const actsOnRide = activeOrDisputed(ride.status);
  return <main className="app-content admin-rides">
    <header className="app-title tile p-3 ride-heading"><div><Link to="/reservations">← All reservations</Link><h1>Reservation {ride.reference || ride.id || ride._id}</h1><p>Operational evidence and controlled resolution actions.</p></div><span className={`ride-status ${ride.status === "disputed" ? "ride-status--warning" : ""}`}>{label(ride.status)}</span></header>

    <section className="tile ride-section"><header><h2>Reservation details</h2><span>Updated {date(ride.updatedAt)}</span></header><dl className="ride-detail-grid">
      <div><dt>User</dt><dd>{person(ride.user || ride.passenger)}</dd></div><div><dt>Driver</dt><dd>{person(ride.driver)}</dd></div>
      <div><dt>State</dt><dd>{label(ride.status)}</dd></div><div><dt>Created</dt><dd>{date(ride.createdAt)}</dd></div>
      <div><dt>Pickup</dt><dd>{place(ride.pickup)}</dd></div><div><dt>Destination</dt><dd>{place(ride.destination)}</dd></div>
      <div><dt>Agreed price</dt><dd>{money(ride.agreedPrice)}</dd></div><div><dt>Points charged</dt><dd>{ride.pointsCharged != null ? `${ride.pointsCharged} points` : "—"}</dd></div>
    </dl></section>

    <section className="tile ride-section"><header><h2>Trip offer</h2></header>
      {tripOffer ? (
        <dl className="ride-detail-grid">
          <div><dt>Offered price</dt><dd>{money(tripOffer.offeredPrice)}</dd></div>
          <div><dt>Points cost</dt><dd>{tripOffer.pointsCost != null ? `${tripOffer.pointsCost} points` : "—"}</dd></div>
          <div><dt>Offer status</dt><dd>{label(tripOffer.status)}</dd></div>
          <div><dt>Reservation state</dt><dd>{label(tripOffer.reservationState)}</dd></div>
          <div><dt>Vehicle type</dt><dd>{tripOffer.vehicleType || "—"}</dd></div>
          <div><dt>Client offer id</dt><dd>{tripOffer.clientOfferId || "—"}</dd></div>
        </dl>
      ) : (
        <div className="ride-state"><p>No trip offer is attached to this reservation.</p></div>
      )}
    </section>

    <section className="tile ride-section"><header><h2>Route and points</h2></header><dl className="ride-detail-grid">
      <div><dt>ETA</dt><dd>{ride.etaMinutes != null ? `${ride.etaMinutes} minutes` : "—"}</dd></div>
      <div><dt>Remaining distance</dt><dd>{ride.distanceMeters != null ? `${Math.round(ride.distanceMeters)} m` : "—"}</dd></div>
      <div><dt>Route phase</dt><dd>{ride.routePhase ? label(ride.routePhase) : "—"}</dd></div>
      <div><dt>Route freshness</dt><dd>{date(ride.routeUpdatedAt)}</dd></div>
      <div><dt>Last GPS fix</dt><dd>{date(ride.lastGpsAt)}</dd></div>
      <div><dt>Points transaction</dt><dd>{points?.type ? `${label(points.type)} · ${points.amount ?? points.points ?? 0} points` : "—"}</dd></div>
      <div><dt>Transaction ID</dt><dd>{points?.id || points?._id || "—"}</dd></div>
    </dl></section>

    {cancel?.reason && (
      <section className="tile ride-section"><header><h2>Cancellation details</h2></header><dl className="ride-detail-grid">
        <div><dt>Cancelled by</dt><dd>{label(cancel.actorRole || "")}</dd></div>
        <div><dt>Reason</dt><dd>{cancel.reason}</dd></div>
        <div><dt>State before cancellation</dt><dd>{label(cancel.stateBeforeCancellation)}</dd></div>
        <div><dt>Points decision</dt><dd>{label(cancel.pointsDecision)}</dd></div>
        <div><dt>Admin review</dt><dd>{label(cancel.adminReviewStatus)}</dd></div>
        <div><dt>Cancelled at</dt><dd>{date(cancel.timestamp)}</dd></div>
        {cancel.note ? <div><dt>Cancellation note</dt><dd>{cancel.note}</dd></div> : null}
      </dl></section>
    )}

    {ride.status === "disputed" && (
      <section className="tile ride-section ride-section--dispute"><header><h2>Dispute status</h2></header>
        <div className="ride-state"><p>This reservation is under review. Resolve it by marking it completed or cancelling it by admin; a points refund is a separate audited action.</p></div>
      </section>
    )}

    <section className="tile ride-section"><header><h2>Status timeline</h2></header>{audit.length ? <ol className="ride-audit">{audit.map((item, index) => <TimelineRow key={item.id || item._id || index} item={item} />)}</ol> : <div className="ride-state"><p>No audit records were returned.</p></div>}</section>

    <section className="tile ride-section"><header><h2>Internal notes</h2><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setAction("note")}>Add note</button></header>
      {notes.length ? <ol className="ride-audit">{notes.map((note) => <li key={note.id || note._id}><strong>{note.adminName || "Admin"}</strong><span>{date(note.createdAt)}</span><p>{note.text}</p></li>)}</ol> : <div className="ride-state"><p>No internal notes yet. Add the first note to record operational context.</p></div>}
    </section>

    <section className="tile ride-section"><header><h2>Controlled actions</h2></header><div className="ride-actions p-3">
      {!terminal(ride.status) && <button type="button" className="btn btn-outline-danger" onClick={() => setAction("cancel")}>Cancel reservation</button>}
      {actsOnRide && ride.status !== "disputed" && <button type="button" className="btn btn-outline-warning" onClick={() => setAction("dispute")}>Open dispute</button>}
      {actsOnRide && <button type="button" className="btn btn-outline-danger" onClick={() => setAction("failure")}>Mark technical failure</button>}
      {ride.status === "disputed" && <button type="button" className="btn btn-primary" onClick={() => setAction("resolve")}>Resolve dispute</button>}
      <button type="button" className="btn btn-outline-primary" onClick={() => setAction("unlock")}>Controlled unlock</button>
      {points && <button type="button" className="btn btn-outline-primary" onClick={() => setAction("refund")}>Refund points</button>}
    </div></section>

    {action && <ActionDialog action={action} busy={busy} error={actionError} onClose={() => { setAction(""); setActionError(""); }} onSubmit={perform} />}
  </main>;
};

export default RideDetail;