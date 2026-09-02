import { useCallback, useEffect, useMemo, useState } from "react";
import PointsPageShell from "../../components/driverPoints/PointsPageShell";
import PointsPagination from "../../components/driverPoints/PointsPagination";
import ConfirmDialog from "../../components/driverPoints/ConfirmDialog";
import { PointsEmpty, PointsError, PointsLoading } from "../../components/driverPoints/PointsStates";
import { createIdempotencyKey, creditPurchaseRequest, getPurchaseRequests, pointsErrorMessage, transitionPurchaseRequest } from "../../utils/pointsAdminApi";
import { getPointsAccess } from "../../utils/pointsPermissions";

const NEXT = {
  pending: ["credited", "contacted", "rejected", "cancelled"],
  contacted: ["credited", "payment_pending", "rejected", "cancelled"],
  payment_pending: ["credited", "payment_verified", "rejected", "cancelled"],
  payment_verified: ["credited", "rejected", "cancelled"],
};

const PurchaseRequests = () => {
  const access = getPointsAccess();
  const [filters, setFilters] = useState({ search: "", status: "", from: "", to: "", page: 1, limit: 25 });
  const [result, setResult] = useState({ requests: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 1 } });
  const [state, setState] = useState({ loading: true, error: "" });
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({ reason: "", paymentReference: "", paymentAmount: "", currency: "", paymentMethod: "" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const key = useMemo(() => action ? createIdempotencyKey(`purchase-${action.request._id}`) : "", [action]);
  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try { const response = await getPurchaseRequests(filters); setResult({ requests: response.requests || [], pagination: response.pagination }); setState({ loading: false, error: "" }); }
    catch (error) { setState({ loading: false, error: pointsErrorMessage(error, "Purchase requests could not be loaded.") }); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const change = (name) => (event) => setFilters((value) => ({ ...value, [name]: event.target.value, page: 1 }));
  const begin = (request, status) => {
    setForm({
      reason: "",
      paymentReference: request.paymentReference || `PAY-${request.clientRequestId || request._id}`,
      paymentAmount: request.packSnapshot?.price ?? "",
      currency: request.packSnapshot?.currency || "AED",
      paymentMethod: "Admin verification",
    });
    setActionError("");
    setAction({ request, status });
  };
  const perform = async () => {
    if (busy || !action) return;
    setBusy(true); setActionError("");
    const defaultReason = action.status === "credited"
      ? "Purchase request approved and credited"
      : ["rejected", "cancelled"].includes(action.status)
        ? `Request ${action.status}`
        : `Transitioned to ${action.status}`;
    const payloadReason = form.reason.trim() || defaultReason;
    try {
      if (action.status === "credited") {
        await creditPurchaseRequest(action.request._id, {
          reason: payloadReason,
          paymentReference: form.paymentReference.trim() || `PAY-${action.request.clientRequestId || action.request._id}`,
          paymentAmount: form.paymentAmount ? Number(form.paymentAmount) : (action.request.packSnapshot?.price ?? 0),
          currency: form.currency.trim().toUpperCase() || "AED",
          paymentMethod: form.paymentMethod.trim() || "Admin verification",
        }, key);
      } else {
        await transitionPurchaseRequest(action.request._id, {
          status: action.status,
          reason: payloadReason,
          paymentReference: form.paymentReference.trim(),
          paymentAmount: form.paymentAmount ? Number(form.paymentAmount) : undefined,
          currency: form.currency.trim().toUpperCase() || undefined,
          paymentMethod: form.paymentMethod.trim() || undefined,
        });
      }
      setAction(null); await load();
    } catch (error) { setActionError(pointsErrorMessage(error, "The purchase request could not be updated.")); }
    finally { setBusy(false); }
  };
  const terminal = ["rejected", "cancelled"].includes(action?.status);
  const payment = action?.status === "payment_verified";
  return <PointsPageShell title="Purchase Requests" description="Sequential payment verification and idempotent point crediting." isOwner={access.isOwner}>
    <div className="tile points-toolbar"><div className="points-field"><label htmlFor="pr-search">Reference</label><input id="pr-search" type="search" value={filters.search} onChange={change("search")} /></div><div className="points-field"><label htmlFor="pr-status">Status</label><select id="pr-status" value={filters.status} onChange={change("status")}><option value="">All</option>{["pending","contacted","payment_pending","payment_verified","credited","rejected","cancelled"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></div><div className="points-field"><label htmlFor="pr-from">From</label><input id="pr-from" type="date" value={filters.from} onChange={change("from")} /></div><div className="points-field"><label htmlFor="pr-to">To</label><input id="pr-to" type="date" value={filters.to} onChange={change("to")} /></div></div>
    <section className="tile">{state.loading ? <PointsLoading /> : state.error ? <PointsError message={state.error} onRetry={load} /> : !result.requests.length ? <PointsEmpty title="No purchase requests" message="No requests match these filters." /> : <><div className="points-table-wrap"><table className="points-table"><thead><tr><th>Request reference</th><th>Driver</th><th>Pack / points</th><th>Status</th><th>Created</th><th>Payment reference</th><th>Assigned admin</th><th>Actions</th></tr></thead><tbody>{result.requests.map((request) => <tr key={request._id}><td>{request.clientRequestId || request._id}</td><td>{request.driver?.fullName || request.driverId}</td><td>{request.packSnapshot?.name || "Custom"} · {request.packSnapshot?.points || request.requestedPoints} points</td><td><span className={`points-badge ${request.status === "credited" ? "points-badge--success" : request.status === "pending" ? "points-badge--warning" : ""}`}>{request.status.replaceAll("_", " ")}</span></td><td>{new Date(request.createdAt).toLocaleString()}</td><td>{request.paymentReference || "—"}</td><td>{request.assignedAdmin?.fullName || "Unassigned"}</td><td><div className="points-actions">{access.canManageRequests && (NEXT[request.status] || []).map((status) => <button key={status} type="button" className={`btn btn-sm ${status === "credited" ? "btn-success" : ["rejected","cancelled"].includes(status) ? "btn-outline-danger" : "btn-outline-primary"}`} onClick={() => begin(request, status)}>{status === "credited" ? "Approve & Credit" : status.replaceAll("_", " ")}</button>)}</div></td></tr>)}</tbody></table></div><PointsPagination pagination={result.pagination} onChange={(page) => setFilters((value) => ({ ...value, ...page }))} /></>}</section>
    {action && <ConfirmDialog title={`${action.status === "credited" ? "Approve & Credit" : action.status.replaceAll("_", " ")} request`} message={`Confirm action for ${action.request.clientRequestId || action.request._id} (${action.request.driver?.fullName || action.request.driverId} - ${action.request.packSnapshot?.points || action.request.requestedPoints} points).`} confirmLabel={action.status === "credited" ? "Approve & Credit points" : "Confirm transition"} dangerous={terminal} busy={busy} onCancel={() => setAction(null)} onConfirm={perform}><>{actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}<div className="points-form">{payment && <><div><label htmlFor="pay-reference">Payment reference</label><input id="pay-reference" value={form.paymentReference} onChange={(event) => setForm({ ...form, paymentReference: event.target.value })} /></div><div><label htmlFor="pay-amount">Amount paid</label><input id="pay-amount" type="number" min="0" step=".01" value={form.paymentAmount} onChange={(event) => setForm({ ...form, paymentAmount: event.target.value })} /></div><div><label htmlFor="pay-currency">Currency</label><input id="pay-currency" maxLength="3" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></div><div><label htmlFor="pay-method">Payment method</label><input id="pay-method" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} /></div></>}<div className="points-form__wide"><label htmlFor="pr-reason">Reason (Optional)</label><textarea id="pr-reason" rows="3" placeholder={action.status === "credited" ? "e.g. Purchase request approved and credited" : "Optional note"} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></div></div></></ConfirmDialog>}
  </PointsPageShell>;
};
export default PurchaseRequests;
