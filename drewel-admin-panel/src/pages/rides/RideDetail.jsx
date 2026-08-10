import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import {
  cancelAdminRide,
  createRideActionKey,
  getAdminRide,
  refundRidePoints,
  resolveRideDispute,
  rideApiError,
  unlockRideParticipants,
} from "../../utils/ridesAdminApi";
import "../../assets/css/admin-rides.css";

const date = (value) => {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString() : "—";
};
const label = (value) => String(value || "unknown").replaceAll("_", " ");
const person = (value) => value?.fullName || value?.displayName || value?.name || "Drewel participant";
const place = (value) => value?.address || value?.label || value?.name || "—";
const terminal = (status) => ["completed", "cancelled_by_user", "cancelled_by_driver", "cancelled_by_admin", "cancelled"].includes(status);

const ACTIONS = {
  cancel: {
    title: "Cancel stuck reservation",
    submit: "Cancel reservation",
    help: "This ends the ride, releases participant locks through the backend transition service, and writes an audit record.",
  },
  resolve: {
    title: "Resolve dispute",
    submit: "Resolve dispute",
    help: "Record the operational resolution. A points refund is a separate audited action.",
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
};

const ActionDialog = ({ action, busy, error, onClose, onSubmit }) => {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [points, setPoints] = useState("20");
  const config = ACTIONS[action];
  const invalid = reason.trim().length < 3 || (action === "refund" && (!Number.isSafeInteger(Number(points)) || Number(points) < 1));
  return <div className="ride-modal" role="presentation"><section className="ride-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ride-action-title">
    <header><h2 id="ride-action-title">{config.title}</h2><button type="button" className="points-icon-button" aria-label="Close" onClick={onClose}>&times;</button></header>
    <form onSubmit={(event) => { event.preventDefault(); if (!invalid) onSubmit({ reason: reason.trim(), note: note.trim(), ...(action === "resolve" ? { resolution: reason.trim() } : {}), ...(action === "refund" ? { points: Number(points) } : {}) }); }}>
      <div className="ride-form">
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="points-alert" role="note">{config.help}</div>
        {action === "refund" && <label>Points<input type="number" min="1" step="1" value={points} onChange={(event) => setPoints(event.target.value)} /></label>}
        <label>Reason<textarea rows="3" required minLength="3" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <label>Internal note (optional)<textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </div>
      <footer><button type="button" className="btn btn-light" onClick={onClose}>Back</button><button type="submit" className={`btn ${action === "cancel" ? "btn-danger" : "btn-primary"}`} disabled={invalid || busy}>{busy ? "Saving…" : config.submit}</button></footer>
    </form>
  </section></div>;
};

ActionDialog.propTypes = {
  action: PropTypes.oneOf(Object.keys(ACTIONS)).isRequired,
  busy: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
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
      const payload = await getAdminRide(rideId, signal);
      setState({ loading: false, error: "", ride: payload?.ride || null });
    } catch (error) {
      if (error?.code !== "ERR_CANCELED") {
        setState({ loading: false, error: rideApiError(error, "Unable to load this reservation."), ride: null });
      }
    }
  }, [rideId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const perform = async (payload) => {
    const handlers = { cancel: cancelAdminRide, resolve: resolveRideDispute, unlock: unlockRideParticipants, refund: refundRidePoints };
    setBusy(true);
    setActionError("");
    try {
      const result = await handlers[action](rideId, payload, createRideActionKey(action));
      setState((current) => ({ ...current, ride: result?.ride || current.ride }));
      setAction("");
    } catch (error) {
      setActionError(rideApiError(error, "The ride action could not be completed."));
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return <main className="app-content admin-rides"><div className="tile ride-state"><div className="loader"/><span>Loading ride…</span></div></main>;
  if (state.error || !state.ride) return <main className="app-content admin-rides"><div className="tile ride-state" role="alert"><h1>Reservation unavailable</h1><p>{state.error || "Reservation not found."}</p><Link className="btn btn-light" to="/reservations">Back to reservations</Link></div></main>;

  const ride = state.ride;
  const audit = Array.isArray(ride.auditTrail) ? ride.auditTrail : Array.isArray(ride.audit) ? ride.audit : [];
  const points = ride.pointsTransaction || ride.points;
  return <main className="app-content admin-rides">
    <header className="app-title tile p-3 ride-heading"><div><Link to="/reservations">← All reservations</Link><h1>Reservation {ride.reference || ride.id || ride._id}</h1><p>Operational evidence and controlled resolution actions.</p></div><span className="ride-status">{label(ride.status)}</span></header>
    <section className="tile ride-section"><header><h2>Reservation details</h2><span>Updated {date(ride.updatedAt)}</span></header><dl className="ride-detail-grid">
      <div><dt>User</dt><dd>{person(ride.user || ride.passenger)}</dd></div><div><dt>Driver</dt><dd>{person(ride.driver)}</dd></div>
      <div><dt>State</dt><dd>{label(ride.status)}</dd></div><div><dt>Created</dt><dd>{date(ride.createdAt)}</dd></div>
      <div><dt>Pickup</dt><dd>{place(ride.pickup)}</dd></div><div><dt>Destination</dt><dd>{place(ride.destination)}</dd></div>
      <div><dt>Cancellation reason</dt><dd>{ride.cancellation?.reason || ride.cancellationReason || "—"}</dd></div><div><dt>Admin review</dt><dd>{label(ride.adminReviewStatus || ride.cancellation?.adminReviewStatus || "not required")}</dd></div>
    </dl></section>
    <section className="tile ride-section"><header><h2>Route and points</h2></header><dl className="ride-detail-grid">
      <div><dt>ETA</dt><dd>{ride.etaMinutes != null ? `${ride.etaMinutes} minutes` : "—"}</dd></div><div><dt>Route freshness</dt><dd>{date(ride.routeUpdatedAt)}</dd></div>
      <div><dt>Points transaction</dt><dd>{points?.type ? `${label(points.type)} · ${points.amount ?? points.points ?? 0} points` : "—"}</dd></div><div><dt>Transaction ID</dt><dd>{points?.id || points?._id || "—"}</dd></div>
    </dl></section>
    <section className="tile ride-section"><header><h2>Audit trail</h2></header>{audit.length ? <ol className="ride-audit">{audit.map((item, index) => <li key={item.id || item._id || index}><strong>{label(item.action || item.toStatus || item.newStatus)}</strong> · {item.actor?.fullName || item.actorName || label(item.actorRole || "system")} · {date(item.createdAt || item.timestamp || item.occurredAt)}{item.reason ? ` — ${item.reason}` : ""}</li>)}</ol> : <div className="ride-state"><p>No audit records were returned.</p></div>}</section>
    <section className="tile ride-section"><header><h2>Controlled actions</h2></header><div className="ride-actions p-3">
      {!terminal(ride.status) && <button type="button" className="btn btn-outline-danger" onClick={() => setAction("cancel")}>Cancel reservation</button>}
      {ride.status === "disputed" && <button type="button" className="btn btn-primary" onClick={() => setAction("resolve")}>Resolve dispute</button>}
      <button type="button" className="btn btn-outline-primary" onClick={() => setAction("unlock")}>Controlled unlock</button>
      {points && <button type="button" className="btn btn-outline-primary" onClick={() => setAction("refund")}>Refund points</button>}
    </div></section>
    {action && <ActionDialog action={action} busy={busy} error={actionError} onClose={() => { setAction(""); setActionError(""); }} onSubmit={perform} />}
  </main>;
};

export default RideDetail;
