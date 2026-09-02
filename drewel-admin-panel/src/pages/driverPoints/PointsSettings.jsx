import { useCallback, useEffect, useState } from "react";
import PointsPageShell from "../../components/driverPoints/PointsPageShell";
import ConfirmDialog from "../../components/driverPoints/ConfirmDialog";
import { PointsError, PointsLoading } from "../../components/driverPoints/PointsStates";
import { getPointSettings, pointsErrorMessage, updatePointSettings } from "../../utils/pointsAdminApi";
import { getPointsAccess } from "../../utils/pointsPermissions";

const FIELDS = [
  ["welcomeDriverPoints", "Welcome points", 0],
  ["rideOfferPointsCost", "Offer reservation lock (points)", 1],
  ["lowBalanceThreshold", "Low-balance threshold", 0],
  ["offerExpirationSeconds", "Offer expiration (seconds)", 30],
  ["maximumConcurrentOffers", "Maximum concurrent offers", 1],
  ["largeAdjustmentThreshold", "Large-adjustment confirmation threshold", 1],
];

const FLOAT_FIELDS = [
  ["commissionRate", "Commission rate (0-1, e.g. 0.10 = 10%)", 0],
  ["pointsPerAED", "Points per AED (e.g. 10 = 10 points = 1 AED)", 0.01],
];

const PointsSettings = () => {
  const { isOwner } = getPointsAccess();
  const [settings, setSettings] = useState(null);
  const [reason, setReason] = useState("");
  const [state, setState] = useState({ loading: true, error: "" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try {
      const response = await getPointSettings();
      setSettings(response.settings);
      setState({ loading: false, error: "" });
    } catch (error) {
      setState({
        loading: false,
        error: pointsErrorMessage(error, "Settings could not be loaded."),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const values = Object.fromEntries(
        FIELDS.map(([name]) => [name, Number(settings[name])])
      );
      for (const [name] of FLOAT_FIELDS) {
        if (settings?.[name] !== undefined && settings[name] !== "") {
          values[name] = Number(settings[name]);
        }
      }
      const response = await updatePointSettings({
        ...values,
        reason: reason.trim() || "Point settings update",
      });
      setSettings(response.settings);
      setReason("");
      setConfirming(false);
      setState({ loading: false, error: "" });
    } catch (error) {
      setConfirming(false);
      setState({
        loading: false,
        error: pointsErrorMessage(error, "Settings could not be updated."),
      });
    } finally {
      setBusy(false);
    }
  };

  const invalid =
    !isOwner ||
    FIELDS.some(
      ([name, , min]) =>
        !Number.isSafeInteger(Number(settings?.[name])) ||
        Number(settings?.[name]) < min
    ) ||
    FLOAT_FIELDS.some(
      ([name, , min]) =>
        settings?.[name] === undefined ||
        settings[name] === "" ||
        Number(settings[name]) < min
    );

  return (
    <PointsPageShell
      title="Settings"
      description="Owner-only policy values used by new operations."
      isOwner={isOwner}
    >
      {state.loading ? (
        <div className="tile">
          <PointsLoading />
        </div>
      ) : state.error && !settings ? (
        <div className="tile">
          <PointsError message={state.error} onRetry={load} />
        </div>
      ) : (
        <section className="tile p-4">
          <div className="points-alert">
            <strong>Non-retroactive:</strong> changing these values does not
            rewrite completed transactions or historical balances.
          </div>
          {!isOwner && (
            <div className="points-alert">
              Read-only: only the Drewel Owner can change these settings.
            </div>
          )}
          {state.error && (
            <div className="alert alert-danger" role="alert">
              {state.error}
            </div>
          )}
          <div className="points-form">
            {FIELDS.map(([name, label, min]) => (
              <div key={name}>
                <label htmlFor={`setting-${name}`}>{label}</label>
                <input
                  id={`setting-${name}`}
                  type="number"
                  min={min}
                  step="1"
                  disabled={!isOwner}
                  value={settings?.[name] ?? ""}
                  onChange={(event) =>
                    setSettings({ ...settings, [name]: event.target.value })
                  }
                />
              </div>
            ))}
            {FLOAT_FIELDS.map(([name, label, min]) => (
              <div key={name}>
                <label htmlFor={`setting-${name}`}>{label}</label>
                <input
                  id={`setting-${name}`}
                  type="number"
                  min={min}
                  step="0.01"
                  disabled={!isOwner}
                  value={settings?.[name] ?? ""}
                  onChange={(event) =>
                    setSettings({ ...settings, [name]: event.target.value })
                  }
                />
              </div>
            ))}
            <div className="points-form__wide">
              <label htmlFor="settings-reason">
                Reason for change (Optional)
              </label>
              <textarea
                id="settings-reason"
                rows="3"
                disabled={!isOwner}
                placeholder="Optional reason for change (default: Point settings update)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </div>
          {isOwner && (
            <div className="mt-3">
              <button
                className="btn btn-primary"
                type="button"
                disabled={invalid}
                onClick={() => setConfirming(true)}
              >
                Review settings update
              </button>
            </div>
          )}
        </section>
      )}
      {confirming && (
        <ConfirmDialog
          title="Confirm policy settings"
          message="These settings apply to future operations only. The change will be audited."
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={save}
        />
      )}
    </PointsPageShell>
  );
};

export default PointsSettings;
