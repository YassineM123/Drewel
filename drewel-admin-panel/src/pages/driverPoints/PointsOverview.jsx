import { useCallback, useEffect, useState } from "react";
import PointsPageShell from "../../components/driverPoints/PointsPageShell";
import { PointsError, PointsLoading } from "../../components/driverPoints/PointsStates";
import { getPointsAccess } from "../../utils/pointsPermissions";
import { getPointsOverview, pointsErrorMessage } from "../../utils/pointsAdminApi";

const METRICS = [
  ["totalPointsIssued", "Total points issued"],
  ["welcomePointsGranted", "Welcome points granted"],
  ["purchasedPointsCredited", "Purchased points credited"],
  ["pointsConsumed", "Points consumed"],
  ["pointsCurrentlyReserved", "Points currently reserved"],
  ["refunds", "Refunds"],
  ["activeWallets", "Active wallets"],
  ["pendingPurchaseRequests", "Pending purchase requests"],
  ["suspiciousAdjustments", "Suspicious adjustments"],
];

const PointsOverview = () => {
  const { isOwner } = getPointsAccess();
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [applied, setApplied] = useState({});
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const load = useCallback(async () => {
    setState((value) => ({ ...value, loading: true, error: "" }));
    try {
      const response = await getPointsOverview(applied);
      setState({ loading: false, data: response.overview, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: pointsErrorMessage(error, "Overview could not be loaded.") });
    }
  }, [applied]);
  useEffect(() => { load(); }, [load]);
  return (
    <PointsPageShell title="Overview" description="Auditable wallet activity and operational totals. No decorative estimates." isOwner={isOwner}>
      <form className="tile points-toolbar" onSubmit={(event) => { event.preventDefault(); setApplied(filters); }}>
        <div className="points-field"><label htmlFor="overview-from">From</label><input id="overview-from" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></div>
        <div className="points-field"><label htmlFor="overview-to">To</label><input id="overview-to" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></div>
        <button className="btn btn-primary" type="submit">Apply dates</button>
        <button className="btn btn-light" type="button" onClick={() => { setFilters({ from: "", to: "" }); setApplied({}); }}>Clear</button>
      </form>
      {state.loading ? <div className="tile"><PointsLoading /></div> : state.error ? <div className="tile"><PointsError message={state.error} onRetry={load} /></div> : (
        <section className="points-grid" aria-label="Driver Points totals">{METRICS.map(([key, label]) => <article className="tile points-metric" key={key}><span>{label}</span><strong>{Number(state.data?.[key] || 0).toLocaleString()}</strong></article>)}</section>
      )}
    </PointsPageShell>
  );
};
export default PointsOverview;
