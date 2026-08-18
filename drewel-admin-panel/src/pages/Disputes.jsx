import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, RefreshCw, Search, Plus, ExternalLink, MessageSquare,
} from "lucide-react";
import {
  getOperationalDisputes, getOperationalDispute, createOperationalDispute,
  updateDisputeStatus, resolveOperationalDispute, addDisputeNote,
  operationalErrorMessage,
} from "../api/domains/operational";
import {
  Badge, Button, Card, Drawer, EmptyState, ErrorState, Input,
  LoadingState, Modal, Pagination, SectionHeader, Select, StatRow,
  TabBar, Toast,
} from "../components/ui";

const STATUS_LABELS = {
  open: "Open", under_review: "Under Review", waiting_user: "Waiting for User",
  waiting_driver: "Waiting for Driver", resolved: "Resolved", rejected: "Rejected",
};
const STATUS_VARIANTS = {
  open: "rejected", under_review: "pending", waiting_user: "info",
  waiting_driver: "warning", resolved: "approved", rejected: "rejected",
};
const REASONS = [
  { value: "overcharge", label: "Overcharge" }, { value: "route_deviation", label: "Route Deviation" },
  { value: "driver_misconduct", label: "Driver Misconduct" }, { value: "no_show", label: "No Show" },
  { value: "safety_concern", label: "Safety Concern" }, { value: "payment_issue", label: "Payment Issue" },
  { value: "app_malfunction", label: "App Malfunction" }, { value: "driver_cancelled", label: "Driver Cancelled" },
  { value: "trip_not_completed", label: "Trip Not Completed" }, { value: "other", label: "Other" },
];
const PRIORITIES = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" }];
const DECISIONS = [{ value: "driver", label: "Favor Driver" }, { value: "user", label: "Favor User" }, { value: "split", label: "Split" }, { value: "rejected", label: "Reject" }];

const PRIORITY_CFG = { low: "info", medium: "pending", high: "warning", urgent: "rejected" };

function formatDate(v) {
  if (!v) return "\u2014";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
}
function formatRelTime(iso) {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const Disputes = () => {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ rideId: "", reason: "overcharge", priority: "medium", description: "" });
  const [resolveModal, setResolveModal] = useState({ open: false, id: null });
  const [resolveForm, setResolveForm] = useState({ decision: "user", note: "", pointsAdjustment: 0 });
  const [noteText, setNoteText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getOperationalDisputes({
        page: pagination.page, limit: pagination.limit,
        status: statusFilter || undefined, search: search.trim() || undefined,
      });
      setDisputes(result.disputes);
      setSummary(result.summary);
      setPagination((p) => ({ ...p, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setError(operationalErrorMessage(err, "Failed to load disputes."));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const d = await getOperationalDispute(id);
      setDetail(d);
    } catch (err) {
      setToast({ message: operationalErrorMessage(err, "Failed to load dispute detail."), type: "error" });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadDetail(selected.id);
    else setDetail(null);
  }, [selected, loadDetail]);

  const handleCreate = useCallback(async () => {
    if (!createForm.rideId.trim()) { setToast({ message: "Ride ID is required.", type: "error" }); return; }
    setActionLoading(true);
    try {
      await createOperationalDispute(createForm);
      setToast({ message: "Dispute created.", type: "success" });
      setCreateModal(false);
      setCreateForm({ rideId: "", reason: "overcharge", priority: "medium", description: "" });
      load();
    } catch (err) {
      setToast({ message: operationalErrorMessage(err, "Failed to create dispute."), type: "error" });
    } finally {
      setActionLoading(false);
    }
  }, [createForm, load]);

  const handleStatus = useCallback(async (id, status) => {
    setActionLoading(true);
    try {
      await updateDisputeStatus(id, status);
      setToast({ message: `Status updated to ${STATUS_LABELS[status]}.`, type: "success" });
      load();
      if (selected?.id === id) loadDetail(id);
    } catch (err) {
      setToast({ message: operationalErrorMessage(err, "Failed to update status."), type: "error" });
    } finally {
      setActionLoading(false);
    }
  }, [selected, load, loadDetail]);

  const handleResolve = useCallback(async () => {
    setActionLoading(true);
    try {
      await resolveOperationalDispute(resolveModal.id, resolveForm);
      setToast({ message: "Dispute resolved.", type: "success" });
      setResolveModal({ open: false, id: null });
      setSelected(null);
      load();
    } catch (err) {
      setToast({ message: operationalErrorMessage(err, "Failed to resolve dispute."), type: "error" });
    } finally {
      setActionLoading(false);
    }
  }, [resolveModal.id, resolveForm, load]);

  const handleAddNote = useCallback(async () => {
    if (noteText.trim().length < 3) return;
    setActionLoading(true);
    try {
      await addDisputeNote(selected.id, noteText.trim());
      setToast({ message: "Note added.", type: "success" });
      setNoteText("");
      loadDetail(selected.id);
    } catch (err) {
      setToast({ message: operationalErrorMessage(err, "Failed to add note."), type: "error" });
    } finally {
      setActionLoading(false);
    }
  }, [selected, noteText, loadDetail]);

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SectionHeader
        title="Disputes"
        description="Standalone dispute records connected to rides, drivers, users, points, and audit logs."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />} onClick={load}>Refresh</Button>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setCreateModal(true)}>New Dispute</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
            className={`p-3 rounded-[10px] border text-left transition-all ${statusFilter === key ? "ring-2 ring-[#BE1B2C]/30 border-[#BE1B2C]" : "border-slate-200 hover:border-slate-300"}`}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
            <p className="text-lg font-bold tabular-nums mt-1 text-slate-800">{summary[key] || 0}</p>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search disputes..." leftIcon={<Search size={14} />} />
          </div>
        </div>

        {loading ? <LoadingState label="Loading disputes..." /> : error ? (
          <ErrorState title="Unable to load disputes" description={error} action={<Button variant="secondary" onClick={load}>Retry</Button>} />
        ) : disputes.length === 0 ? (
          <EmptyState title="No disputes found" description="No dispute records match your filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  {["Status", "Priority", "Reason", "Ride", "Driver", "User", "Created", ""].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5 bg-slate-50/70 border-b border-slate-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d.id} onClick={() => setSelected(d)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3.5"><Badge variant={STATUS_VARIANTS[d.status]} label={STATUS_LABELS[d.status]} /></td>
                    <td className="px-4 py-3.5"><Badge variant={PRIORITY_CFG[d.priority]} label={d.priority} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 capitalize">{d.reason.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3.5 text-sm text-[#BE1B2C] font-medium">{d.rideReference || "\u2014"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{d.driver?.fullName || "\u2014"}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{d.user?.fullName || "\u2014"}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{formatRelTime(d.createdAt)}</td>
                    <td className="px-4 py-3.5"><ExternalLink size={12} className="text-slate-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && disputes.length > 0 && (
          <Pagination page={pagination.page} total={pagination.total} perPage={pagination.limit} onChange={(p) => setPagination((prev) => ({ ...prev, page: p }))} />
        )}
      </Card>

      {/* Detail Drawer */}
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Dispute Details" width="w-[560px]">
        {detailLoading ? <LoadingState label="Loading dispute..." /> : detail && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={STATUS_VARIANTS[detail.status]} label={STATUS_LABELS[detail.status]} dot />
              <Badge variant={PRIORITY_CFG[detail.priority]} label={detail.priority} />
              <span className="text-xs text-slate-400">{formatDate(detail.createdAt)}</span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800 capitalize">{detail.reason.replace(/_/g, " ")}</h3>
              {detail.description && <p className="text-sm text-slate-500 mt-1">{detail.description}</p>}
            </div>

            <div className="space-y-0">
              {detail.ride && (
                <StatRow label="Ride" value={
                  <button onClick={() => { setSelected(null); navigate(`/reservations/${detail.ride.id}`); }}
                    className="text-[#BE1B2C] hover:underline flex items-center gap-1">{detail.ride.reference} <ExternalLink size={10} /></button>
                } />
              )}
              {detail.driver && <StatRow label="Driver" value={
                <button onClick={() => { setSelected(null); navigate(`/driver-detail/${detail.driver.id}`); }}
                  className="text-[#BE1B2C] hover:underline flex items-center gap-1">{detail.driver.fullName} <ExternalLink size={10} /></button>
              } />}
              {detail.user && <StatRow label="User" value={
                <button onClick={() => { setSelected(null); navigate(`/users/${detail.user.id}`); }}
                  className="text-[#BE1B2C] hover:underline flex items-center gap-1">{detail.user.fullName} <ExternalLink size={10} /></button>
              } />}
              <StatRow label="Opened By" value={detail.openedBy} />
              {detail.assignedAdmin && <StatRow label="Assigned" value={detail.assignedAdmin.name} />}
              {detail.resolution?.resolvedAt && (
                <>
                  <StatRow label="Decision" value={<Badge variant={detail.resolution.decision === "rejected" ? "rejected" : "approved"} label={detail.resolution.decision} />} />
                  <StatRow label="Resolved By" value={detail.resolution.resolvedByName} />
                  {detail.resolution.note && <StatRow label="Resolution Note" value={detail.resolution.note} />}
                  {detail.resolution.pointsAdjustment !== 0 && <StatRow label="Points Adjustment" value={`${detail.resolution.pointsAdjustment > 0 ? "+" : ""}${detail.resolution.pointsAdjustment}`} />}
                </>
              )}
            </div>

            {/* Ride Audit Timeline */}
            {detail.rideAudit && detail.rideAudit.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ride Timeline</h4>
                <div className="relative pl-4 max-h-48 overflow-y-auto">
                  <div className="absolute left-1 top-0 bottom-0 w-px bg-slate-200" />
                  {detail.rideAudit.map((entry, i) => (
                    <div key={entry.id || i} className="relative mb-3">
                      <span className="absolute -left-[11px] w-2 h-2 rounded-full bg-slate-300 mt-1" />
                      <p className="text-xs text-slate-600 font-medium">{entry.action}</p>
                      {entry.fromStatus && <p className="text-[11px] text-slate-400">{entry.fromStatus} {"\u2192"} {entry.toStatus}</p>}
                      <p className="text-[10px] text-slate-400">{formatDate(entry.occurredAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal Notes */}
            {detail.internalNotes && detail.internalNotes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Internal Notes</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {detail.internalNotes.map((note) => (
                    <div key={note.id} className="p-2.5 bg-slate-50 rounded-[8px] text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-600">{note.adminName}</span>
                        <span className="text-slate-400">{formatDate(note.createdAt)}</span>
                      </div>
                      <p className="text-slate-600">{note.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {detail.status !== "resolved" && detail.status !== "rejected" && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {detail.status === "open" && (
                    <Button size="sm" variant="secondary" loading={actionLoading} onClick={() => handleStatus(detail.id, "under_review")}>Start Review</Button>
                  )}
                  {["open", "under_review"].includes(detail.status) && (
                    <>
                      <Button size="sm" variant="secondary" loading={actionLoading} onClick={() => handleStatus(detail.id, "waiting_user")}>Wait for User</Button>
                      <Button size="sm" variant="secondary" loading={actionLoading} onClick={() => handleStatus(detail.id, "waiting_driver")}>Wait for Driver</Button>
                    </>
                  )}
                  <Button size="sm" loading={actionLoading} onClick={() => setResolveModal({ open: true, id: detail.id })}>Resolve</Button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add internal note..."
                    className="flex-1 h-9 bg-white border border-slate-200 rounded-[8px] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                  />
                  <Button size="sm" variant="secondary" loading={actionLoading} onClick={handleAddNote} icon={<MessageSquare size={12} />}>Note</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Open New Dispute">
        <div className="space-y-4">
          <Input label="Ride ID" value={createForm.rideId} onChange={(e) => setCreateForm((f) => ({ ...f, rideId: e.target.value }))} placeholder="MongoDB ObjectId of the ride" />
          <Select label="Reason" value={createForm.reason} onChange={(v) => setCreateForm((f) => ({ ...f, reason: v }))} options={REASONS} />
          <Select label="Priority" value={createForm.priority} onChange={(v) => setCreateForm((f) => ({ ...f, priority: v }))} options={PRIORITIES} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} rows={3} maxLength={2000} className="w-full bg-white border border-slate-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={actionLoading}>Create Dispute</Button>
          </div>
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal open={resolveModal.open} onClose={() => setResolveModal({ open: false, id: null })} title="Resolve Dispute">
        <div className="space-y-4">
          <Select label="Decision" value={resolveForm.decision} onChange={(v) => setResolveForm((f) => ({ ...f, decision: v }))} options={DECISIONS} />
          <Input label="Points Adjustment" type="number" value={resolveForm.pointsAdjustment} onChange={(e) => setResolveForm((f) => ({ ...f, pointsAdjustment: Number(e.target.value) }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Note</label>
            <textarea value={resolveForm.note} onChange={(e) => setResolveForm((f) => ({ ...f, note: e.target.value }))} rows={3} maxLength={2000} className="w-full bg-white border border-slate-200 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#BE1B2C]/20 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setResolveModal({ open: false, id: null })}>Cancel</Button>
            <Button onClick={handleResolve} loading={actionLoading}>Resolve</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Disputes;
