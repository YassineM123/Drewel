import PropTypes from "prop-types";
import { Outlet } from "react-router-dom";
import { getPointsAccess } from "../../utils/pointsPermissions";
import AccessDenied from "../AccessDenied";

const ACCESS_CHECKS = {
  read: (access) => access.canRead,
  manageRequests: (access) => access.canManageRequests,
  managePacks: (access) => access.canManagePacks,
  manageSettings: (access) => access.canManageSettings,
  owner: (access) => access.isOwner,
};

const RequirePointsAccess = ({ permission = "read", ownerOnly = false }) => {
  const access = getPointsAccess();
  const check = ownerOnly ? ACCESS_CHECKS.owner : ACCESS_CHECKS[permission];
  const allowed = check ? check(access) : false;
  if (!allowed) {
    return (
      <AccessDenied description="This Driver Points section is available only to admins with the required finance permission." />
    );
  }
  return <Outlet />;
};

RequirePointsAccess.propTypes = {
  ownerOnly: PropTypes.bool,
  permission: PropTypes.oneOf(Object.keys(ACCESS_CHECKS)),
};

export default RequirePointsAccess;
