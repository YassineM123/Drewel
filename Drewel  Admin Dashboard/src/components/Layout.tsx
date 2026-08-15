import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  // Collapse sidebar automatically at narrow laptop widths
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1280px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setCollapsed(true);
    };
    if (mq.matches) setCollapsed(true);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="flex h-screen bg-[#F6F8FB] overflow-hidden">
      {/* Skip to main content */}
      <a href="#main-content" className="skip-to-content">Skip to main content</a>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Mobile Sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="relative z-10">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMobileMenuOpen={() => setMobileOpen(true)} />
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden" tabIndex={-1}>
          <div className="max-w-[1440px] mx-auto px-6 py-6 lg:px-8 lg:py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
