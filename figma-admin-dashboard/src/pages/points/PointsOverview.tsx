import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, ArrowLeftRight, FileText, Package, TrendingUp, TrendingDown, AlertTriangle, ChevronRight } from "lucide-react";
import { Card, KpiCard, SectionHeader } from "../../components/ui";
import { getPointsOverview } from "../../api";

const TX_LABEL: Record<string, string> = {
  welcome_credit:       "Welcome Credit",
  ride_debit:           "Ride Debit",
  offer_reservation:    "Offer Hold",
  reservation_release:  "Hold Released",
  admin_refund:         "Admin Refund",
  admin_correction:     "Admin Correction",
  purchased_credit:     "Purchase Credit",
};

function txColor(type: string) {
  const positive = ["welcome_credit", "reservation_release", "admin_refund", "admin_correction", "purchased_credit"];
  return positive.includes(type) ? "text-green-600" : "text-red-600";
}

function txSign(type: string) {
  const positive = ["welcome_credit", "reservation_release", "admin_refund", "admin_correction", "purchased_credit"];
  return positive.includes(type) ? "+" : "−";
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function PointsOverview() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPointsOverview();
        if (!cancelled) setOverview(data);
      } catch (err) {
        console.error("Failed to load points overview", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const wallets = overview?.wallets ?? overview?.drivers ?? [];
  const recentTx = overview?.recentTransactions ?? overview?.transactions ?? [];
  const totalWallets = overview?.totalWallets ?? wallets.length;
  const totalAvailable = overview?.totalAvailable ?? wallets.reduce((s: number, d: any) => s + (d.available ?? 0), 0);
  const totalReserved = overview?.totalReserved ?? wallets.reduce((s: number, d: any) => s + (d.reserved ?? 0), 0);
  const lowBalCount = overview?.lowBalanceCount ?? wallets.filter((d: any) => (d.available ?? 0) < 20).length;
  const zeroBalCount = overview?.zeroBalanceCount ?? wallets.filter((d: any) => (d.available ?? 0) === 0).length;
  const restrictedCount = overview?.restrictedCount ?? wallets.filter((d: any) => d.restricted).length;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Driver Points Overview"
        description="Aggregated wallet health, transaction volume, and balance alerts across all drivers."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Total Wallets"    value={totalWallets}  onClick={() => navigate("/points/balances")} tooltip="All drivers with a points wallet" />
        <KpiCard label="Total Available"  value={totalAvailable.toLocaleString()} tooltip="Sum of available (spendable) points across all wallets" />
        <KpiCard label="Total Reserved"   value={totalReserved.toLocaleString()}  tooltip="Points currently held for pending trip offers" />
        <KpiCard label="Low Balance"      value={lowBalCount}   urgent={lowBalCount > 0} onClick={() => navigate("/points/balances")} tooltip="Drivers with fewer than 20 available points — cannot accept rides" />
        <KpiCard label="Zero Balance"     value={zeroBalCount}  urgent={zeroBalCount > 0} onClick={() => navigate("/points/balances")} tooltip="Drivers with 0 available points" />
        <KpiCard label="Restricted"       value={restrictedCount} urgent={restrictedCount > 0} onClick={() => navigate("/points/balances")} tooltip="Drivers currently restricted from the platform" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Wallets",           desc: "View and manage all driver wallets",    icon: <Coins size={20} />,         to: "/points/balances",     color: "text-red-700 bg-red-50" },
          { label: "Purchase Requests", desc: "Approve or reject pending purchases",   icon: <FileText size={20} />,      to: "/points/requests",     color: "text-amber-700 bg-amber-50" },
          { label: "Transactions",      desc: "Full ledger of all point movements",    icon: <ArrowLeftRight size={20} />, to: "/points/transactions", color: "text-slate-700 bg-slate-100" },
          { label: "Packs & Settings",  desc: "Configure point packs and thresholds",  icon: <Package size={20} />,       to: "/points/packs",        color: "text-emerald-700 bg-emerald-50" },
        ].map(link => (
          <button
            key={link.to}
            onClick={() => navigate(link.to)}
            className="flex items-center gap-4 bg-white border border-slate-200 rounded-[14px] p-4 text-left hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
          >
            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${link.color}`}>
              {link.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{link.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{link.desc}</p>
            </div>
            <ChevronRight size={15} className="text-slate-300 shrink-0" />
          </button>
        ))}
      </div>

      {/* Balance distribution + Recent transactions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Balance distribution */}
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <TrendingDown size={15} className="text-amber-500" />
            <h2 className="text-sm font-bold text-slate-800">Balance Distribution</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: "≥ 100 pts (healthy)",     count: wallets.filter((d: any) => (d.available ?? 0) >= 100).length, color: "bg-green-500" },
              { label: "20–99 pts (caution)",      count: wallets.filter((d: any) => (d.available ?? 0) >= 20 && (d.available ?? 0) < 100).length, color: "bg-amber-400" },
              { label: "1–19 pts (low balance)",   count: wallets.filter((d: any) => (d.available ?? 0) >= 1 && (d.available ?? 0) < 20).length, color: "bg-orange-500" },
              { label: "0 pts (cannot ride)",      count: zeroBalCount, color: "bg-red-600" },
            ].map(band => (
              <div key={band.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">{band.label}</span>
                  <span className="font-semibold text-slate-700 tabular-nums">{band.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${band.color}`}
                    style={{ width: `${totalWallets > 0 ? (band.count / totalWallets) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent transactions */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <TrendingUp size={15} className="text-slate-500" />
              <h2 className="text-sm font-bold text-slate-800">Recent Transactions</h2>
            </div>
            <button onClick={() => navigate("/points/transactions")}
              className="flex items-center gap-1 text-xs font-medium text-[#BE1B2C] hover:text-[#A31725] transition-colors">
              View all <ChevronRight size={13} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentTx.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700">{TX_LABEL[tx.type] ?? tx.type}</p>
                  <p className="text-xs text-slate-400 truncate">{tx.driverName} · {relTime(tx.createdAt)}</p>
                </div>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${txColor(tx.type)}`}>
                  {txSign(tx.type)}{Math.abs(tx.amount)} pts
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Alert: low balance drivers */}
      {lowBalCount > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[12px] px-4 py-3.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {lowBalCount} driver{lowBalCount > 1 ? "s" : ""} with low balance
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These drivers have fewer than 20 available points and cannot accept trip offers until their balance is topped up.
            </p>
          </div>
          <button onClick={() => navigate("/points/balances")}
            className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-[8px] transition-colors shrink-0">
            View Wallets
          </button>
        </div>
      )}
    </div>
  );
}
