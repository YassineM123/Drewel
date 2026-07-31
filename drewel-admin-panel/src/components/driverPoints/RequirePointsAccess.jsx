import PropTypes from "prop-types";
import { Outlet } from "react-router-dom";
import { getPointsAccess } from "../../utils/pointsPermissions";

const RequirePointsAccess = ({ ownerOnly = false }) => {
  const access = getPointsAccess();
  const allowed = ownerOnly ? access.isOwner : access.canRead;
  if (!allowed) {
    return (
      <main className="app-content points-admin">
        <section className="tile points-access-denied" role="alert">
          <i className="fa fa-lock" aria-hidden="true" />
          <h1>Access denied</h1>
          <p>
            Driver Points is available only to the Drewel Owner and authorized
            Finance Admins.
          </p>
        </section>
      </main>
    );
  }
  return <Outlet />;
};

RequirePointsAccess.propTypes = {
  ownerOnly: PropTypes.bool,
};

export default RequirePointsAccess;
