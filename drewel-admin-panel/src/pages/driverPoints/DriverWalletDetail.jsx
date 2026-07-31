import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PointsPageShell from "../../components/driverPoints/PointsPageShell";
import { PointsError, PointsLoading } from "../../components/driverPoints/PointsStates";
import AdjustmentModal from "../../components/driverPoints/AdjustmentModal";
import { getDriverWallet, pointsErrorMessage } from "../../utils/pointsAdminApi";
import { getPointsAccess } from "../../utils/pointsPermissions";

const DriverWalletDetail = () => {
  const { driverId } = useParams();
  const access = getPointsAccess();
  const [data, setData] = useState(null);
  const [state, setState] = useState({ loading: true, error: "" });
  const [mode, setMode] = useState("");
  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try { setData(await getDriverWallet(driverId)); setState({ loading: false, error: "" }); }
    catch (error) { setState({ loading: false, error: pointsErrorMessage(error, "Wallet could not be loaded.") }); }
  }, [driverId]);
  useEffect(() => { load(); }, [load]);
  const actions = <div className="points-actions"><Link className="btn btn-light" to="/driver-points/wallets">Back</Link>{access.canAdjust && data?.driver && <><button className="btn btn-success" type="button" onClick={() => setMode("credit")}>Add points</button><button className="btn btn-outline-danger" type="button" onClick={() => setMode("debit")}>Debit/correct</button></>}</div>;
  return (
    <PointsPageShell title={data?.driver?.fullName || "Wallet details"} description="Balances and immutable transaction history for one driver." isOwner={access.isOwner} actions={actions}>
      {state.loading ? <div className="tile"><PointsLoading /></div> : state.error ? <div className="tile"><PointsError message={state.error} onRetry={load} /></div> : <>
        <dl className="tile points-detail"><div><dt>Driver ID</dt><dd>{data.driver.id}</dd></div><div><dt>Status</dt><dd>{data.driver.status || "Unknown"}</dd></div><div><dt>Available points</dt><dd>{data.wallet.availablePoints}</dd></div><div><dt>Reserved points</dt><dd>{data.wallet.reservedPoints}</dd></div><div><dt>Purchased points credited</dt><dd>{data.wallet.totalPurchased}</dd></div><div><dt>Bonus points granted</dt><dd>{data.wallet.totalEarnedBonus}</dd></div><div><dt>Points consumed</dt><dd>{data.wallet.totalConsumed}</dd></div><div><dt>Welcome granted</dt><dd>{data.wallet.welcomeBonusGranted ? "Yes" : "No"}</dd></div></dl>
        <section className="tile"><div className="p-3"><h2>Transactions</h2></div><div className="points-table-wrap"><table className="points-table"><thead><tr><th>Date</th><th>Type</th><th>Status</th><th>Points</th><th>Available before</th><th>Available after</th><th>Reference</th><th>Reason</th></tr></thead><tbody>{(data.transactions || []).map((item) => <tr key={item._id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.type}</td><td><span className="points-badge">{item.status}</span></td><td>{item.points}</td><td>{item.previousAvailableBalance}</td><td>{item.newAvailableBalance}</td><td>{item.rideId || item.offerId || item.purchaseRequestId || "—"}</td><td>{item.reason || "—"}</td></tr>)}</tbody></table></div></section>
      </>}
      {mode && data?.driver && <AdjustmentModal driver={{ ...data.driver, wallet: data.wallet }} mode={mode} onClose={() => setMode("")} onSuccess={() => { setMode(""); load(); }} />}
    </PointsPageShell>
  );
};
export default DriverWalletDetail;
