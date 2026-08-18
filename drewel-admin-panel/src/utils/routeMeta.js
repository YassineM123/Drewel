// Single source of truth for route → {section, title} used by TopBar breadcrumbs,
// the command palette, and (indirectly) Sidebar active-state grouping.
// Exact-path entries MUST be checked before any dynamic-pattern fallback.
export const ROUTE_META = {
  "/dashboard": { section: undefined, title: "Dashboard" },

  "/drivers": { section: "People", title: "Drivers" },
  "/users": { section: "People", title: "Users" },

  "/verification": { section: "Requests", title: "All Requests" },
  "/verification/pending": { section: "Requests", title: "Pending" },
  "/verification/approved": { section: "Requests", title: "Approved" },
  "/verification/rejected": { section: "Requests", title: "Rejected" },

  "/rides/live": { section: "Operations", title: "Live Reservations" },
  "/rides/all": { section: "Operations", title: "All Reservations" },
  "/rides/completed": { section: "Operations", title: "Completed Reservations" },
  "/rides/cancelled": { section: "Operations", title: "Cancelled Reservations" },
  "/rides/disputes": { section: "Operations", title: "Disputes" },
  "/rides/stuck": { section: "Operations", title: "Stuck Rides" },
  "/online-drivers": { section: "Operations", title: "Online Drivers" },

  "/points/overview": { section: "Driver Points", title: "Overview" },
  "/points/balances": { section: "Driver Points", title: "Wallets" },
  "/points/requests": { section: "Driver Points", title: "Purchase Requests" },
  "/points/transactions": { section: "Driver Points", title: "Transactions" },
  "/points/packs": { section: "Driver Points", title: "Packs" },
  "/points/settings": { section: "Driver Points", title: "Points Settings" },

  "/chat": { section: "Communication", title: "Chat" },
  "/support-chat": { section: "Communication", title: "Support Chat" },
  "/secure-calls": { section: "Communication", title: "Secure Calls" },

  "/banners": { section: "Content", title: "Sponsor Banners" },

  "/alerts": { section: "Governance", title: "Alerts" },
  "/audit-logs": { section: "Governance", title: "Audit Logs" },
  "/team-roles": { section: "Governance", title: "Team & Roles" },
  "/system-health": { section: "Governance", title: "System Health" },
  "/settings": { section: "Governance", title: "Settings" },
};

// Dynamic routes, checked only when no exact match is found. Order matters:
// most specific pattern first.
const DYNAMIC_ROUTE_META = [
  { pattern: /^\/verification\/[^/]+$/, section: "Requests", title: "Request Details" },
  { pattern: /^\/rides\/[^/]+$/, section: "Operations", title: "Ride Details" },
  { pattern: /^\/points\/balances\/[^/]+$/, section: "Driver Points", title: "Wallet Detail" },
  { pattern: /^\/users\/[^/]+$/, section: "People", title: "User Detail" },
  { pattern: /^\/driver-detail\/[^/]+$/, section: "People", title: "Driver Detail" },
];

export const getRouteMeta = (pathname) => {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];
  const dynamic = DYNAMIC_ROUTE_META.find(({ pattern }) => pattern.test(pathname));
  if (dynamic) return { section: dynamic.section, title: dynamic.title };
  return { section: undefined, title: "Dashboard" };
};

// Flat, searchable list for the ⌘K command palette — derived from the same
// map so it can never drift from breadcrumbs/sidebar again.
export const PALETTE_ITEMS = Object.entries(ROUTE_META)
  .filter(([path]) => path !== "/dashboard")
  .map(([path, meta]) => ({ label: meta.title, path, group: meta.section }));
PALETTE_ITEMS.unshift({ label: "Dashboard", path: "/dashboard", group: "Overview" });

export const isRouteActive = (pathname, to) => {
  if (pathname === to) return true;
  if (to === "/dashboard") return false;
  return pathname.startsWith(`${to}/`);
};

// Sidebar nav items can share URL prefixes (e.g. "/verification" and
// "/verification/pending" are SIBLINGS, not parent/child). Naive
// pathname.startsWith(item.to) matching would light up both at once.
// Resolve this by picking the single longest matching `to` across every
// nav item — only that one is "active".
export const bestMatchingRoute = (pathname, candidates) => {
  let best = null;
  for (const to of candidates) {
    if (isRouteActive(pathname, to) && (!best || to.length > best.length)) {
      best = to;
    }
  }
  return best;
};
