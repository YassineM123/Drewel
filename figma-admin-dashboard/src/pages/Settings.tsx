import { useState, useEffect } from "react";
import { SectionHeader, Card, StatRow, Button, Modal, Toast } from "../components/ui";
import { getAdminSettings } from "../api";

const ROLE = "owner";

interface Setting { key: string; label: string; value: number; unit: string; min: number; max: number; description: string }

type NotifKey = "sla_breach" | "stuck_ride" | "reported_calls" | "low_balance" | "restricted_changes";

const DEFAULT_NOTIFS: Record<NotifKey, boolean> = {
  sla_breach: true,
  stuck_ride: true,
  reported_calls: true,
  low_balance: true,
  restricted_changes: false,
};

const NOTIF_LABELS: { key: NotifKey; label: string; description: string }[] = [
  { key: "sla_breach",         label: "SLA breach alerts",            description: "Notified when a ride exceeds the stuck-ride threshold" },
  { key: "stuck_ride",         label: "Stuck ride alerts",             description: "Notified when a ride is automatically flagged as stuck" },
  { key: "reported_calls",     label: "Reported calls",               description: "Notified when a driver or user reports a call for safety review" },
  { key: "low_balance",        label: "Low driver balance warnings",  description: "Notified when a driver's point balance drops below 50 pts" },
  { key: "restricted_changes", label: "Restricted account changes",   description: "Notified when a driver or user account is restricted or unrestricted" },
];

const operationalSettings: Setting[] = [
  { key: "welcome_points", label: "Welcome Points", value: 100, unit: "pts", min: 0, max: 500, description: "Points credited to a new driver on first approval" },
  { key: "points_per_ride", label: "Points Charged Per Ride", value: 20, unit: "pts", min: 1, max: 100, description: "Points deducted from driver on each completed ride" },
  { key: "offer_expiry", label: "Trip Offer Expiry Time", value: 45, unit: "sec", min: 10, max: 120, description: "Seconds before an unaccepted trip offer expires" },
  { key: "pickup_radius", label: "Pickup Geofence Radius", value: 100, unit: "m", min: 20, max: 500, description: "Radius within which pickup PIN confirmation is valid" },
  { key: "destination_radius", label: "Destination Geofence Radius", value: 150, unit: "m", min: 50, max: 800, description: "Radius within which ride completion is auto-triggered" },
  { key: "stale_location_threshold", label: "Stale Location Threshold", value: 5, unit: "min", min: 1, max: 30, description: "Minutes without a GPS update before a location is considered stale" },
  { key: "stuck_ride_threshold", label: "Stuck Ride Threshold", value: 60, unit: "min", min: 10, max: 240, description: "Minutes in a single state before a ride is flagged as stuck" },
  { key: "point_request_limit", label: "Max Point Request (Driver)", value: 500, unit: "pts", min: 10, max: 5000, description: "Maximum points a driver can request in a single request" },
];

export default function Settings() {
  const [editSetting, setEditSetting] = useState<Setting | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>(DEFAULT_NOTIFS);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [_fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdminSettings();
        if (!cancelled) setAdminUser(data?.user ?? data?.admin ?? data);
      } catch (err) {
        console.error("Failed to load admin settings", err);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleNotif = (key: NotifKey) => {
    setNotifs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      setToast(`"${NOTIF_LABELS.find(n => n.key === key)?.label}" ${next[key] ? "enabled" : "disabled"}.`);
      return next;
    });
  };

  const handleSaveSetting = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setEditSetting(null);
      setEditReason("");
      setToast(`${editSetting?.label} updated. Change has been audited.`);
    }, 900);
  };

  const valid = editReason.trim() && editValue !== "" && !isNaN(Number(editValue));

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <SectionHeader title="Settings" description="Platform configuration and account preferences." />

      {/* Account */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Account</h2>
        <StatRow label="Full Name" value={adminUser?.name ?? "—"} />
        <StatRow label="Email" value={adminUser?.email ?? "—"} />
        <StatRow label="Role" value={<span className="text-amber-700 font-medium text-xs bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{ROLE === "owner" ? "Owner" : (adminUser?.role ?? "—")}</span>} />
        <StatRow label="Two-Factor Auth" value={<span className="text-green-600 font-medium text-xs">Enabled</span>} />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm">Edit Profile</Button>
          <Button variant="secondary" size="sm">Change Password</Button>
        </div>
      </Card>

      {/* Operational settings — owner only */}
      {ROLE === "owner" ? (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Operational Settings</h2>
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">Owner only</span>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Changes to these settings take effect immediately and are audited. They never modify historical transactions.
            All values require a reason before saving.
          </p>
          <div className="flex flex-col">
            {operationalSettings.map(s => (
              <div key={s.key} className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0 gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{s.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-base font-semibold text-slate-800 tabular-nums">{s.value}</span>
                    <span className="text-xs text-slate-400 ml-1">{s.unit}</span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => { setEditSetting(s); setEditValue(s.value.toString()); setEditReason(""); }}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-5 border-slate-200">
          <h2 className="text-sm font-semibold text-slate-500 mb-2">Operational Settings</h2>
          <p className="text-xs text-slate-400">Owner role required to view and edit operational settings.</p>
        </Card>
      )}

      {/* Notifications */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Notification Preferences</h2>
        {NOTIF_LABELS.map(n => (
          <div key={n.key} className="flex items-start justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">{n.label}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.description}</p>
            </div>
            <button
              onClick={() => toggleNotif(n.key)}
              role="switch"
              aria-checked={notifs[n.key]}
              aria-label={n.label}
              className={`relative mt-0.5 w-9 h-5 rounded-full transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/30 focus-visible:ring-offset-1
                ${notifs[n.key] ? "bg-[#BE1B2C]" : "bg-slate-200"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${notifs[n.key] ? "left-4" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </Card>

      {/* Danger zone */}
      <Card className="p-5 border-red-200">
        <h2 className="text-sm font-semibold text-red-700 mb-2">Danger Zone</h2>
        <p className="text-xs text-slate-500 mb-4">These actions affect your session and account. They are irreversible.</p>
        <Button variant="danger" size="sm">Revoke All Sessions</Button>
      </Card>

      {/* Edit modal */}
      <Modal open={!!editSetting} onClose={() => setEditSetting(null)} title={`Edit: ${editSetting?.label}`}>
        {editSetting && (
          <div className="flex flex-col gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-3 text-xs text-amber-800">
              Changes take effect immediately and are audited. Invalid values may affect ride operations.
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">New Value ({editSetting.unit}) <span className="text-red-500">*</span></label>
              <input type="number" min={editSetting.min} max={editSetting.max} value={editValue} onChange={e => setEditValue(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
              <p className="text-xs text-slate-400">Allowed range: {editSetting.min}–{editSetting.max} {editSetting.unit}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Reason for change <span className="text-red-500">*</span></label>
              <textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={2}
                placeholder="Why is this setting being changed?"
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditSetting(null)}>Cancel</Button>
              <Button variant="primary" disabled={!valid} loading={loading} onClick={handleSaveSetting}>Save & Audit</Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}
