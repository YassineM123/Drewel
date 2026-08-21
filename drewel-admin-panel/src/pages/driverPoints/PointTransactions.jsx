import { useCallback, useEffect, useState } from "react";
import PointsPageShell from "../../components/driverPoints/PointsPageShell";
import PointsPagination from "../../components/driverPoints/PointsPagination";
import { PointsEmpty, PointsError, PointsLoading } from "../../components/driverPoints/PointsStates";
import { getPointTransactions, pointsErrorMessage } from "../../utils/pointsAdminApi";
import { getPointsAccess } from "../../utils/pointsPermissions";

const TYPES = ["welcome_bonus","points_purchase","ride_charge","ride_commission","offer_reserve","offer_release","technical_refund","admin_credit","admin_debit","correction","penalty"];
const PointTransactions = () => {
  const { isOwner } = getPointsAccess();
  const [filters, setFilters] = useState({ search: "", type: "", status: "", from: "", to: "", page: 1, limit: 25 });
  const [searchInput, setSearchInput] = useState("");
  const [result, setResult] = useState({ transactions: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } });
  const [state, setState] = useState({ loading: true, error: "" });
  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try { const response = await getPointTransactions(filters); setResult({ transactions: response.transactions || [], pagination: response.pagination }); setState({ loading: false, error: "" }); }
    catch (error) { setState({ loading: false, error: pointsErrorMessage(error, "Transactions could not be loaded.") }); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timeout = setTimeout(() => setFilters((value) => ({ ...value, search: searchInput.trim(), page: 1 })), 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);
  const change = (name) => (event) => setFilters((value) => ({ ...value, [name]: event.target.value, page: 1 }));
  return <PointsPageShell title="Transactions" description="Read-only ledger. Historical entries cannot be edited or deleted." isOwner={isOwner}>
    <div className="tile points-toolbar"><div className="points-field"><label htmlFor="tx-search">Driver name, driver ID, ride ID or transaction ID</label><input id="tx-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div><div className="points-field"><label htmlFor="tx-type">Type</label><select id="tx-type" value={filters.type} onChange={change("type")}><option value="">All</option>{TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></div><div className="points-field"><label htmlFor="tx-status">Status</label><select id="tx-status" value={filters.status} onChange={change("status")}><option value="">All</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option></select></div><div className="points-field"><label htmlFor="tx-from">From</label><input id="tx-from" type="date" value={filters.from} onChange={change("from")} /></div><div className="points-field"><label htmlFor="tx-to">To</label><input id="tx-to" type="date" value={filters.to} onChange={change("to")} /></div></div>
    <section className="tile">{state.loading ? <PointsLoading /> : state.error ? <PointsError message={state.error} onRetry={load} /> : !result.transactions.length ? <PointsEmpty title="No transactions" message="No ledger entries match these filters." /> : <><div className="points-table-wrap"><table className="points-table"><thead><tr><th>Date</th><th>Driver</th><th>Type</th><th>Status</th><th>Points</th><th>Balance before</th><th>Balance after</th><th>Reference</th><th>Reason</th><th>Admin</th></tr></thead><tbody>{result.transactions.map((item) => <tr key={item._id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.driver?.fullName || item.driverId}</td><td>{item.type}</td><td><span className="points-badge">{item.status}</span></td><td>{item.points}</td><td>{item.previousAvailableBalance}</td><td>{item.newAvailableBalance}</td><td>{item.rideId || item.offerId || item.purchaseRequestId || "—"}</td><td>{item.reason || "—"}</td><td>{item.admin?.fullName || "System"}</td></tr>)}</tbody></table></div><PointsPagination pagination={result.pagination} onChange={(page) => setFilters((value) => ({ ...value, ...page }))} /></>}</section>
  </PointsPageShell>;
};
export default PointTransactions;
