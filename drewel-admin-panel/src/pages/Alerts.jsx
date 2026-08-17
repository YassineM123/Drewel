import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import { getAllDashboard } from "../utils/authUtils";
import { Card, EmptyState, ErrorState, KpiCard, SectionHeader } from "../components/ui";

const buildQueueItems = (data = {}) => [
  {
    key: "stuckRides",
    label: "Stuck reservations",
    value: Number(data.stuckRides || 0),
    path: "/reservations/stuck",
    tone: "danger",
  },
  {
    key: "openDisputes",
    label: "Open disputes",
    value: Number(data.openDisputes || 0),
    path: "/reservations/disputes",
    tone: "danger",
  },
  {
    key: "pendingApproval1",
    label: "Pending basic registrations",
    value: Number(data.pendingApproval1 || 0),
    path: "/requests/pending?stage=basic",
    tone: "warning",
  },
  {
    key: "pendingApproval2",
    label: "Pending document reviews",
    value: Number(data.pendingApproval2 || 0),
    path: "/requests/pending?stage=profile",
    tone: "warning",
  },
  {
    key: "pendingPointPurchaseRequests",
    label: "Point purchase requests",
    value: Number(data.pendingPointPurchaseRequests || 0),
    path: "/driver-points/purchase-requests",
    tone: "warning",
  },
  {
    key: "lowBalanceDrivers",
    label: "Low-balance drivers",
    value: Number(data.lowBalanceDrivers || 0),
    path: "/driver-points/wallets",
    tone: "warning",
  },
  {
    key: "unreadRideMessages",
    label: "Unread ride messages",
    value: Number(data.unreadRideMessages || 0),
    path: "/chat",
    tone: "info",
  },
  {
    key: "openSupportReports",
    label: "Open support reports",
    value: Number(data.openSupportReports || 0),
    path: "/requests/all",
    tone: "info",
  },
].map((item) => ({ ...item, value: Number.isFinite(item.value) ? item.value : 0 }));

const TONE_STYLES = {
  danger: { bg: "bg-red-50 border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-700" },
  warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  info: { bg: "bg-sky-50 border-sky-200", text: "text-sky-700", badge: "bg-sky-100 text-sky-700" },
};

const formatValue = (value) => (Number(value) > 0 ? `+${Number(value).toFixed(0)}` : Number(value).toFixed(0));

const Alerts = () => {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    getAllDashboard()
      .then((response) => {
        if (cancelled) return;
        setState({ loading: false, error: "", data: response?.dashBoardData || null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ loading: false, error: error?.response?.data?.message || error?.message || "Failed to load alerts", data: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const queue = useMemo(() => buildQueueItems(state.data), [state.data]);

  const urgent = queue.filter((item) => item.tone === "danger");

  return (
    <div className="space-y-6 max-w-5xl">
      <SectionHeader
        title="Alerts"
        description="Live operational queues from the backend, grouped by severity with a direct path to each review surface."
      />

      {state.loading && (
        <Card className="p-10 flex flex-col items-center justify-center text-center gap-3" role="status">
          <Loader2 size={22} className="animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Loading live queue...</p>
        </Card>
      )}

      {state.error && !state.loading && (
        <ErrorState
          title="Unable to load alerts"
          description={state.error}
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium rounded-[10px] bg-[#BE1B2C] text-white hover:bg-[#A31725]"
            >
              Retry
            </button>
          }
        />
      )}

      {!state.loading && !state.error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {queue.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className="text-left group"
              >
                <Card className="p-5 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${TONE_STYLES[item.tone].text}`}>
                      {item.label}
                    </span>
                    <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 mt-0.5" />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className={`text-[28px] font-bold tabular-nums leading-none ${item.value > 0 ? TONE_STYLES[item.tone].text : "text-slate-800"}`}>
                      {item.value}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.value > 0 ? TONE_STYLES[item.tone].badge : "bg-slate-100 text-slate-500"}`}>
                      {item.value > 0 ? formatValue(item.value) : "Clear"}
                    </span>
                  </div>
                </Card>
              </button>
            ))}
          </div>

          {urgent.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <TriangleAlert size={15} className="text-red-500" />
                <h2 className="text-sm font-semibold text-slate-700">Needs attention now</h2>
              </div>
              <div className="p-6 space-y-2">
                {urgent.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[10px] bg-red-50 border border-red-200 text-left hover:bg-red-100/70 transition-colors"
                  >
                    <span className="text-sm font-medium text-red-700">{item.label}</span>
                    <span className="text-xl font-bold text-red-700 tabular-nums">{item.value}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {queue.every((item) => item.value === 0) && (
            <EmptyState
              title="All queues are clear"
              description="No stuck reservations, disputes, pending reviews, or low-balance drivers right now."
              action={
                <span className="inline-flex items-center gap-2 text-xs text-green-600 font-medium">
                  <CheckCircle2 size={14} />
                  Verified against the live dashboard API
                </span>
              }
            />
          )}
        </>
      )}
    </div>
  );
};

export default Alerts;
