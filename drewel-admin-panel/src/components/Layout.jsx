import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bell,
  BookOpen,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  FileText,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  Menu,
  MessageSquare,
  Package,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { useSocket } from "../context/SocketContext";
import { getAllDashboard } from "../utils/authUtils";
import { clearAdminSession, notifyAdminSessionChanged } from "../utils/session";
import { getPointsAccess } from "../utils/pointsPermissions";

const readAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem("admin") || "{}");
  } catch {
    return {};
  }
};

const initialsFor = (name = "Drewel Admin") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DA";

const routeLabels = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/users": "Users",
  "/drivers": "Drivers",
  "/onlineDrivers": "Online Drivers",
  "/online-drivers": "Online Drivers",
  "/driver-map": "Driver Live Map",
  "/requests/pending": "Pending Requests",
  "/requests/approved": "Approved Requests",
  "/requests/rejected": "Rejected Requests",
  "/requests/all": "All Requests",
  "/reservations": "Reservations",
  "/reservations/live": "Live Reservations",
  "/reservations/all": "All Reservations",
  "/reservations/completed": "Completed Reservations",
  "/reservations/cancelled": "Cancelled Reservations",
  "/reservations/disputes": "Disputes",
  "/reservations/stuck": "Stuck Rides",
  "/chat": "Chat",
  "/driver-points": "Points Overview",
  "/driver-points/wallets": "Driver Wallets",
  "/driver-points/purchase-requests": "Point Requests",
  "/driver-points/transactions": "Point Transactions",
  "/driver-points/packs": "Point Packs",
  "/driver-points/settings": "Points Settings",
  "/points/overview": "Points Overview",
  "/points/balances": "Driver Wallets",
  "/points/requests": "Point Requests",
  "/points/transactions": "Point Transactions",
  "/points/packs": "Point Packs",
  "/sponsor": "Sponsor Banners",
  "/banners": "Sponsor Banners",
  "/account-settings": "Settings",
  "/settings": "Settings",
};

const basePath = (pathname) => {
  if (pathname.startsWith("/reservations/")) return "/reservations";
  if (pathname.startsWith("/requests/")) return "/requests";
  if (pathname.startsWith("/driver-points/")) return "/driver-points";
  if (pathname.startsWith("/driver-detail/")) return "/drivers";
  return pathname;
};

const navLinkActive = (pathname, item) => {
  if (item.exact) return pathname === item.to;
  const candidates = [item.to, ...(item.aliases || [])];
  return candidates.some((candidate) => {
    if (candidate === "/") return pathname === "/";
    return pathname === candidate || pathname.startsWith(`${candidate}/`);
  });
};

const buildNavGroups = (pointsAccess) => [
  {
    section: "Overview",
    items: [
      { to: "/", aliases: ["/dashboard"], label: "Dashboard", icon: <LayoutDashboard size={16} />, exact: true },
    ],
  },
  {
    section: "People",
    collapsible: true,
    items: [
      { to: "/drivers", label: "Drivers", icon: <Car size={16} /> },
      { to: "/users", label: "Users", icon: <Users size={16} /> },
    ],
  },
  {
    section: "Requests",
    collapsible: true,
    items: [
      { to: "/requests/pending?stage=profile", aliases: ["/requests/pending"], label: "Pending", icon: <FileText size={16} /> },
      { to: "/requests/approved", label: "Approved", icon: <CheckCircle2 size={16} /> },
      { to: "/requests/rejected", label: "Rejected", icon: <XCircle size={16} /> },
      { to: "/requests/all", label: "All Requests", icon: <BookOpen size={16} /> },
    ],
  },
  {
    section: "Operations",
    collapsible: true,
    items: [
      { to: "/reservations/live", aliases: ["/rides/live"], label: "Live Reservations", icon: <Activity size={16} /> },
      { to: "/reservations/all", aliases: ["/rides/all", "/reservations"], label: "All Reservations", icon: <FileText size={16} /> },
      { to: "/onlineDrivers", aliases: ["/online-drivers"], label: "Online Drivers", icon: <MapPin size={16} /> },
      { to: "/driver-map", label: "Driver Live Map", icon: <Map size={16} /> },
      { to: "/reservations/disputes", aliases: ["/rides/disputes"], label: "Disputes", icon: <AlertOctagon size={16} /> },
      { to: "/reservations/stuck", aliases: ["/rides/stuck"], label: "Stuck Rides", icon: <AlertTriangle size={16} /> },
    ],
  },
  pointsAccess.canRead && {
    section: "Driver Points",
    collapsible: true,
    items: [
      { to: "/driver-points", aliases: ["/points/overview"], label: "Overview", icon: <Coins size={16} />, exact: true },
      { to: "/driver-points/wallets", aliases: ["/points/balances"], label: "Wallets", icon: <Wallet size={16} /> },
      { to: "/driver-points/purchase-requests", aliases: ["/points/requests"], label: "Purchase Requests", icon: <Coins size={16} /> },
      { to: "/driver-points/transactions", aliases: ["/points/transactions"], label: "Transactions", icon: <Activity size={16} /> },
      pointsAccess.isOwner && { to: "/driver-points/packs", aliases: ["/points/packs"], label: "Packs", icon: <Package size={16} /> },
      pointsAccess.isOwner && { to: "/driver-points/settings", label: "Settings", icon: <Settings size={16} /> },
    ].filter(Boolean),
  },
  {
    section: "Communication",
    items: [
      { to: "/chat", label: "Chat", icon: <MessageSquare size={16} /> },
    ],
  },
  {
    section: "Content",
    items: [
      { to: "/sponsor", aliases: ["/banners"], label: "Sponsor Banners", icon: <ShieldCheck size={16} /> },
    ],
  },
  {
    section: "Governance",
    collapsible: true,
    items: [
      { to: "/account-settings", aliases: ["/settings"], label: "Settings", icon: <Settings size={16} /> },
      { to: "/account-settings", label: "Team & Roles", icon: <UserCog size={16} /> },
    ],
  },
].filter(Boolean);

function DrewelMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 9C3 6.239 5.239 4 8 4h2a5 5 0 010 10H8C5.239 14 3 11.761 3 9z" fill="white" />
      <circle cx="13" cy="9" r="2" fill="white" fillOpacity="0.45" />
    </svg>
  );
}

function Sidebar({ collapsed, onToggle, onLogout }) {
  const location = useLocation();
  const pointsAccess = getPointsAccess();
  const navGroups = useMemo(() => buildNavGroups(pointsAccess), [pointsAccess]);
  const [expandedGroups, setExpandedGroups] = useState(["People", "Requests", "Operations", "Driver Points"]);
  const admin = readAdmin();
  const adminName = admin.fullName || admin.name || "Drewel Admin";

  const toggleGroup = (section) => {
    setExpandedGroups((current) =>
      current.includes(section) ? current.filter((item) => item !== section) : [...current, section],
    );
  };

  return (
    <aside className="new-admin-sidebar" style={{ width: collapsed ? "72px" : "252px" }}>
      <div className={`new-admin-brand ${collapsed ? "justify-center" : ""}`}>
        <div className="new-admin-brand-mark"><DrewelMark /></div>
        {!collapsed && (
          <div>
            <strong>Drewel</strong>
            <span>Admin Portal</span>
          </div>
        )}
      </div>

      <nav className="new-admin-nav" aria-label="Admin navigation">
        {navGroups.map((group, index) => {
          const isExpanded = !group.collapsible || expandedGroups.includes(group.section);
          const groupActive = group.items.some((item) => navLinkActive(location.pathname, item));

          return (
            <div key={group.section} className={index > 0 ? "new-admin-nav-group" : ""}>
              {collapsed ? (
                index > 0 && <div className="new-admin-nav-separator" />
              ) : group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.section)}
                  className={`new-admin-section-toggle ${groupActive ? "is-active" : ""}`}
                  aria-expanded={isExpanded}
                >
                  <span>{group.section}</span>
                  <ChevronDown size={12} className={isExpanded ? "rotate-180" : ""} />
                </button>
              ) : (
                <p className="new-admin-section-label">{group.section}</p>
              )}

              {isExpanded && (
                <div className="new-admin-nav-items">
                  {group.items.map((item) => (
                    <NavLink
                      key={`${group.section}-${item.label}-${item.to}`}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={() =>
                        `new-admin-nav-link ${collapsed ? "is-collapsed" : ""} ${
                          navLinkActive(location.pathname, item) ? "active" : ""
                        }`
                      }
                    >
                      {item.icon}
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="new-admin-nav-footer">
          <button type="button" onClick={onLogout} className={`new-admin-nav-link ${collapsed ? "is-collapsed" : ""}`}>
            <LogOut size={16} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </nav>

      {!collapsed && (
        <div className="new-admin-user">
          <div className="new-admin-avatar">{initialsFor(adminName)}</div>
          <div>
            <strong>{adminName}</strong>
            <span>{String(admin.role || "admin").replaceAll("_", " ")}</span>
          </div>
          <ShieldCheck size={15} />
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="new-admin-collapse"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}

function SearchPalette({ navGroups, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(
    () =>
      navGroups.flatMap((group) =>
        group.items.map((item) => ({ label: item.label, group: group.section, path: item.to })),
      ),
    [navGroups],
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q))
      : items;
    return filtered.slice(0, 10);
  }, [items, query]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setCursor(0), [query]);

  const open = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <button type="button" className="new-admin-overlay" aria-label="Close search" onClick={onClose} />
      <div className="new-admin-palette" role="dialog" aria-modal="true" aria-label="Search admin pages">
        <div className="new-admin-palette-search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => Math.min(value + 1, results.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => Math.max(value - 1, 0));
              }
              if (event.key === "Enter" && results[cursor]) open(results[cursor].path);
            }}
            placeholder="Search pages..."
          />
          <kbd>ESC</kbd>
        </div>
        <div className="new-admin-palette-results">
          {results.length === 0 ? (
            <p>No page matches this search.</p>
          ) : (
            results.map((item, index) => (
              <button
                key={`${item.path}-${item.label}`}
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => open(item.path)}
                className={cursor === index ? "active" : ""}
              >
                <span>{item.label}</span>
                <small>{item.group}</small>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function TopBar({ onMobileOpen, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isConnected } = useSocket();
  const pointsAccess = getPointsAccess();
  const navGroups = useMemo(() => buildNavGroups(pointsAccess), [pointsAccess]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [operations, setOperations] = useState({ loading: true, items: [] });
  const admin = readAdmin();
  const adminName = admin.fullName || admin.name || "Drewel Admin";
  const label = routeLabels[location.pathname] || routeLabels[basePath(location.pathname)] || "Drewel Admin";

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAllDashboard()
      .then((response) => {
        if (cancelled) return;
        const data = response?.dashBoardData || {};
        const nextItems = [
          data.stuckRides > 0 && { label: "Stuck reservations", value: data.stuckRides, path: "/reservations/stuck" },
          data.openDisputes > 0 && { label: "Open disputes", value: data.openDisputes, path: "/reservations/disputes" },
          data.pendingApproval1 > 0 && { label: "Pending registrations", value: data.pendingApproval1, path: "/requests/pending?stage=basic" },
          data.pendingApproval2 > 0 && { label: "Pending documents", value: data.pendingApproval2, path: "/requests/pending?stage=profile" },
          data.pendingPointPurchaseRequests > 0 && {
            label: "Point purchase requests",
            value: data.pendingPointPurchaseRequests,
            path: "/driver-points/purchase-requests",
          },
        ].filter(Boolean);
        setOperations({ loading: false, items: nextItems });
      })
      .catch(() => setOperations({ loading: false, items: [] }));
    return () => {
      cancelled = true;
    };
  }, []);

  const alertCount = operations.items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <header className="new-admin-topbar">
      <button type="button" onClick={onMobileOpen} className="new-admin-mobile-button" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <div className="new-admin-breadcrumb">
        <button type="button" onClick={() => navigate("/")}>Drewel</button>
        <ChevronRight size={13} />
        <strong>{label}</strong>
      </div>

      <button type="button" className="new-admin-search-button" onClick={() => setSearchOpen(true)}>
        <Search size={14} />
        <span>Search pages...</span>
        <kbd>Ctrl K</kbd>
      </button>
      {searchOpen && <SearchPalette navGroups={navGroups} onClose={() => setSearchOpen(false)} />}

      <div className="new-admin-top-actions">
        <span className={`new-admin-live ${isConnected ? "online" : "offline"}`}>
          {isConnected ? "Live" : "Offline"}
        </span>
        <div className="new-admin-alert-menu">
          <button type="button" aria-label={`${alertCount} operational alerts`} className="new-admin-icon-button">
            <Bell size={17} />
            {alertCount > 0 && <span>{alertCount > 9 ? "9+" : alertCount}</span>}
          </button>
          <div className="new-admin-alert-popover">
            <strong>Operational queue</strong>
            {operations.loading ? (
              <p>Loading live counters...</p>
            ) : operations.items.length === 0 ? (
              <p>No urgent queue items from the backend.</p>
            ) : (
              operations.items.map((item) => (
                <button key={item.label} type="button" onClick={() => navigate(item.path)}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="new-admin-profile">
          <button type="button" onClick={() => setProfileOpen((value) => !value)}>
            <span className="new-admin-avatar">{initialsFor(adminName)}</span>
            <span className="new-admin-profile-text">
              <strong>{adminName}</strong>
              <small>{String(admin.role || "admin").replaceAll("_", " ")}</small>
            </span>
            <ChevronDown size={13} />
          </button>
          {profileOpen && (
            <>
              <button type="button" className="new-admin-profile-backdrop" aria-label="Close profile menu" onClick={() => setProfileOpen(false)} />
              <div className="new-admin-profile-menu">
                <div>
                  <strong>{adminName}</strong>
                  <span>{admin.email || "Admin session"}</span>
                </div>
                <button type="button" onClick={() => navigate("/account-settings")}>Settings</button>
                <button type="button" className="danger" onClick={onLogout}>Sign Out</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1280px)");
    if (media.matches) setCollapsed(true);
    const handler = (event) => {
      if (event.matches) setCollapsed(true);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const logout = useCallback(() => {
    clearAdminSession();
    notifyAdminSessionChanged();
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div className="new-admin-shell">
      <a href="#main-content" className="new-admin-skip">Skip to main content</a>
      <div className="new-admin-desktop-sidebar">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} onLogout={logout} />
      </div>
      {mobileOpen && (
        <div className="new-admin-mobile-sidebar" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" className="new-admin-mobile-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} onLogout={logout} />
        </div>
      )}
      <div className="new-admin-main">
        <TopBar onMobileOpen={() => setMobileOpen(true)} onLogout={logout} />
        <main id="main-content" className="new-admin-content" tabIndex={-1}>
          <div className="new-admin-content-inner" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
