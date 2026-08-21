import { useCallback, useEffect, useState } from "react";
import PointsPageShell from "../../components/driverPoints/PointsPageShell";
import ConfirmDialog from "../../components/driverPoints/ConfirmDialog";
import { PointsEmpty, PointsError, PointsLoading } from "../../components/driverPoints/PointsStates";
import { createPointPack, getPointPacks, pointsErrorMessage, updatePointPack } from "../../utils/pointsAdminApi";
import { getPointsAccess } from "../../utils/pointsPermissions";

const EMPTY = { name: "", points: "", price: "", currency: "", active: true, displayOrder: 0 };
const PointPacks = () => {
  const { isOwner } = getPointsAccess();
  const [packs, setPacks] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [editor, setEditor] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setState({ loading: true, error: "" });
    try { const response = await getPointPacks(); setPacks(response.packs || []); setState({ loading: false, error: "" }); }
    catch (requestError) { setState({ loading: false, error: pointsErrorMessage(requestError, "Point packs could not be loaded.") }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (busy) return;
    setBusy(true); setError("");
    const payload = { ...editor, points: Number(editor.points), price: Number(editor.price), displayOrder: Number(editor.displayOrder), currency: editor.currency.toUpperCase() };
    try { if (editor._id) await updatePointPack(editor._id, payload); else await createPointPack(payload); setEditor(null); setConfirming(false); await load(); }
    catch (requestError) { setError(pointsErrorMessage(requestError, "The pack could not be saved.")); setConfirming(false); }
    finally { setBusy(false); }
  };
  const quickUpdate = async (pack, changes) => {
    try { await updatePointPack(pack._id, changes); await load(); }
    catch (requestError) { setState({ loading: false, error: pointsErrorMessage(requestError, "The pack could not be updated.") }); }
  };
  const invalid = !editor?.name?.trim() || !Number.isSafeInteger(Number(editor?.points)) || Number(editor?.points) <= 0 || Number(editor?.price) < 0 || editor?.currency?.trim().length !== 3;
  return <PointsPageShell title="Point Packs" description="Owner-managed pricing. No price is created or inferred by the interface." isOwner={isOwner} actions={isOwner ? <button className="btn btn-primary" type="button" onClick={() => setEditor({ ...EMPTY, displayOrder: packs.length })}>Create pack</button> : null}>
    {!isOwner && <div className="tile p-3 points-alert">Read-only: only the Drewel Owner can create or edit point packs.</div>}
    <section className="tile">{state.loading ? <PointsLoading /> : state.error ? <PointsError message={state.error} onRetry={load} /> : !packs.length ? <PointsEmpty title="No point packs" message="Create the first pack using approved pricing." /> : <div className="points-table-wrap"><table className="points-table"><thead><tr><th>Order</th><th>Name</th><th>Points</th><th>Price</th><th>Currency</th><th>Active</th>{isOwner && <th>Actions</th>}</tr></thead><tbody>{packs.map((pack, index) => <tr key={pack._id}><td>{pack.displayOrder}</td><td>{pack.name}</td><td>{pack.points}</td><td>{pack.price}</td><td>{pack.currency}</td><td><span className={`points-badge ${pack.active ? "points-badge--success" : ""}`}>{pack.active ? "Active" : "Inactive"}</span></td>{isOwner && <td><div className="points-actions"><button className="btn btn-sm btn-outline-primary" type="button" onClick={() => setEditor({ ...pack })}>Edit</button><button className="btn btn-sm btn-light" type="button" onClick={() => quickUpdate(pack, { active: !pack.active })}>{pack.active ? "Deactivate" : "Activate"}</button><button className="btn btn-sm btn-light" type="button" disabled={index === 0} aria-label={`Move ${pack.name} up`} onClick={() => quickUpdate(pack, { displayOrder: Math.max(0, Number(pack.displayOrder) - 1) })}>↑</button><button className="btn btn-sm btn-light" type="button" disabled={index === packs.length - 1} aria-label={`Move ${pack.name} down`} onClick={() => quickUpdate(pack, { displayOrder: Number(pack.displayOrder) + 1 })}>↓</button></div></td>}</tr>)}</tbody></table></div>}</section>
    {editor && !confirming && <div className="points-modal" role="presentation"><section className="points-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="pack-title"><header><h2 id="pack-title">{editor._id ? "Edit point pack" : "Create point pack"}</h2><button className="points-icon-button" type="button" aria-label="Close" onClick={() => setEditor(null)}>&times;</button></header><div className="points-modal__body">{error && <div className="alert alert-danger">{error}</div>}<div className="points-form"><div><label htmlFor="pack-name">Name</label><input id="pack-name" value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} /></div><div><label htmlFor="pack-points">Points</label><input id="pack-points" type="number" min="1" step="1" value={editor.points} onChange={(event) => setEditor({ ...editor, points: event.target.value })} /></div><div><label htmlFor="pack-price">Price</label><input id="pack-price" type="number" min="0" step=".01" value={editor.price} onChange={(event) => setEditor({ ...editor, price: event.target.value })} /></div><div><label htmlFor="pack-currency">Currency</label><input id="pack-currency" maxLength="3" value={editor.currency} onChange={(event) => setEditor({ ...editor, currency: event.target.value.toUpperCase() })} /></div><div><label htmlFor="pack-order">Display order</label><input id="pack-order" type="number" min="0" step="1" value={editor.displayOrder} onChange={(event) => setEditor({ ...editor, displayOrder: event.target.value })} /></div><div><label><input type="checkbox" checked={editor.active} onChange={(event) => setEditor({ ...editor, active: event.target.checked })} /> Active</label></div></div></div><footer><button className="btn btn-light" type="button" onClick={() => setEditor(null)}>Cancel</button><button className="btn btn-primary" type="button" disabled={invalid} onClick={() => setConfirming(true)}>Review pack</button></footer></section></div>}
    {editor && confirming && <ConfirmDialog title={editor._id ? "Confirm pack changes" : "Confirm new pack"} message={`${editor.name}: ${editor.points} points for ${editor.price} ${editor.currency}.`} busy={busy} onCancel={() => setConfirming(false)} onConfirm={save} />}
  </PointsPageShell>;
};
export default PointPacks;
