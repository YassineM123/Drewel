import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Car, MessageSquare, Phone,
  Image, Settings, LogOut, ChevronLeft, ChevronRight,
  Navigation, AlertOctagon, Coins, MapPin, FileText,
  ArrowLeftRight, Bell, ScrollText, ChevronDown, ShieldCheck,
  Activity, UserCog, AlertTriangle, ClipboardList, CheckCircle2,
  XCircle, BookOpen, Wallet, Package, BarChart2,
} from "lucide-react";
import { mockAdminUser } from "../data/mock";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  section: string;
  collapsible?: boolean;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    section: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    section: "People",
    collapsible: true,
    items: [
      { to: "/drivers", label: "Drivers", icon: <Car size={16} /> },
      { to: "/users",   label: "Users",   icon: <Users size={16} /> },
    ],
  },
  {
    section: "Requests",
    collapsible: true,
    items: [
      { to: "/verification/pending",  label: "Pending",      icon: <ClipboardList size={16} />, badge: 17 },
      { to: "/verification/approved", label: "Approved",     icon: <CheckCircle2  size={16} /> },
      { to: "/verification/rejected", label: "Rejected",     icon: <XCircle       size={16} /> },
      { to: "/verification",          label: "All Requests", icon: <BookOpen      size={16} /> },
    ],
  },
  {
    section: "Operations",
    collapsible: true,
    items: [
      { to: "/rides/live",     label: "Live Reservations", icon: <Navigation    size={16} />, badge: 3 },
      { to: "/rides/all",      label: "All Reservations",  icon: <FileText      size={16} /> },
      { to: "/online-drivers", label: "Online Drivers",    icon: <MapPin        size={16} /> },
      { to: "/rides/disputes", label: "Disputes",          icon: <AlertOctagon  size={16} />, badge: 4 },
      { to: "/rides/stuck",    label: "Stuck Rides",       icon: <AlertTriangle size={16} />, badge: 2 },
    ],
  },
  {
    section: "Driver Points",
    collapsible: true,
    items: [
      { to: "/points/overview",     label: "Overview",          icon: <BarChart2      size={16} /> },
      { to: "/points/balances",     label: "Wallets",           icon: <Wallet         size={16} /> },
      { to: "/points/requests",     label: "Purchase Requests", icon: <Coins          size={16} />, badge: 2 },
      { to: "/points/transactions", label: "Transactions",      icon: <ArrowLeftRight size={16} /> },
      { to: "/points/packs",        label: "Packs",             icon: <Package        size={16} /> },
    ],
  },
  {
    section: "Communication",
    items: [
      { to: "/chat",         label: "Chat",         icon: <MessageSquare size={16} />, badge: 3 },
      { to: "/secure-calls", label: "Secure Calls", icon: <Phone         size={16} /> },
    ],
  },
  {
    section: "Content",
    items: [
      { to: "/banners", label: "Sponsor Banners", icon: <Image size={16} /> },
    ],
  },
  {
    section: "Governance",
    collapsible: true,
    items: [
      { to: "/alerts",        label: "Alerts",        icon: <Bell       size={16} />, badge: 9 },
      { to: "/audit-logs",    label: "Audit Logs",    icon: <ScrollText size={16} /> },
      { to: "/team-roles",    label: "Team & Roles",  icon: <UserCog    size={16} /> },
      { to: "/system-health", label: "System Health", icon: <Activity   size={16} /> },
      { to: "/settings",      label: "Settings",      icon: <Settings   size={16} /> },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>(
    ["Operations", "People", "Requests", "Driver Points", "Governance"]
  );

  const toggleGroup = (section: string) => {
    setExpandedGroups(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some(item =>
      location.pathname === item.to || location.pathname.startsWith(item.to + "/")
    );

  return (
    <aside
      className="sidebar-transition flex flex-col h-full shrink-0 relative"
      style={{
        width: collapsed ? "72px" : "248px",
        background: "linear-gradient(180deg, #1A0608 0%, #130406 100%)",
      }}
    >
      {/* Logo */}
      <div className={`flex items-center h-[68px] border-b border-white/[0.07] shrink-0 ${collapsed ? "justify-center" : "px-5"}`}>
        {collapsed ? (
          <div className="w-9 h-9 rounded-[10px] bg-[#BE1B2C] flex items-center justify-center shadow-lg shadow-red-900/50">
            <DrewelMark />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#BE1B2C] flex items-center justify-center shrink-0 shadow-lg shadow-red-900/40">
              <DrewelMark />
            </div>
            <div>
              <div className="text-[15px] font-bold text-white tracking-tight leading-none">Drewel</div>
              <div className="text-[10px] text-white/35 mt-0.5 uppercase tracking-[0.15em]">Admin Portal</div>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 flex flex-col px-2">
        {navGroups.map((group, gi) => {
          const groupActive = isGroupActive(group);
          const isExpanded = !group.collapsible || expandedGroups.includes(group.section);
          const totalBadge = group.items.reduce((sum, item) => sum + (item.badge ?? 0), 0);

          return (
            <div key={group.section} className={gi > 0 ? "mt-1" : ""}>
              {collapsed ? (
                gi > 0 && <div className="h-px bg-white/[0.07] mx-1 my-2" />
              ) : group.collapsible ? (
                <button
                  onClick={() => toggleGroup(group.section)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[7px] transition-all mb-0.5
                    ${groupActive ? "text-white/80" : "text-white/30 hover:text-white/60"}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] flex-1 text-left">{group.section}</span>
                  {totalBadge > 0 && !isExpanded && (
                    <span className="text-[10px] font-bold bg-[#BE1B2C] text-white px-1.5 py-0.5 rounded-full">{totalBadge}</span>
                  )}
                  <ChevronDown size={11} className={`transition-transform duration-200 opacity-60 ${isExpanded ? "rotate-180" : ""}`} />
                </button>
              ) : (
                <div className={`text-[10px] font-semibold text-white/30 uppercase tracking-[0.18em] px-2 mb-1.5 ${gi > 0 ? "mt-4" : "mt-1"}`}>
                  {group.section}
                </div>
              )}

              {isExpanded && (
                <div className="flex flex-col gap-0.5">
                  {group.items.map(item => {
                    const isActive =
                      location.pathname === item.to ||
                      (item.to !== "/dashboard" && location.pathname.startsWith(item.to + "/"));

                    return (
                      <div key={item.to} className={`relative ${collapsed ? "flex justify-center group/tt" : ""}`}>
                        <NavLink
                          to={item.to}
                          className={`flex items-center rounded-[8px] transition-all duration-150 relative
                            ${collapsed ? "justify-center w-10 h-10" : "gap-2.5 px-3 py-2"}
                            ${isActive
                              ? "bg-[#BE1B2C] text-white shadow-md shadow-red-900/30"
                              : "text-white/50 hover:bg-white/[0.07] hover:text-white/80"}`}
                        >
                          <span className="shrink-0">{item.icon}</span>
                          {!collapsed && (
                            <>
                              <span className="text-[13px] font-medium flex-1 leading-none">{item.label}</span>
                              {item.badge !== undefined && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold
                                  ${isActive ? "bg-white/20 text-white" : "bg-[#BE1B2C] text-white"}`}>
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                          {collapsed && item.badge !== undefined && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#BE1B2C] text-white text-[9px] font-bold flex items-center justify-center shadow">
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                        {collapsed && (
                          <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 bg-[#1A0608] text-white text-xs px-2.5 py-1.5 rounded-[8px] whitespace-nowrap opacity-0 group-hover/tt:opacity-100 transition-all duration-150 z-50 shadow-xl font-medium border border-white/10">
                            {item.label}
                            {item.badge !== undefined && (
                              <span className="ml-1.5 bg-[#BE1B2C] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{item.badge}</span>
                            )}
                            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1A0608]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Logout */}
        <div className="mt-auto pt-4 border-t border-white/[0.07]">
          <div className={`relative ${collapsed ? "flex justify-center group/tt" : ""}`}>
            <button className={`flex items-center w-full rounded-[8px] transition-all text-white/35 hover:bg-red-900/30 hover:text-red-400
              ${collapsed ? "justify-center h-10 w-10" : "gap-2.5 px-3 py-2.5"}`}>
              <LogOut size={16} />
              {!collapsed && <span className="text-[13px] font-medium">Sign Out</span>}
            </button>
            {collapsed && (
              <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 bg-[#1A0608] text-white text-xs px-2.5 py-1.5 rounded-[8px] whitespace-nowrap opacity-0 group-hover/tt:opacity-100 transition-all duration-150 z-50 shadow-xl font-medium border border-white/10">
                Sign Out
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1A0608]" />
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Admin footer */}
      {!collapsed && (
        <div className="border-t border-white/[0.07] px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#BE1B2C]/80 flex items-center justify-center text-xs font-bold text-white shadow">
                {mockAdminUser.avatar}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#130406]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate leading-tight">{mockAdminUser.name}</p>
              <p className="text-[11px] text-white/35 truncate mt-0.5">Owner</p>
            </div>
            <span title="Owner access"><ShieldCheck size={14} className="text-amber-400 shrink-0" /></span>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[80px] w-6 h-6 rounded-full bg-[#1A0608] border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:bg-[#BE1B2C]/30 transition-all z-10 shadow-md"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </aside>
  );
}

function DrewelMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 9C3 6.239 5.239 4 8 4h2a5 5 0 010 10H8C5.239 14 3 11.761 3 9z" fill="white" fillOpacity="0.95" />
      <circle cx="13" cy="9" r="2" fill="white" fillOpacity="0.45" />
    </svg>
  );
}
