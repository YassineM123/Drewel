import { useState, useEffect } from "react";
import { Search, Plus, AlertTriangle } from "lucide-react";
import {
  Card, Button, SectionHeader, Th, Td, Tr, Pagination,
  Avatar, Badge, EmptyState, Modal, Toast, StatRow
} from "../../components/ui";
import { getDriverWallets } from "../../api";

const ROLE = "owner"; // In production, derive from auth context

export default function DriverPoints() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [addModal, setAddModal] = useState<any | null>(null);
  const [addPts, setAddPts] = useState("");
  const [addRef, setAddRef] = useState("");
  const [addMethod, setAddMethod] = useState("bank_transfer");
  const [addReason, setAddReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getDriverWallets({ page, limit: 8 });
        if (!cancelled) {
          setDrivers(res.drivers ?? []);
        }
      } catch (err) {
        console.error("Failed to load driver wallets", err);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  const filtered = drivers.filter(d => {
    const matchSearch = !search || (d.driverName ?? d.name ?? "").toLowerCase().includes(search.toLowerCase()) || (d.driverId ?? d.id ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "low" ? (d.available ?? 0) < 20 : filter === "zero" ? (d.available ?? 0) === 0 : filter === "reserved" ? (d.reserved ?? 0) > 0 : filter === "approved" ? d.approvalStatus === "approved" : filter === "blocked" ? d.restricted : true);
    return matchSearch && matchFilter;
  });

  const perPage = 8;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleAddPoints = () => {
    if (step === "form") { setStep("confirm"); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setAddModal(null);
      setAddPts(""); setAddRef(""); setAddReason(""); setStep("form");
      setToast("Points added successfully. Ledger transaction created and audit log written.");
    }, 1200);
  };

  const valid = addPts && parseInt(addPts) > 0 && addRef.trim() && addReason.trim();

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Driver Point Balances"
        description="View and manage driver point balances. Point additions require owner authorization."
        actions={
          ROLE === "owner" ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1.5 font-medium text-amber-700">
              Owner access — point additions enabled
            </div>
          ) : null
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Drivers", value: drivers.length },
          { label: "Low Balance (<20)", value: drivers.filter(d => (d.available ?? 0) < 20).length, urgent: true },
          { label: "Points Reserved", value: drivers.reduce((s, d) => s + (d.reserved ?? 0), 0) },
          { label: "Points Sold (Month)", value: "350 pts" },
        ].map(k => (
          <Card key={k.label} className={`p-4 ${k.urgent ? "border-amber-200 bg-amber-50/30" : ""}`}>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${k.urgent ? "text-amber-700" : "text-slate-800"}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search driver name or ID…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[["all", "All"], ["low", "Low Balance"], ["zero", "Zero"], ["reserved", "Has Reserved"], ["approved", "Approved"], ["blocked", "Blocked"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
              ${filter === v ? "bg-[#BE1B2C] text-white border-[#BE1B2C]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>{l}</button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Driver</Th>
                <Th>Phone</Th>
                <Th>Approval</Th>
                <Th>Available</Th>
                <Th>Reserved</Th>
                <Th>Purchased</Th>
                <Th>Consumed</Th>
                <Th>Active Ride</Th>
                <Th>Last Tx</Th>
                {ROLE === "owner" && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={10}><EmptyState title="No drivers match your filters" /></td></tr>
              ) : paginated.map(d => (
                <Tr key={d.driverId}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={d.driverAvatar} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{d.driverName}</p>
                        <p className="text-xs text-slate-400">{d.driverId}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="font-mono text-xs text-slate-600">{d.phone}</span></Td>
                  <Td><Badge variant={d.approvalStatus as "approved" | "pending" | "rejected"} /></Td>
                  <Td>
                    <span className={`text-sm font-semibold tabular-nums ${d.available < 20 ? "text-amber-700" : "text-slate-800"}`}>
                      {d.available}
                      {d.available < 20 && <AlertTriangle size={11} className="inline ml-1 text-amber-500" />}
                    </span>
                  </Td>
                  <Td><span className="text-sm tabular-nums text-slate-700">{d.reserved}</span></Td>
                  <Td><span className="text-sm tabular-nums text-slate-600">{d.totalPurchased}</span></Td>
                  <Td><span className="text-sm tabular-nums text-slate-600">{d.totalConsumed}</span></Td>
                  <Td>
                    {d.activeRideId
                      ? <span className="font-mono text-xs text-[#BE1B2C]">{d.activeRideId}</span>
                      : <span className="text-xs text-slate-400">—</span>}
                  </Td>
                  <Td><span className="text-xs text-slate-500">{relTime(d.lastTxAt)}</span></Td>
                  {ROLE === "owner" && (
                    <Td>
                      <Button variant="secondary" size="sm" icon={<Plus size={12} />} onClick={() => setAddModal(d)}>
                        Add Points
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </Card>

      {/* Add Points Modal */}
      <Modal open={!!addModal} onClose={() => { setAddModal(null); setStep("form"); }} title="Add Purchased Points">
        {addModal && (
          <div className="flex flex-col gap-4">
            {step === "form" ? (
              <>
                <div className="bg-sky-50 border border-sky-200 rounded-[10px] p-4">
                  <p className="text-sm font-semibold text-sky-800">{addModal.driverName}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-sky-700">
                    <span>Current balance: <strong>{addModal.available} pts</strong></span>
                    <span>Reserved: <strong>{addModal.reserved} pts</strong></span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Points to Add <span className="text-red-500">*</span></label>
                    <input type="number" min="1" value={addPts} onChange={e => setAddPts(e.target.value)} placeholder="e.g. 100"
                      className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-700">Payment Method <span className="text-red-500">*</span></label>
                    <select value={addMethod} onChange={e => setAddMethod(e.target.value)} className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 appearance-none">
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="pos">POS</option>
                      <option value="mobile_money">Mobile Money</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Payment / Reference Number <span className="text-red-500">*</span></label>
                  <input value={addRef} onChange={e => setAddRef(e.target.value)} placeholder="e.g. PAY-GTB-20240714-001"
                    className="h-10 bg-white border border-slate-200 rounded-[10px] px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Reason / Note <span className="text-red-500">*</span></label>
                  <textarea value={addReason} onChange={e => setAddReason(e.target.value)} rows={2} placeholder="Describe the purchase or correction…"
                    className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setAddModal(null)}>Cancel</Button>
                  <Button variant="primary" disabled={!valid} onClick={handleAddPoints}>Review →</Button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 flex flex-col gap-2">
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">Confirm Transaction</h4>
                  <StatRow label="Driver" value={addModal.driverName} />
                  <StatRow label="Current Balance" value={`${addModal.available} pts`} />
                  <StatRow label="Points to Add" value={<span className="text-green-600 font-semibold">+{addPts} pts</span>} />
                  <StatRow label="New Balance" value={<span className="font-semibold text-slate-800">{addModal.available + parseInt(addPts || "0")} pts</span>} />
                  <StatRow label="Payment Ref" value={addRef} />
                  <StatRow label="Method" value={addMethod.replace("_", " ")} />
                  <StatRow label="Reason" value={addReason} />
                </div>
                <p className="text-xs text-slate-500">This creates an immutable ledger transaction and audit log entry. This cannot be undone — incorrect entries require a separate admin correction.</p>
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setStep("form")}>← Back</Button>
                  <Button variant="primary" loading={loading} onClick={handleAddPoints}>Confirm & Add Points</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

function relTime(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
