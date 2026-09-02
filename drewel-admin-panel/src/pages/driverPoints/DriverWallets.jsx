import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PointsPageShell from "../../components/driverPoints/PointsPageShell";
import PointsPagination from "../../components/driverPoints/PointsPagination";
import { PointsEmpty, PointsError, PointsLoading } from "../../components/driverPoints/PointsStates";
import AdjustmentModal from "../../components/driverPoints/AdjustmentModal";
import { getDriverWallets, pointsErrorMessage } from "../../utils/pointsAdminApi";
import { getPointsAccess } from "../../utils/pointsPermissions";

const DriverWallets = () => {
  const access = getPointsAccess();
  const [filters, setFilters] = useState({ search: "", verificationStatus: "", balanceState: "", page: 1, limit: 25 });
  const [result, setResult] = useState({ drivers: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } });
  const [state, setState] = useState({ loading: true, error: "" });
  const [adjustment, setAdjustment] = useState(null);
  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try {
      const response = await getDriverWallets(filters);
      setResult({ drivers: response.drivers || [], pagination: response.pagination });
      setState({ loading: false, error: "" });
    } catch (error) { setState({ loading: false, error: pointsErrorMessage(error, "Wallets could not be loaded.") }); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const setFilter = (name) => (event) => setFilters((value) => ({ ...value, [name]: event.target.value, page: 1 }));
  return (
    <PointsPageShell title="Driver Wallets" description="Search balances and open the immutable wallet ledger." isOwner={access.isOwner}>
      <div className="tile points-toolbar">
        <div className="points-field"><label htmlFor="wallet-search">Driver name or ID</label><input id="wallet-search" type="search" value={filters.search} onChange={setFilter("search")} /></div>
        <div className="points-field"><label htmlFor="wallet-verification">Verification</label><select id="wallet-verification" value={filters.verificationStatus} onChange={setFilter("verificationStatus")}><option value="">All</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select></div>
        <div className="points-field"><label htmlFor="wallet-balance">Balance</label><select id="wallet-balance" value={filters.balanceState} onChange={setFilter("balanceState")}><option value="">All</option><option value="normal">Normal</option><option value="low">Low</option><option value="zero">Zero</option><option value="reserved">Has reserved points</option></select></div>
      </div>
      <section className="tile">
        {state.loading ? <PointsLoading label="Loading driver wallets..." /> : state.error ? <PointsError message={state.error} onRetry={load} /> : !result.drivers.length ? <PointsEmpty title="No wallets found" message="Try changing the search or filters." /> : <>
          <div className="points-table-wrap"><table className="points-table"><thead><tr><th>Driver</th><th>Driver ID</th><th>Verification</th><th>Available</th><th>≈ AED</th><th>Reserved</th><th>Purchased</th><th>Bonus</th><th>Rides charged</th><th>Last transaction</th><th>Actions</th></tr></thead><tbody>{result.drivers.map((driver) => <tr key={driver.id}><td><strong>{driver.fullName || "Unnamed driver"}</strong></td><td><code>{driver.id}</code></td><td><span className={`points-badge ${driver.verificationStatus === "verified" ? "points-badge--success" : "points-badge--warning"}`}>{driver.verificationStatus}</span></td><td>{driver.wallet?.availablePoints ?? 0}</td><td>{(driver.wallet?.equivalentAED ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>{driver.wallet?.reservedPoints ?? 0}</td><td>{driver.wallet?.availablePurchasedPoints ?? driver.wallet?.purchasedPoints ?? 0}</td><td>{driver.wallet?.availableBonusPoints ?? driver.wallet?.bonusPoints ?? 0}</td><td>{driver.confirmedRidesCharged || 0}</td><td>{driver.lastTransaction ? <>{driver.lastTransaction.type}<br/><small>{new Date(driver.lastTransaction.createdAt).toLocaleString()}</small></> : "None"}</td><td><div className="points-actions"><Link className="btn btn-sm btn-outline-primary" to={`/points/balances/${driver.id}`}>View wallet</Link>{access.canAdjust && <><button className="btn btn-sm btn-success" type="button" onClick={() => setAdjustment({ driver, mode: "credit-free" })}>Add system points</button><button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setAdjustment({ driver, mode: "debit" })}>Debit/correct</button></>}</div></td></tr>)}</tbody></table></div>
          <PointsPagination pagination={result.pagination} onChange={(page) => setFilters((value) => ({ ...value, ...page }))} />
        </>}
      </section>
      {adjustment && <AdjustmentModal driver={adjustment.driver} mode={adjustment.mode} onClose={() => setAdjustment(null)} onSuccess={() => { setAdjustment(null); load(); }} />}
    </PointsPageShell>
  );
};
export default DriverWallets;
