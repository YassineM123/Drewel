import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import { getPointsAccess } from "../../utils/pointsPermissions";
import "../../assets/css/points-admin.css";

const links = [
  ["/points/overview", "Overview", "canRead"],
  ["/points/balances", "Driver Wallets", "canRead"],
  ["/points/requests", "Purchase Requests", "canManageRequests"],
  ["/points/transactions", "Transactions", "canRead"],
  ["/points/packs", "Point Packs", "canManagePacks"],
  ["/points/settings", "Settings", "canManageSettings"],
];

const PointsPageShell = ({ title, description, isOwner, access, actions, children }) => {
  const pointsAccess = access || { ...getPointsAccess(), isOwner };
  return (
    <main className="app-content points-admin">
      <header className="app-title tile p-3 points-heading">
        <div>
          <span className="points-eyebrow">Driver Points</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className="points-heading__actions">{actions}</div>}
      </header>
      <nav className="tile points-tabs" aria-label="Driver Points sections">
        {links
          .filter(([, , permission]) => pointsAccess[permission])
          .map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/points/overview"}
              className={({ isActive }) =>
                `points-tab${isActive ? " active" : ""}`
              }
            >
              {label}
            </NavLink>
          ))}
      </nav>
      {children}
    </main>
  );
};

PointsPageShell.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  access: PropTypes.shape({
    canRead: PropTypes.bool,
    canManageRequests: PropTypes.bool,
    canManagePacks: PropTypes.bool,
    canManageSettings: PropTypes.bool,
  }),
  isOwner: PropTypes.bool,
  actions: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export default PointsPageShell;
