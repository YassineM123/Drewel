import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  adjustDriverPoints,
  createIdempotencyKey,
  pointsErrorMessage,
} from "../../utils/pointsAdminApi";
import ConfirmDialog from "./ConfirmDialog";

const EMPTY = {
  points: "",
  source: "admin",
  reason: "",
};

const AdjustmentModal = ({ driver, mode, onClose, onSuccess }) => {
  const [form, setForm] = useState(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = Number(driver.wallet?.availablePoints || 0);
  const points = Number(form.points || 0);
  const newBalance = mode === "credit" ? current + points : current - points;
  const invalid =
    !Number.isSafeInteger(points) ||
    points <= 0 ||
    form.reason.trim().length < 3 ||
    (mode === "debit" && newBalance < 0);
  const key = useMemo(() => createIdempotencyKey(`admin-${mode}`), [mode]);
  const set = (name) => (event) =>
    setForm((value) => ({ ...value, [name]: event.target.value }));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await adjustDriverPoints(
        mode,
        {
          driverId: driver.id,
          points,
          source: mode === "credit" ? form.source : "correction",
          reason: form.reason.trim(),
        },
        key,
      );
      onSuccess();
    } catch (requestError) {
      setError(pointsErrorMessage(requestError, "The adjustment could not be saved."));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <ConfirmDialog
        title={`${mode === "credit" ? "Add" : "Debit"} ${points} points`}
        message={`Confirm this immutable ledger adjustment for ${driver.fullName}.`}
        confirmLabel={mode === "credit" ? "Confirm credit" : "Confirm debit"}
        dangerous={mode === "debit"}
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={submit}
      >
        <div className="points-summary">
          <div><span>Current balance</span><strong>{current}</strong></div>
          <div><span>Change</span><strong>{mode === "credit" ? "+" : "-"}{points}</strong></div>
          <div><span>New balance</span><strong>{newBalance}</strong></div>
        </div>
      </ConfirmDialog>
    );
  }

  return (
    <div className="points-modal" role="presentation">
      <section className="points-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
        <header>
          <div><span className="points-eyebrow">Immutable ledger adjustment</span><h2 id="adjust-title">{mode === "credit" ? "Add points" : "Debit or correct points"}</h2></div>
          <button type="button" className="points-icon-button" aria-label="Close" onClick={onClose}>&times;</button>
        </header>
        <div className="points-modal__body">
          <p><strong>{driver.fullName}</strong> · {driver.id}</p>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="points-form">
            <div><label htmlFor="adjust-points">Points</label><input id="adjust-points" type="number" min="1" step="1" value={form.points} onChange={set("points")} /></div>
            {mode === "credit" && <div><label htmlFor="adjust-source">Source</label><select id="adjust-source" value={form.source} onChange={set("source")}><option value="admin">Admin credit</option><option value="bonus">Bonus</option><option value="correction">Correction</option></select></div>}
            {mode === "credit" && <div className="points-form__wide points-alert" role="note">Purchased points can only be credited from a payment-verified purchase request.</div>}
            <div className="points-form__wide"><label htmlFor="adjust-reason">Reason</label><textarea id="adjust-reason" rows="3" required value={form.reason} onChange={set("reason")} /></div>
          </div>
          <div className="points-summary">
            <div><span>Current balance</span><strong>{current}</strong></div>
            <div><span>Points {mode === "credit" ? "to add" : "to debit"}</span><strong>{points || 0}</strong></div>
            <div><span>New balance</span><strong>{Number.isFinite(newBalance) ? newBalance : current}</strong></div>
          </div>
          {mode === "debit" && newBalance < 0 && <div className="points-alert" role="alert">A debit cannot create a negative available balance.</div>}
        </div>
        <footer><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button type="button" className={`btn ${mode === "debit" ? "btn-danger" : "btn-primary"}`} disabled={invalid} onClick={() => setConfirming(true)}>Review adjustment</button></footer>
      </section>
    </div>
  );
};

AdjustmentModal.propTypes = {
  driver: PropTypes.object.isRequired,
  mode: PropTypes.oneOf(["credit", "debit"]).isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};
export default AdjustmentModal;
