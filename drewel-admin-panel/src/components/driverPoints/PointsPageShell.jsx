import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import "../../assets/css/points-admin.css";

const links = [
  ["/points/overview", "Overview", false],
  ["/points/balances", "Driver Wallets", false],
  ["/points/requests", "Purchase Requests", false],
  ["/points/transactions", "Transactions", false],
  ["/points/packs", "Point Packs", true],
  ["/points/settings", "Settings", true],
];

const PointsPageShell = ({ title, description, isOwner, actions, children }) => (
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
        .filter(([, , ownerOnly]) => !ownerOnly || isOwner)
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

PointsPageShell.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  isOwner: PropTypes.bool,
  actions: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export default PointsPageShell;

