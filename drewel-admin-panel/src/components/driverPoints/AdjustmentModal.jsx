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
  paymentReference: "",
  paymentMethod: "",
};

const AdjustmentModal = ({ driver, mode, onClose, onSuccess }) => {
  const [form, setForm] = useState(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = Number(driver.wallet?.availablePoints || 0);
  const points = Number(form.points || 0);
  const isDebit = mode === "debit";
  const newBalance = isDebit ? current - points : current + points;
  const isPurchase = mode === "credit-purchase";
  const isFreeCredit = mode === "credit-free";
  const source = isDebit
    ? "correction"
    : isPurchase
      ? "purchase"
      : form.source;
  const defaultReason = isDebit
    ? "Admin points debit"
    : isPurchase
      ? "Purchased points credit"
      : "Admin points credit";
  const reasonText = form.reason.trim() || defaultReason;
  const driverId = driver.id || driver._id;
  const invalid =
    !Number.isSafeInteger(points) ||
    points <= 0 ||
    (isDebit && newBalance < 0);
  const key = useMemo(() => createIdempotencyKey(`admin-${mode}`), [mode]);
  const set = (name) => (event) =>
    setForm((value) => ({ ...value, [name]: event.target.value }));

  const title = isPurchase
    ? "Add purchased points"
    : isFreeCredit
      ? "Add free points"
      : "Debit or correct points";
  const confirmLabel = isDebit ? "Confirm debit" : "Review and confirm";

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await adjustDriverPoints(
        isDebit ? "debit" : "credit",
        {
          driverId,
          points,
          source,
          reason: reasonText,
          ...(isPurchase
            ? {
                paymentReference: form.paymentReference.trim() || `PAY-${Date.now()}`,
                paymentMethod: form.paymentMethod.trim() || "Admin credit",
              }
            : {}),
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
        title={`${isDebit ? "Debit" : "Add"} ${points} points`}
        message={`Confirm this immutable ledger adjustment for ${driver.fullName}.`}
        confirmLabel={confirmLabel}
        dangerous={isDebit}
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={submit}
      >
        <div className="points-summary">
          <div><span>Current balance</span><strong>{current}</strong></div>
          <div><span>Change</span><strong>{isDebit ? "-" : "+"}{points}</strong></div>
          <div><span>New balance</span><strong>{newBalance}</strong></div>
          {isPurchase && <div><span>Payment reference</span><strong>{form.paymentReference.trim()}</strong></div>}
          {isPurchase && <div><span>Payment method</span><strong>{form.paymentMethod.trim()}</strong></div>}
        </div>
      </ConfirmDialog>
    );
  }

  return (
    <div className="points-modal" role="presentation">
      <section className="points-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
        <header>
          <div><span className="points-eyebrow">Immutable ledger adjustment</span><h2 id="adjust-title">{title}</h2></div>
          <button type="button" className="points-icon-button" aria-label="Close" onClick={onClose}>&times;</button>
        </header>
        <div className="points-modal__body">
          <p><strong>{driver.fullName}</strong> · {driver.id}</p>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="points-form">
            <div><label htmlFor="adjust-points">Points</label><input id="adjust-points" type="number" min="1" step="1" value={form.points} onChange={set("points")} /></div>
            {isFreeCredit && <div><label htmlFor="adjust-source">Source</label><select id="adjust-source" value={form.source} onChange={set("source")}><option value="admin">Admin credit</option><option value="bonus">Bonus</option><option value="correction">Correction</option></select></div>}
            {isPurchase && <><div><label htmlFor="purchase-reference">Payment reference</label><input id="purchase-reference" value={form.paymentReference} onChange={set("paymentReference")} placeholder="Reference of the collected payment" /></div><div><label htmlFor="purchase-method">Payment method</label><input id="purchase-method" value={form.paymentMethod} onChange={set("paymentMethod")} placeholder="e.g. bank transfer, cash" /></div></>}
            <div className="points-form__wide"><label htmlFor="adjust-reason">Reason (Optional)</label><textarea id="adjust-reason" rows="3" placeholder={`e.g. ${defaultReason}`} value={form.reason} onChange={set("reason")} /></div>
          </div>
          <div className="points-summary">
            <div><span>Current balance</span><strong>{current}</strong></div>
            <div><span>Points {isDebit ? "to debit" : "to add"}</span><strong>{points || 0}</strong></div>
            <div><span>New balance</span><strong>{Number.isFinite(newBalance) ? newBalance : current}</strong></div>
          </div>
          {isDebit && newBalance < 0 && <div className="points-alert" role="alert">A debit cannot create a negative available balance.</div>}
        </div>
        <footer><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button type="button" className={`btn ${isDebit ? "btn-danger" : "btn-primary"}`} disabled={invalid} onClick={() => setConfirming(true)}>{isDebit ? "Review debit" : "Review add"}</button></footer>
      </section>
    </div>
  );
};

AdjustmentModal.propTypes = {
  driver: PropTypes.object.isRequired,
  mode: PropTypes.oneOf(["credit-purchase", "credit-free", "debit"]).isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};
export default AdjustmentModal;