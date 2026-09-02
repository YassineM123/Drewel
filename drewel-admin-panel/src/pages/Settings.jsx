import { useCallback, useEffect, useState } from "react";
import { SectionHeader, Card, StatRow, Button, Modal, Toast, LoadingState, ErrorState } from "../components/ui";
import { getPointSettings, updatePointSettings, pointsErrorMessage } from "../utils/pointsAdminApi";
import { getAdminSettings, settingsErrorMessage } from "../api/domains/settings";

const operationalSettings = [
  { key: "welcomeDriverPoints", label: "Welcome Points", unit: "pts", min: 0, max: 10000, description: "Points credited to a new driver on first approval" },
  { key: "rideOfferPointsCost", label: "Offer Reservation Lock", unit: "pts", min: 1, max: 100, description: "Points reserved when sending a trip offer (released on decline/expiry)" },
  { key: "commissionRate", label: "Commission Rate", unit: "decimal", min: 0, max: 1, description: "Percentage of ride price taken as commission (0.10 = 10%)" },
  { key: "pointsPerAED", label: "Points Per AED", unit: "pts/AED", min: 0.01, max: 1000, description: "How many points equal 1 AED (10 points = 1 AED)" },
  { key: "offerExpirationSeconds", label: "Trip Offer Expiry Time", unit: "sec", min: 10, max: 120, description: "Seconds before an unaccepted trip offer expires" },
  { key: "lowBalanceThreshold", label: "Low Balance Threshold", unit: "pts", min: 0, max: 500, description: "Driver balance below which a low-balance alert fires" },
  { key: "maximumConcurrentOffers", label: "Max Concurrent Offers", unit: "", min: 1, max: 10, description: "Maximum simultaneous trip offers per driver" },
  { key: "largeAdjustmentThreshold", label: "Large Adjustment Threshold", unit: "pts", min: 1, max: 10000, description: "Point adjustment above which admin confirmation is required" },
];

const NOTIF_LABELS = [
  { key: "sla_breach",         label: "SLA breach alerts",            description: "Notified when a ride exceeds the stuck-ride threshold" },
  { key: "stuck_ride",         label: "Stuck ride alerts",             description: "Notified when a ride is automatically flagged as stuck" },
  { key: "low_balance",        label: "Low driver balance warnings",  description: "Notified when a driver's point balance drops below threshold" },
  { key: "restricted_changes", label: "Restricted account changes",   description: "Notified when a driver or user account is restricted or unrestricted" },
];

function getAdminInfo() {
  try {
    return JSON.parse(localStorage.getItem("admin") || "{}");
  } catch {
    return {};
  }
}

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editSetting, setEditSetting] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [notifs, setNotifs] = useState(() => {
    const initial = {};
    NOTIF_LABELS.forEach((n) => { initial[n.key] = true; });
    return initial;
  });

  const admin = getAdminInfo();
  const adminName = admin.fullName || admin.name || "Admin";
  const adminEmail = admin.email || "—";
  const adminRole = String(admin.role || "admin").trim().toLowerCase();
  const isOwner = adminRole === "owner";

  const load = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError("");
      const adminResult = await getAdminSettings(signal);
      const fallbackSettings = adminResult?.settings || adminResult;
      setSettings(fallbackSettings);

      const pointResult = await Promise.allSettled([getPointSettings(signal)]);
      if (pointResult[0].status === "fulfilled") {
        setSettings({
          ...fallbackSettings,
          ...(pointResult[0].value?.settings || pointResult[0].value),
        });
      }
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      setError(settingsErrorMessage(err, "Settings could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const toggleNotif = (key) => {
    setNotifs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setToast(`"${NOTIF_LABELS.find((n) => n.key === key)?.label}" ${next[key] ? "enabled" : "disabled"}.`);
      return next;
    });
  };

  const handleSaveSetting = async () => {
    if (!editSetting || !isOwner) return;
    setSaveLoading(true);
    try {
      const values = {};
      operationalSettings.forEach((s) => {
        values[s.key] = Number(settings?.[s.key] ?? 0);
      });
      values[editSetting.key] = Number(editValue);
      const result = await updatePointSettings({ ...values, reason: editReason });
      setSettings(result?.settings || result);
      setEditSetting(null);
      setEditReason("");
      setToast(`${editSetting.label} updated. Change has been audited.`);
    } catch (err) {
      setToast(pointsErrorMessage(err, "Failed to update setting."));
    } finally {
      setSaveLoading(false);
    }
  };

  const numericEditValue = Number(editValue);
  const valid = isOwner
    && editReason.trim().length >= 3
    && editValue !== ""
    && !Number.isNaN(numericEditValue)
    && numericEditValue >= Number(editSetting?.min ?? Number.NEGATIVE_INFINITY)
    && numericEditValue <= Number(editSetting?.max ?? Number.POSITIVE_INFINITY);

  if (loading) return <LoadingState label="Loading settings..." />;
  if (error && !settings) return <ErrorState title="Unable to load settings" description={error} action={<Button variant="secondary" onClick={() => load()}>Retry</Button>} />;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <SectionHeader title="Settings" description="Platform configuration and account preferences." />

      {/* Account */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Account</h2>
        <StatRow label="Full Name" value={adminName} />
        <StatRow label="Email" value={adminEmail} />
        <StatRow label="Role" value={
          <span className="text-amber-700 font-medium text-xs bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full capitalize">{adminRole}</span>
        } />
        <StatRow label="Two-Factor Auth" value={<span className="text-green-600 font-medium text-xs">Enabled</span>} />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm">Edit Profile</Button>
          <Button variant="secondary" size="sm">Change Password</Button>
        </div>
      </Card>

      {/* Operational settings */}
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
          {operationalSettings.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{s.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-base font-semibold text-slate-800 tabular-nums">{settings?.[s.key] ?? "—"}</span>
                  {s.unit && <span className="text-xs text-slate-400 ml-1">{s.unit}</span>}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!isOwner || settings?.[s.key] === undefined}
                  onClick={() => { setEditSetting(s); setEditValue(String(settings?.[s.key] ?? "")); setEditReason(""); }}
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Notification Preferences</h2>
        {NOTIF_LABELS.map((n) => (
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
              className={`relative mt-0.5 w-9 h-5 rounded-full transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BE1B2C]/30 focus-visible:ring-offset-1
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
              <label className="text-sm font-medium text-slate-700">New Value {editSetting.unit ? `(${editSetting.unit})` : ""} <span className="text-red-500">*</span></label>
              <input type="number" min={editSetting.min} max={editSetting.max} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 focus:border-[#BE1B2C]/40 transition-all" />
              <p className="text-xs text-slate-400">Allowed range: {editSetting.min}–{editSetting.max}{editSetting.unit ? ` ${editSetting.unit}` : ""}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Reason for change <span className="text-red-500">*</span></label>
              <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={2}
                placeholder="Why is this setting being changed?"
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 focus:border-[#BE1B2C]/40 resize-none" />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditSetting(null)}>Cancel</Button>
              <Button variant="primary" disabled={!valid} loading={saveLoading} onClick={handleSaveSetting}>Save & Audit</Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast} type={toast.toLowerCase().includes("failed") ? "error" : "success"} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Settings;
