import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (password === "wrong") {
        setError("Invalid credentials. Please check your email and password.");
      } else {
        navigate("/dashboard");
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — branded panel */}
      <div className="hidden lg:flex lg:w-[54%] bg-[#1A0608] relative overflow-hidden flex-col justify-between p-12">
        {/* Background pattern */}
        <RoutePattern />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-transparent to-navy-900/30 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#1A0608]/80 to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-20">
            <div className="w-11 h-11 rounded-[13px] bg-[#BE1B2C] flex items-center justify-center shadow-lg shadow-red-900/40">
              <DrewelMark />
            </div>
            <div>
              <div className="text-white font-bold text-xl tracking-tight">Drewel</div>
              <div className="text-white/40 text-[10px] uppercase tracking-[0.18em]">Operations Platform</div>
            </div>
          </div>

          <h1 className="text-[42px] font-bold text-white leading-[1.1] tracking-[-0.02em] mb-5">
            Move operations<br />
            <span className="text-amber-400">at scale.</span>
          </h1>
          <p className="text-white/50 text-base leading-relaxed max-w-[360px]">
            Real-time visibility across your driver network, verification workflows, and passenger activity—all from a single secure console.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-7">
            {["Live Ride Tracking", "Driver Verification", "Points Ledger", "Dispute Resolution"].map(f => (
              <span key={f} className="text-xs font-medium text-white/60 border border-white/10 bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm">{f}</span>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { label: "Active Drivers", value: "2,841", delta: "↑ 12%" },
            { label: "Rides Today", value: "14,920", delta: "↑ 8%" },
            { label: "Avg. Approval", value: "3.2h", delta: "↓ 0.4h" },
          ].map(s => (
            <div key={s.label} className="border border-white/10 rounded-[14px] p-4 bg-white/[0.06] backdrop-blur-sm">
              <div className="text-[26px] font-bold text-white tabular-nums leading-none">{s.value}</div>
              <div className="text-[10px] text-white/40 mt-1.5 uppercase tracking-wide">{s.label}</div>
              <div className="text-xs text-amber-400 font-semibold mt-1">{s.delta}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F6F8FB]">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-[11px] bg-[#BE1B2C] flex items-center justify-center">
            <DrewelMark />
          </div>
          <span className="font-bold text-slate-800 text-xl">Drewel</span>
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5 mb-4">
              <ShieldCheck size={14} className="text-[#BE1B2C]" />
              <span className="text-xs font-semibold text-[#BE1B2C] uppercase tracking-wide">Admin Portal</span>
            </div>
            <h2 className="text-[26px] font-bold text-slate-900 tracking-[-0.01em]">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1.5">Authorized operations personnel only. All access is logged.</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3">
              <span className="text-red-500 shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M7 4v3.5M7 9v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </span>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Work email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail size={15} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@drewel.ops"
                  autoComplete="email"
                  className="w-full h-11 bg-white border border-slate-200 rounded-[11px] pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <button type="button" className="text-xs text-[#BE1B2C] hover:text-[#A31725] font-semibold transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={15} />
                </span>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-11 bg-white border border-slate-200 rounded-[11px] pl-9 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#BE1B2C] accent-[#BE1B2C] cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer select-none">Keep me signed in for 30 days</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-[#BE1B2C] hover:bg-[#A31725] active:bg-[#8A1320] text-white text-sm font-bold rounded-[11px] transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2 mt-1 shadow-md shadow-red-900/30"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : "Sign In →"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
            <span>© 2025 Drewel Operations</span>
            <span>v2.5.0 · <a href="#" className="hover:text-slate-600 underline transition-colors">Support</a></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrewelMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <path d="M3 9C3 6.239 5.239 4 8 4h2a5 5 0 010 10H8C5.239 14 3 11.761 3 9z" fill="white" fillOpacity="0.95" />
      <circle cx="13" cy="9" r="2" fill="white" fillOpacity="0.45" />
    </svg>
  );
}

function RoutePattern() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 700 900" fill="none" preserveAspectRatio="xMidYMid slice">
      {/* Grid base */}
      {[100, 200, 300, 400, 500, 600, 700, 800].map(y => (
        <line key={`h${y}`} x1="0" y1={y} x2="700" y2={y} stroke="white" strokeOpacity="0.025" strokeWidth="1" />
      ))}
      {[100, 200, 300, 400, 500, 600].map(x => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="900" stroke="white" strokeOpacity="0.025" strokeWidth="1" />
      ))}

      {/* Route paths */}
      <path d="M80 180 Q180 120 280 160 Q390 200 460 140 Q540 80 620 160" stroke="white" strokeOpacity="0.12" strokeWidth="2" fill="none" />
      <path d="M80 380 Q200 320 320 360 Q430 400 530 340 Q610 295 680 340" stroke="white" strokeOpacity="0.1" strokeWidth="2" fill="none" />
      <path d="M40 560 Q160 500 260 540 Q380 590 500 540 Q590 500 680 560" stroke="white" strokeOpacity="0.08" strokeWidth="2" fill="none" />
      <path d="M100 740 Q230 680 360 720 Q470 750 570 700 Q640 665 700 700" stroke="white" strokeOpacity="0.07" strokeWidth="1.5" fill="none" />

      {/* Cross paths */}
      <path d="M300 0 Q320 200 300 400 Q285 600 310 900" stroke="white" strokeOpacity="0.06" strokeWidth="2" fill="none" />
      <path d="M480 0 Q500 300 480 580 Q460 750 490 900" stroke="white" strokeOpacity="0.05" strokeWidth="1.5" fill="none" />

      {/* Node points */}
      {[
        [80, 180], [280, 160], [460, 140], [620, 160],
        [80, 380], [320, 360], [530, 340], [680, 340],
        [260, 540], [500, 540], [360, 720], [570, 700],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill="white" fillOpacity="0.18" />
          <circle cx={x} cy={y} r="10" stroke="white" strokeOpacity="0.06" strokeWidth="1" fill="none" />
          <circle cx={x} cy={y} r="20" stroke="white" strokeOpacity="0.03" strokeWidth="1" fill="none" />
        </g>
      ))}

      {/* Large glow orbs */}
      <circle cx="280" cy="160" r="60" fill="blue" fillOpacity="0.04" />
      <circle cx="530" cy="340" r="50" fill="blue" fillOpacity="0.04" />
      <circle cx="360" cy="720" r="45" fill="blue" fillOpacity="0.03" />

      {/* Vehicle dots */}
      <circle cx="190" cy="168" r="4" fill="#60A5FA" fillOpacity="0.5" />
      <circle cx="400" cy="352" r="4" fill="#60A5FA" fillOpacity="0.4" />
      <circle cx="590" cy="520" r="3.5" fill="#60A5FA" fillOpacity="0.3" />
    </svg>
  );
}
