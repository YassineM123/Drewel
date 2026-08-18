import PropTypes from "prop-types";
import { Outlet } from "react-router-dom";
import { getPointsAccess } from "../../utils/pointsPermissions";
import AccessDenied from "../AccessDenied";

const RequirePointsAccess = ({ ownerOnly = false }) => {
  const access = getPointsAccess();
  const allowed = ownerOnly ? access.isOwner : access.canRead;
  if (!allowed) {
    return (
      <AccessDenied description="Driver Points is available only to the Drewel Owner and authorized Finance Admins." />
    );
  }
  return <Outlet />;
};

RequirePointsAccess.propTypes = {
  ownerOnly: PropTypes.bool,
};

export default RequirePointsAccess;
