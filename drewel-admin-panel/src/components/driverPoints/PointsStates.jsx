import PropTypes from "prop-types";

export const PointsLoading = ({ label = "Loading Driver Points…" }) => (
  <div className="points-state" role="status" aria-live="polite">
    <div className="loader" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

PointsLoading.propTypes = { label: PropTypes.string };

export const PointsError = ({ message, onRetry }) => (
  <div className="points-state points-state--error" role="alert">
    <i className="fa fa-circle-exclamation" aria-hidden="true" />
    <h2>Unable to load Driver Points</h2>
    <p>{message}</p>
    {onRetry && (
      <button type="button" className="btn btn-outline-danger" onClick={onRetry}>
        Retry
      </button>
    )}
  </div>
);

PointsError.propTypes = {
  message: PropTypes.string.isRequired,
  onRetry: PropTypes.func,
};

export const PointsEmpty = ({ title, message }) => (
  <div className="points-state" role="status">
    <i className="fa fa-wallet" aria-hidden="true" />
    <h2>{title}</h2>
    <p>{message}</p>
  </div>
);

PointsEmpty.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
};

