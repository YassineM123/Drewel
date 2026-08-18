import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell, Search, ChevronDown, Menu, ChevronRight, X, Check,
  AlertTriangle, FileText, ClipboardCheck, MessageSquare, Zap, Activity,
  ExternalLink, CheckCheck
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getRouteMeta, PALETTE_ITEMS } from "../utils/routeMeta";

const ROLE_LABELS = {
  owner: "Owner",
  finance_admin: "Finance Admin",
  admin: "Admin",
};

function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
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

  const go = (path) => { navigate(path); onClose(); };

  const handleKey = (e) => {
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
              <p className="text-sm text-slate-400 text-center py-6">No pages match &quot;{query}&quot;</p>
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
              <p className="text-[11px] text-slate-400">&uarr;&darr; to navigate &middot; &crarr; to open &middot; ESC to close</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function TopBar({ onMobileMenuOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { user, role, signOut } = useAuth();
  const { section: parent, title: label } = getRouteMeta(location.pathname);

  const displayName = user?.fullName || user?.name || "Admin";
  const roleLabel = ROLE_LABELS[role] || (role ? role.replace(/_/g, " ") : "—");
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AD";

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSignOut = useCallback(() => {
    setProfileOpen(false);
    signOut();
  }, [signOut]);

  return (
    <header className="h-[68px] bg-white border-b border-slate-200/80 flex items-center px-6 gap-4 shrink-0 sticky top-0 z-30 shadow-[0_1px_0_0_#E2E8F0]">
      <button onClick={onMobileMenuOpen}
        className="lg:hidden text-slate-500 hover:text-slate-700 p-1.5 rounded-[8px] hover:bg-slate-100 transition-colors">
        <Menu size={20} />
      </button>

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

      <button
        onClick={() => setSearchOpen(true)}
        className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-[10px] px-3 h-9 w-56 text-sm text-slate-400 cursor-pointer hover:border-slate-300 hover:bg-white transition-colors"
      >
        <Search size={13} className="shrink-0 text-slate-400" />
        <span className="text-slate-400 text-[13px] flex-1 text-left">Search pages…</span>
        <span className="ml-auto text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-[5px] font-mono">&ctrl;K</span>
      </button>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}

      <div className="flex items-center gap-1.5">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-full">
          <span className="live-pulse w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          Live
        </div>

        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            className="relative w-9 h-9 flex items-center justify-center rounded-[8px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Bell size={17} />
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            className="flex items-center gap-2.5 hover:bg-slate-50 rounded-[10px] px-2.5 py-1.5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#7C1A22] flex items-center justify-center text-xs font-bold text-white shadow-sm">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[13px] font-semibold text-slate-700 leading-tight">{displayName}</span>
              <span className="text-[11px] text-slate-400 leading-tight">{roleLabel}</span>
            </div>
            <ChevronDown size={13} className="text-slate-400 hidden sm:block" />
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-[14px] shadow-2xl border border-slate-200 z-40 overflow-hidden fade-in-up">
                <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
                  <p className="text-[13px] font-bold text-slate-800">{displayName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{user?.email || "—"}</p>
                </div>
                <div className="py-1">
                  <button className="w-full text-left text-[13px] text-slate-700 px-4 py-2.5 hover:bg-slate-50 transition-colors font-medium"
                    onClick={() => { setProfileOpen(false); navigate("/settings"); }}>
                    Settings
                  </button>
                  <button className="w-full text-left text-[13px] text-red-600 px-4 py-2.5 hover:bg-red-50 transition-colors font-medium"
                    onClick={handleSignOut}>
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
