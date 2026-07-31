import { useEffect, useRef } from "react";
import PropTypes from "prop-types";

const ConfirmDialog = ({
  title,
  message,
  confirmLabel = "Confirm",
  dangerous = false,
  busy = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
  children,
}) => {
  const cancelRef = useRef(null);
  useEffect(() => cancelRef.current?.focus(), []);
  return (
    <div className="points-modal" role="presentation">
      <section
        className="points-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="points-confirm-title"
      >
        <header>
          <div>
            <span className="points-eyebrow">Explicit confirmation required</span>
            <h2 id="points-confirm-title">{title}</h2>
          </div>
          <button
            ref={cancelRef}
            type="button"
            className="points-icon-button"
            aria-label="Close"
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div className="points-modal__body">
          <p>{message}</p>
          {children}
        </div>
        <footer>
          <button
            type="button"
            className="btn btn-light"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${dangerous ? "btn-danger" : "btn-primary"}`}
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
};

ConfirmDialog.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  dangerous: PropTypes.bool,
  busy: PropTypes.bool,
  confirmDisabled: PropTypes.bool,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  children: PropTypes.node,
};

export default ConfirmDialog;
