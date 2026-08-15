import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell, Search, ChevronDown, Menu, ChevronRight, X, Check,
  AlertTriangle, FileText, ClipboardCheck, MessageSquare, Zap, Activity,
  ExternalLink, CheckCheck
} from "lucide-react";
import { mockAdminUser } from "../data/mock";
import {
  mockNotifications, CATEGORY_META, type Notification, type NotificationCategory
} from "../data/mockNotifications";

// ─── Route labels ─────────────────────────────────────────────────────────────

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/rides/live": "Live Rides",
  "/rides/all": "All Rides",
  "/rides/completed": "Completed Rides",
  "/rides/cancelled": "Cancelled Rides",
  "/rides/disputes": "Disputes",
  "/rides/stuck": "Stuck Rides",
  "/drivers": "Drivers",
  "/users": "Users",
  "/verification": "Verification Requests",
  "/chat": "Chat",
  "/secure-calls": "Secure Calls",
  "/points/balances": "Driver Balances",
  "/points/transactions": "Point Transactions",
  "/points/requests": "Point Requests",
  "/banners": "Sponsor Banners",
  "/alerts": "Alerts",
  "/audit-logs": "Audit Logs",
  "/team-roles": "Team & Roles",
  "/system-health": "System Health",
  "/settings": "Settings",
  "/online-drivers": "Online Drivers",
};

const routeParent: Record<string, string> = {
  "/rides/live": "Operations", "/rides/all": "Operations",
  "/rides/completed": "Operations", "/rides/cancelled": "Operations",
  "/rides/disputes": "Operations", "/rides/stuck": "Operations",
  "/drivers": "People", "/users": "People", "/verification": "People",
  "/chat": "Communication", "/secure-calls": "Communication",
  "/points/balances": "Driver Points", "/points/transactions": "Driver Points", "/points/requests": "Driver Points",
  "/banners": "Content",
  "/alerts": "Governance", "/audit-logs": "Governance",
  "/team-roles": "Governance", "/system-health": "Governance", "/settings": "Governance",
  "/online-drivers": "Operations",
};

// ─── Category icon map ────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<NotificationCategory, React.ReactNode> = {
  critical_alert:       <AlertTriangle size={14} />,
  point_request:        <FileText size={14} />,
  verification_request: <ClipboardCheck size={14} />,
  new_dispute:          <MessageSquare size={14} />,
  stuck_ride:           <Zap size={14} />,
  system_incident:      <Activity size={14} />,
};

const CATEGORY_FILTER_OPTIONS: { value: NotificationCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical_alert", label: "Critical Alerts" },
  { value: "stuck_ride", label: "Stuck Rides" },
  { value: "new_dispute", label: "Disputes" },
  { value: "point_request", label: "Point Requests" },
  { value: "verification_request", label: "Verification" },
  { value: "system_incident", label: "System" },
];

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Notification item ────────────────────────────────────────────────────────

function NotifItem({ n, onRead, onNavigate }: {
  n: Notification;
  onRead: (id: string) => void;
  onNavigate: (n: Notification) => void;
}) {
  const meta = CATEGORY_META[n.category];
  const isUnread = !n.readAt;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 cursor-pointer transition-colors group relative
        ${isUnread ? "bg-red-50/20" : ""}`}
      onClick={() => onNavigate(n)}
    >
      {/* Unread indicator */}
      {isUnread && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
      )}

      {/* Icon */}
      <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 border ${meta.color} text-sm`}>
        {CATEGORY_ICONS[n.category]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[13px] leading-snug ${isUnread ? "font-semibold text-slate-800" : "text-slate-600"}`}>
            {n.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-slate-400">{relTime(n.createdAt)}</span>
            <button
              onClick={e => { e.stopPropagation(); onRead(n.id); }}
              className={`w-6 h-6 flex items-center justify-center rounded-[5px] transition-all
                ${isUnread ? "text-slate-400 hover:text-[#BE1B2C] hover:bg-red-50 opacity-0 group-hover:opacity-100" : "hidden"}`}
              title="Mark as read"
            >
              <Check size={11} />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{n.body}</p>
        {n.relatedLabel && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{n.relatedLabel}</span>
            <ExternalLink size={9} className="text-slate-400" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notification drawer ─────────────────────────────────────────────────────

function NotificationDrawer({
  onClose, notifications, setNotifications,
}: {
  onClose: () => void;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  const [activeFilter, setActiveFilter] = useState<NotificationCategory | "all">("all");

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const filtered = useMemo(() => notifications.filter(n =>
    activeFilter === "all" || n.category === activeFilter
  ), [notifications, activeFilter]);

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, readAt: new Date().toISOString() } : n
    ));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n =>
      n.readAt ? n : { ...n, readAt: new Date().toISOString() }
    ));
  };

  const handleNavigate = (n: Notification) => {
    markRead(n.id);
    if (n.relatedPath) {
      navigate(n.relatedPath);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[400px] bg-white shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-bold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-[7px] font-medium transition-colors"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-[8px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="px-4 py-3 border-b border-slate-100 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {CATEGORY_FILTER_OPTIONS.map(opt => {
              const catCount = opt.value === "all"
                ? notifications.filter(n => !n.readAt).length
                : notifications.filter(n => n.category === opt.value && !n.readAt).length;
              const isActive = activeFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setActiveFilter(opt.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-medium whitespace-nowrap transition-all
                    ${isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
                >
                  {opt.label}
                  {catCount > 0 && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-red-100 text-red-600"}`}>
                      {catCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Bell size={28} className="text-slate-200" />
              <p className="text-sm text-slate-400">No notifications in this category</p>
            </div>
          ) : (
            <>
              {/* Unread section */}
              {filtered.some(n => !n.readAt) && (
                <>
                  <div className="px-4 py-2 bg-slate-50/80">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unread</p>
                  </div>
                  {filtered.filter(n => !n.readAt).map(n => (
                    <NotifItem key={n.id} n={n} onRead={markRead} onNavigate={handleNavigate} />
                  ))}
                </>
              )}

              {/* Read section */}
              {filtered.some(n => n.readAt) && (
                <>
                  <div className="px-4 py-2 bg-slate-50/80">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Earlier</p>
                  </div>
                  {filtered.filter(n => n.readAt).map(n => (
                    <NotifItem key={n.id} n={n} onRead={markRead} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <button
            onClick={() => { navigate("/alerts"); onClose(); }}
            className="text-xs text-[#BE1B2C] hover:text-[#A31725] font-semibold w-full text-center transition-colors"
          >
            View all alerts →
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Command palette ──────────────────────────────────────────────────────────

const PALETTE_ITEMS = [
  { label: "Dashboard",          path: "/dashboard",           group: "Overview" },
  { label: "Live Rides",         path: "/rides/live",          group: "Operations" },
  { label: "All Rides",          path: "/rides/all",           group: "Operations" },
  { label: "Disputes",           path: "/rides/disputes",      group: "Operations" },
  { label: "Stuck Rides",        path: "/rides/stuck",         group: "Operations" },
  { label: "Online Drivers",     path: "/online-drivers",      group: "Operations" },
  { label: "Pending Requests",   path: "/verification/pending",group: "Requests" },
  { label: "Approved Requests",  path: "/verification/approved",group: "Requests" },
  { label: "Rejected Requests",  path: "/verification/rejected",group: "Requests" },
  { label: "All Requests",       path: "/verification",        group: "Requests" },
  { label: "Drivers",            path: "/drivers",             group: "People" },
  { label: "Users",              path: "/users",               group: "People" },
  { label: "Points Overview",    path: "/points/overview",     group: "Driver Points" },
  { label: "Driver Wallets",     path: "/points/balances",     group: "Driver Points" },
  { label: "Purchase Requests",  path: "/points/requests",     group: "Driver Points" },
  { label: "Point Transactions", path: "/points/transactions", group: "Driver Points" },
  { label: "Point Packs",        path: "/points/packs",        group: "Driver Points" },
  { label: "Chat",               path: "/chat",                group: "Communication" },
  { label: "Secure Calls",       path: "/secure-calls",        group: "Communication" },
  { label: "Sponsor Banners",    path: "/banners",             group: "Content" },
  { label: "Alerts",             path: "/alerts",              group: "Governance" },
  { label: "Audit Logs",         path: "/audit-logs",          group: "Governance" },
  { label: "Team & Roles",       path: "/team-roles",          group: "Governance" },
  { label: "System Health",      path: "/system-health",       group: "Governance" },
  { label: "Settings",           path: "/settings",            group: "Governance" },
];

function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const results = useMemo(() => {
    if (!query.trim()) return PALETTE_ITEMS.slice(0, 8);
    const q = query.toLowerCase();
    return PALETTE_ITEMS.filter(i =>
      i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query]);

  useEffect(() => { setCursor(0); }, [results]);

  const go = (path: string) => { navigate(path); onClose(); };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && results[cursor]) go(results[cursor].path);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-[18vh] -translate-x-1/2 z-50 w-full max-w-lg">
        <div className="bg-white rounded-[16px] shadow-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search pages…"
              className="flex-1 text-[14px] text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
            />
            <kbd className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-[5px] font-mono shrink-0">ESC</kbd>
          </div>
          <div className="py-2 max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No pages match "{query}"</p>
            ) : results.map((item, i) => (
              <button key={item.path} onClick={() => go(item.path)}
                onMouseEnter={() => setCursor(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${cursor === i ? "bg-red-50" : "hover:bg-slate-50"}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cursor === i ? "bg-[#BE1B2C]" : "bg-slate-300"}`} />
                <span className={`text-[13px] font-medium flex-1 ${cursor === i ? "text-[#BE1B2C]" : "text-slate-700"}`}>
                  {item.label}
                </span>
                <span className="text-[11px] text-slate-400">{item.group}</span>
              </button>
            ))}
          </div>
          {!query && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60">
              <p className="text-[11px] text-slate-400">↑↓ to navigate · ↵ to open · ESC to close</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMobileMenuOpen?: () => void;
}

export default function TopBar({ onMobileMenuOpen }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const verifMatch = location.pathname.match(/^\/verification\/(.+)$/);
  const label = verifMatch ? "Request Details" : (routeLabels[location.pathname] ?? "Dashboard");
  const parent = verifMatch ? "People" : (routeParent[location.pathname] ?? undefined);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  // ⌘K / Ctrl+K opens command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="h-[68px] bg-white border-b border-slate-200/80 flex items-center px-6 gap-4 shrink-0 sticky top-0 z-30 shadow-[0_1px_0_0_#E2E8F0]">
      {/* Mobile menu */}
      <button onClick={onMobileMenuOpen}
        className="lg:hidden text-slate-500 hover:text-slate-700 p-1.5 rounded-[8px] hover:bg-slate-100 transition-colors">
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
        <button onClick={() => navigate("/dashboard")}
          className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 text-[13px] font-medium">
          Drewel
        </button>
        {parent && (
          <>
            <ChevronRight size={13} className="text-slate-300 shrink-0" />
            <span className="text-slate-400 shrink-0 text-[13px]">{parent}</span>
          </>
        )}
        <ChevronRight size={13} className="text-slate-300 shrink-0" />
        <span className="font-semibold text-slate-800 truncate text-[13px]">{label}</span>
      </div>

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-[10px] px-3 h-9 w-56 text-sm text-slate-400 cursor-pointer hover:border-slate-300 hover:bg-white transition-colors"
      >
        <Search size={13} className="shrink-0 text-slate-400" />
        <span className="text-slate-400 text-[13px] flex-1 text-left">Search pages…</span>
        <span className="ml-auto text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-[5px] font-mono">⌘K</span>
      </button>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}

      <div className="flex items-center gap-1.5">
        {/* Live status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-full">
          <span className="live-pulse w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          Live
        </div>

        {/* Notifications bell */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={notifOpen}
            className="relative w-9 h-9 flex items-center justify-center rounded-[8px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 border-2 border-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationDrawer onClose={() => setNotifOpen(false)} notifications={notifications} setNotifications={setNotifications} />}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2.5 hover:bg-slate-50 rounded-[10px] px-2.5 py-1.5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#7C1A22] flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {mockAdminUser.avatar}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[13px] font-semibold text-slate-700 leading-tight">{mockAdminUser.name}</span>
              <span className="text-[11px] text-slate-400 leading-tight">Ops Manager</span>
            </div>
            <ChevronDown size={13} className="text-slate-400 hidden sm:block" />
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-[14px] shadow-2xl border border-slate-200 z-40 overflow-hidden fade-in-up">
                <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
                  <p className="text-[13px] font-bold text-slate-800">{mockAdminUser.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{mockAdminUser.email}</p>
                </div>
                <div className="py-1">
                  <button className="w-full text-left text-[13px] text-slate-700 px-4 py-2.5 hover:bg-slate-50 transition-colors font-medium"
                    onClick={() => navigate("/settings")}>
                    Settings
                  </button>
                  <button className="w-full text-left text-[13px] text-red-600 px-4 py-2.5 hover:bg-red-50 transition-colors font-medium"
                    onClick={() => { setProfileOpen(false); navigate("/login"); }}>
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
