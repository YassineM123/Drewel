import React, { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

// ─── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = "pending" | "approved" | "rejected" | "completed" | "not_submitted" | "active" | "inactive" | "draft" | "restricted" | "info" | "warning";

const badgeStyles: Record<BadgeVariant, string> = {
  pending:       "bg-amber-50 text-amber-700 border border-amber-200",
  approved:      "bg-green-50 text-green-700 border border-green-200",
  rejected:      "bg-red-50 text-red-700 border border-red-200",
  completed:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  not_submitted: "bg-slate-100 text-slate-500 border border-slate-200",
  active:        "bg-green-50 text-green-700 border border-green-200",
  inactive:      "bg-slate-100 text-slate-500 border border-slate-200",
  draft:         "bg-amber-50 text-amber-700 border border-amber-200",
  restricted:    "bg-red-50 text-red-700 border border-red-200",
  info:          "bg-sky-50 text-sky-700 border border-sky-200",
  warning:       "bg-amber-50 text-amber-700 border border-amber-200",
};

const badgeLabels: Record<string, string> = {
  pending: "Pending", approved: "Approved", rejected: "Rejected",
  completed: "Completed", not_submitted: "Not Submitted",
  active: "Active", inactive: "Inactive", draft: "Draft",
  restricted: "Restricted", online_available: "Available",
  online_busy: "On Trip", offline: "Offline",
};

export function Badge({ variant, label, dot = false }: { variant: BadgeVariant; label?: string; dot?: boolean }) {
  const text = label ?? badgeLabels[variant] ?? variant;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badgeStyles[variant]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {text}
    </span>
  );
}

export function OnlineBadge({ status }: { status: "online_available" | "online_busy" | "offline" }) {
  const styles = {
    online_available: "bg-green-50 text-green-700 border border-green-200",
    online_busy:      "bg-blue-50 text-blue-700 border border-blue-200",
    offline:          "bg-slate-100 text-slate-500 border border-slate-200",
  };
  const dots = {
    online_available: "bg-green-500",
    online_busy:      "bg-blue-500",
    offline:          "bg-slate-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {badgeLabels[status] ?? status}
    </span>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const buttonBase = "inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/30 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:   "bg-[#BE1B2C] text-white hover:bg-[#A31725] active:bg-[#8A1320] shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100",
  ghost:     "text-slate-600 hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200",
  danger:    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm",
  warning:   "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm",
  icon:      "text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 rounded-[8px]",
};

const buttonSizes: Record<string, string> = {
  sm:      "h-8 px-3 text-xs",
  md:      "h-10 px-4 text-sm",
  lg:      "h-11 px-5 text-sm",
  icon_sm: "h-9 w-9",
  icon_md: "h-11 w-11",
  icon_lg: "h-12 w-12",
};

export function Button({ variant = "primary", size = "md", loading, icon, children, className = "", ...props }: ButtonProps) {
  const isIcon = variant === "icon";
  const sizeKey = isIcon ? `icon_${size}` : size;
  return (
    <button
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[sizeKey] ?? buttonSizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
    </button>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Input({ label, error, leftIcon, rightIcon, className = "", id, ...props }: InputProps) {
  const inputId = id ?? `input-${Math.random().toString(36).slice(2)}`;
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true">{leftIcon}</span>}
        <input
          id={inputId}
          className={`w-full h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-800 placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400
            disabled:bg-slate-50 disabled:text-slate-400
            ${leftIcon ? "pl-9" : ""} ${rightIcon ? "pr-9" : ""} ${error ? "border-red-400 focus:ring-red-500/20" : ""} ${className}`}
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">{rightIcon}</span>}
      </div>
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({ initials, size = "md" }: { initials: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const sizes = { xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white bg-[#7C1A22] shrink-0`} aria-hidden="true">
      {initials}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] ${onClick ? "cursor-pointer hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150" : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      {children}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export function Toast({ message, type = "success", onClose }: { message: string; type?: "success" | "error" | "info"; onClose: () => void }) {
  const config = {
    success: { bar: "bg-green-500", icon: "✓", iconCls: "text-green-600 bg-green-50" },
    error:   { bar: "bg-red-500",   icon: "✕", iconCls: "text-red-600 bg-red-50"   },
    info:    { bar: "bg-sky-500",  icon: "i", iconCls: "text-sky-700 bg-sky-50"  },
  }[type];

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-enter fixed bottom-6 right-6 z-[60] flex items-start gap-3 px-4 py-3.5 rounded-[12px] shadow-xl border border-slate-200 bg-white min-w-72 max-w-sm"
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${config.iconCls}`} aria-hidden="true">{config.icon}</div>
      <p className="text-sm text-slate-700 font-medium flex-1 leading-relaxed">{message}</p>
      <button onClick={onClose} aria-label="Dismiss notification" className="text-slate-300 hover:text-slate-500 mt-0.5 shrink-0 transition-colors p-1 rounded">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string;
}) {
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    firstFocusRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={`relative bg-white rounded-[14px] shadow-2xl w-full ${width} max-h-[90vh] overflow-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-800" id="modal-title">{title}</h2>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            aria-label="Close dialog"
            className="flex items-center justify-center w-8 h-8 rounded-[8px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", variant = "danger", loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: ReactNode;
  confirmLabel?: string; variant?: "danger" | "primary"; loading?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) onClose(); };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      prev?.focus();
    };
  }, [open, onClose, loading]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={!loading ? onClose : undefined} aria-hidden="true" />
      <div className="relative bg-white rounded-[14px] shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-2">{title}</h2>
          <div className="text-sm text-slate-600 mb-6">{message}</div>
          <div className="flex justify-end gap-3">
            <button
              ref={cancelRef}
              onClick={onClose}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/30 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer h-10 px-4 text-sm bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100"
            >Cancel</button>
            <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

export function Drawer({ open, onClose, title, children, width = "w-[480px]" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/20" onClick={onClose} aria-hidden="true" />
      <div className={`drawer-enter relative bg-white ${width} max-w-[calc(100vw-2rem)] h-full shadow-2xl flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close panel"
            className="flex items-center justify-center w-8 h-8 rounded-[8px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 1l14 14M15 1L1 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  className?: string;
}

export function Select({ value, onChange, options, label, className = "" }: SelectProps) {
  const id = `select-${Math.random().toString(36).slice(2)}`;
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>}
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 appearance-none
          focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 cursor-pointer ${className}`}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px" }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, prev, trend, tooltip, urgent, onClick, sparkline, delta }: {
  label: string; value: string | number; prev?: string | number; trend?: "up" | "down" | "neutral";
  tooltip?: string; urgent?: boolean; onClick?: () => void; sparkline?: number[]; delta?: string;
}) {
  const maxSparkline = sparkline ? Math.max(...sparkline) : 1;
  const minSparkline = sparkline ? Math.min(...sparkline) : 0;
  const range = maxSparkline - minSparkline || 1;
  const sparkColor = urgent ? "#DC2626" : trend === "up" ? "#BE1B2C" : trend === "down" ? "#16A34A" : "#BE1B2C";

  return (
    <div
      className={`bg-white rounded-[14px] border p-5 flex flex-col gap-2.5 transition-all duration-150 relative overflow-hidden
        ${urgent ? "border-red-200" : "border-slate-200"}
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/30 focus-visible:ring-offset-1" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${label}: ${value}` : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      {urgent && <div className="absolute inset-0 bg-red-500/[0.04] pointer-events-none" aria-hidden="true" />}
      <div className="flex items-start justify-between gap-2 relative">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-tight">{label}</span>
        {tooltip && (
          <span title={tooltip} aria-label={tooltip} className="text-slate-300 hover:text-slate-400 cursor-help shrink-0 mt-0.5">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M7 6v4M7 4.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 relative">
        <span className={`text-[28px] font-bold tabular-nums leading-none ${urgent ? "text-red-600" : "text-slate-800"}`}>{value}</span>
        {sparkline && sparkline.length > 1 && (
          <svg width="64" height="32" viewBox="0 0 64 32" fill="none" className="mb-0.5" aria-hidden="true">
            <defs>
              <linearGradient id={`sg-${label.replace(/\s/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity="0.2" />
                <stop offset="100%" stopColor={sparkColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            {(() => {
              const pts = sparkline.map((v, i) => ({
                x: (i / (sparkline.length - 1)) * 64,
                y: 28 - ((v - minSparkline) / range) * 22,
              }));
              const linePoints = pts.map(p => `${p.x},${p.y}`).join(" ");
              const areaPoints = `${pts[0].x},28 ${linePoints} ${pts[pts.length - 1].x},28`;
              return (
                <>
                  <polygon points={areaPoints} fill={`url(#sg-${label.replace(/\s/g, "-")})`} />
                  <polyline points={linePoints} stroke={sparkColor} strokeWidth="1.75" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={sparkColor} />
                </>
              );
            })()}
          </svg>
        )}
      </div>
      {(prev !== undefined || delta) && (
        <div className="flex items-center gap-1.5 text-xs relative">
          {trend === "up" && <span className="text-red-500 font-semibold" aria-label="trending up">↑</span>}
          {trend === "down" && <span className="text-green-600 font-semibold" aria-label="trending down">↓</span>}
          {delta ? <span className="text-slate-500">{delta}</span> : <span className="text-slate-400">prev: {prev}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5 bg-slate-50/70 border-b border-slate-100 first:rounded-tl-xl last:rounded-tr-xl ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3.5 text-sm text-slate-700 ${className}`}>{children}</td>;
}

export function Tr({ children, onClick, selected }: { children: ReactNode; onClick?: () => void; selected?: boolean }) {
  return (
    <tr
      className={`border-b border-slate-100 last:border-0 transition-colors
        ${onClick ? "cursor-pointer hover:bg-slate-50 focus-visible:bg-red-50/40 focus-visible:outline-none" : ""}
        ${selected ? "bg-red-50/40" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
    >
      {children}
    </tr>
  );
}

// ─── SLA Badge ───────────────────────────────────────────────────────────────

export function SlaBadge({ hours, breached }: { hours: number; breached: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
        ${breached ? "bg-red-50 text-red-700 border border-red-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}
      title={breached ? "SLA breached" : "Within SLA"}
    >
      {breached && <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />}
      {hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(hours * 60)}m`}
    </span>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center" role="status">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v6m0 3v.01M17 10A7 7 0 113 10a7 7 0 0114 0z" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
      {description && <p className="text-xs text-slate-400 mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}

// ─── Alert Banner ────────────────────────────────────────────────────────────

export function AlertBanner({ type, title, message, onClose }: {
  type: "warning" | "danger" | "info"; title: string; message: string; onClose?: () => void;
}) {
  const styles = {
    warning: "bg-amber-50 border border-amber-200 text-amber-800",
    danger:  "bg-red-50 border border-red-200 text-red-800",
    info:    "bg-sky-50 border border-sky-200 text-sky-800",
  };
  const iconSvg = {
    warning: <path d="M12 9v4m0 3v.01M21 19H3l9-16 9 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
    danger:  <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 8v5M12 15v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    info:    <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M12 11v6M12 8v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  };
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-[10px] ${styles[type]}`} role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">{iconSvg[type]}</svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-80 mt-0.5">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss alert" className="opacity-60 hover:opacity-100 shrink-0 p-1 rounded transition-opacity">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      )}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export function Pagination({ page, total, perPage, onChange }: {
  page: number; total: number; perPage: number; onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <span className="text-xs text-slate-400">{start}–{end} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1} onClick={() => onChange(page - 1)}
          aria-label="Previous page"
          className="h-8 w-8 flex items-center justify-center rounded-[8px] text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
        >‹</button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
          <button
            key={p} onClick={() => onChange(p)}
            aria-label={`Page ${p}`} aria-current={p === page ? "page" : undefined}
            className={`h-8 w-8 flex items-center justify-center rounded-[8px] text-xs font-medium transition-colors
              ${p === page ? "bg-[#BE1B2C] text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >{p}</button>
        ))}
        <button
          disabled={page >= pages} onClick={() => onChange(page + 1)}
          aria-label="Next page"
          className="h-8 w-8 flex items-center justify-center rounded-[8px] text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
        >›</button>
      </div>
    </nav>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

export function SectionHeader({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-2">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 leading-tight tracking-[-0.01em]">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 mt-1">{actions}</div>}
    </div>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

export function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center border-b border-slate-200 gap-0 mb-6 overflow-x-auto" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0
            ${active === tab.id
              ? "border-[#BE1B2C] text-[#BE1B2C]"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${active === tab.id ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Filter Chip ─────────────────────────────────────────────────────────────

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-medium text-red-700">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label} filter`} className="text-red-400 hover:text-red-600 transition-colors rounded-full p-0.5">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

// ─── Stat Row ────────────────────────────────────────────────────────────────

export function StatRow({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0 ${className}`}>
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-slate-700 text-right">{value}</span>
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Progress steps" className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all
                  ${done ? "bg-green-500 border-green-500 text-white" : active ? "bg-[#BE1B2C] border-[#BE1B2C] text-white" : "bg-white border-slate-300 text-slate-400"}`}
                aria-label={`Step ${i + 1}: ${step} — ${done ? "completed" : active ? "current" : "upcoming"}`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${active ? "text-[#BE1B2C]" : done ? "text-green-600" : "text-slate-400"}`}>{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mb-5 min-w-8 mx-2 ${done ? "bg-green-400" : "bg-slate-200"}`} aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-[7px] whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50 shadow-xl"
      >
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" aria-hidden="true" />
      </div>
    </div>
  );
}
