import { useState, useEffect } from "react";
import { Package, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { Card, Button, SectionHeader, Modal, ConfirmDialog, Toast } from "../../components/ui";
import { getPointPacks } from "../../api";

const ROLE = "owner";

interface Pack {
  id: string;
  name: string;
  points: number;
  priceCents: number;
  bonusPct: number;
  active: boolean;
  order: number;
}

const SETTINGS = [
  { key: "welcome_points",    label: "Welcome Points",              value: 100, unit: "pts", description: "Points credited to a new driver on first approval" },
  { key: "ride_offer_cost",   label: "Ride Offer Cost",             value: 20,  unit: "pts", description: "Points deducted from driver on each trip offer sent" },
  { key: "low_bal_threshold", label: "Low Balance Threshold",       value: 20,  unit: "pts", description: "Balance at or below which a driver cannot send offers" },
  { key: "offer_ttl",         label: "Offer TTL",                   value: 300, unit: "sec", description: "Seconds before an unaccepted trip offer expires" },
];

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PointPacks() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [editPack, setEditPack] = useState<Pack | null>(null);
  const [deletePack, setDeletePack] = useState<Pack | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPointPacks();
        if (!cancelled) setPacks(data);
      } catch (err) {
        console.error("Failed to load point packs", err);
      } finally {
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Form state
  const [form, setForm] = useState({ name: "", points: "", priceCents: "", bonusPct: "0" });
  const formValid = form.name.trim() && Number(form.points) > 0 && Number(form.priceCents) > 0;

  const openEdit = (pack: Pack) => {
    setEditPack(pack);
    setForm({ name: pack.name, points: String(pack.points), priceCents: String(pack.priceCents), bonusPct: String(pack.bonusPct) });
  };

  const handleSave = () => {
    if (!formValid) return;
    setLoading(true);
    setTimeout(() => {
      if (editPack) {
        setPacks(prev => prev.map(p => p.id === editPack.id
          ? { ...p, name: form.name, points: Number(form.points), priceCents: Number(form.priceCents), bonusPct: Number(form.bonusPct) }
          : p));
        setToast(`Pack "${form.name}" updated.`);
        setEditPack(null);
      } else {
        const newPack: Pack = {
          id: `PACK-${Date.now()}`,
          name: form.name,
          points: Number(form.points),
          priceCents: Number(form.priceCents),
          bonusPct: Number(form.bonusPct),
          active: true,
          order: packs.length + 1,
        };
        setPacks(prev => [...prev, newPack]);
        setToast(`Pack "${form.name}" created.`);
        setCreateOpen(false);
      }
      setLoading(false);
      setForm({ name: "", points: "", priceCents: "", bonusPct: "0" });
    }, 800);
  };

  const handleDelete = () => {
    setLoading(true);
    setTimeout(() => {
      setPacks(prev => prev.filter(p => p.id !== deletePack?.id));
      setToast(`Pack "${deletePack?.name}" deleted.`);
      setDeletePack(null);
      setLoading(false);
    }, 700);
  };

  const toggleActive = (id: string) => {
    setPacks(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  if (ROLE !== "owner") {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeader title="Packs & Settings" description="Point purchase packages and platform thresholds." />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldCheck size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-500">Owner access required</p>
          <p className="text-xs text-slate-400 mt-1">Only the platform owner can view and edit point packs and settings.</p>
        </div>
      </div>
    );
  }

  const PackForm = () => (
    <div className="flex flex-col gap-4">
      <div className="bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3 text-xs text-amber-800">
        Changes take effect immediately. Existing wallet balances and active reservations are not affected.
      </div>
      {[
        { key: "name",       label: "Pack Name",             placeholder: "e.g. Standard",    type: "text" },
        { key: "points",     label: "Points Granted",        placeholder: "e.g. 250",         type: "number" },
        { key: "priceCents", label: "Price (cents)",         placeholder: "e.g. 1000 = $10",  type: "number" },
        { key: "bonusPct",   label: "Bonus %",               placeholder: "0",                type: "number" },
      ].map(f => (
        <div key={f.key} className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">{f.label}</label>
          <input
            type={f.type}
            value={form[f.key as keyof typeof form]}
            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
          />
        </div>
      ))}
      {form.points && form.priceCents && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-[8px] px-3 py-2">
          Preview: <strong>{Number(form.points)} pts</strong>
          {Number(form.bonusPct) > 0 && <> + <strong>{Math.round(Number(form.points) * Number(form.bonusPct) / 100)} bonus pts</strong></>}
          {" "}for <strong>{fmt(Number(form.priceCents))}</strong>
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={() => { setEditPack(null); setCreateOpen(false); }}>Cancel</Button>
        <Button variant="primary" disabled={!formValid} loading={loading} onClick={handleSave}>
          {editPack ? "Save Changes" : "Create Pack"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <SectionHeader
        title="Packs & Settings"
        description="Point purchase packages and platform threshold configuration. Owner access only."
        actions={
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setForm({ name: "", points: "", priceCents: "", bonusPct: "0" }); setCreateOpen(true); }}>
            New Pack
          </Button>
        }
      />

      {/* Packs */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Package size={15} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800">Purchase Packs</h2>
          <span className="ml-auto text-xs text-slate-400">{packs.filter(p => p.active).length} active</span>
        </div>
        <div className="divide-y divide-slate-100">
          {packs.sort((a, b) => a.order - b.order).map(pack => (
            <div key={pack.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{pack.name}</p>
                  {!pack.active && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full uppercase">Inactive</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pack.points} pts
                  {pack.bonusPct > 0 && <span className="text-amber-600 ml-1">+ {pack.bonusPct}% bonus</span>}
                  {" "}· {fmt(pack.priceCents)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(pack.id)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-[8px] transition-all border
                    ${pack.active
                      ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"}`}
                >
                  {pack.active ? "Active" : "Activate"}
                </button>
                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => openEdit(pack)} />
                <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeletePack(pack)} className="text-red-400 hover:text-red-600 hover:bg-red-50" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Platform settings */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800">Platform Thresholds</h2>
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full font-medium">Owner only</span>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          These values control ride offer behavior. Changes are applied server-side and audited. They never retroactively change historical transactions.
        </p>
        <div className="flex flex-col">
          {SETTINGS.map(s => (
            <div key={s.key} className="flex items-center justify-between gap-4 py-3.5 border-b border-slate-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{s.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-base font-semibold text-slate-800 tabular-nums">{s.value}</span>
                <span className="text-xs text-slate-400">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
          To change platform thresholds, use the Settings page where changes require a reason and are audited.
        </p>
      </Card>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Point Pack">
        <PackForm />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editPack} onClose={() => setEditPack(null)} title={`Edit Pack: ${editPack?.name}`}>
        <PackForm />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletePack}
        onClose={() => setDeletePack(null)}
        onConfirm={handleDelete}
        loading={loading}
        title="Delete Pack"
        variant="danger"
        confirmLabel="Delete"
        message={<p>Permanently delete <strong>{deletePack?.name}</strong>? Drivers who already purchased points are not affected.</p>}
      />

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}
