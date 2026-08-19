import { useState, useEffect } from "react";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import {
  Card, Button, SectionHeader, Th, Td, Tr,
  Avatar, EmptyState, Modal, Toast, StatRow, TabBar
} from "../../components/ui";
import { getPurchaseRequests } from "../../api";

const ROLE = "owner";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-green-50 text-green-700 border border-green-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200",
};

export default function PointRequests() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("pending");
  const [page, setPage] = useState(1);
  const [actionReq, setActionReq] = useState<{ req: any; type: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [_fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      try {
        const res = await getPurchaseRequests({ page, limit: 50 });
        if (!cancelled) setRequests(res.requests ?? []);
      } catch (err) {
        console.error("Failed to load purchase requests", err);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  const filtered = requests.filter(r => {
    const matchSearch = !search || r.driverName.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === "all" || r.status === tab;
    return matchSearch && matchTab;
  });

  const perPage = 8;
  const pendingCount = requests.filter(r => r.status === "pending").length;

  const doAction = () => {
    if (!actionReq) return;
    setLoading(true);
    setTimeout(() => {
      setRequests(prev => prev.map(r => r.id === actionReq.req.id
        ? { ...r, status: actionReq.type === "approve" ? "approved" : "rejected", reviewedBy: "S. Chen", reviewedAt: new Date().toISOString(), adminNote: note || null }
        : r));
      setLoading(false);
      setActionReq(null);
      setNote("");
      setToast(actionReq.type === "approve"
        ? "Request approved. Points added to driver, ledger transaction created, driver notified."
        : "Request rejected. Driver has been notified with your reason.");
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Point Requests"
        description="Driver requests to purchase points. Approvals are atomic and idempotent."
      />

      <TabBar
        tabs={[
          { id: "pending", label: "Pending", count: pendingCount },
          { id: "approved", label: "Approved" },
          { id: "rejected", label: "Rejected" },
          { id: "cancelled", label: "Cancelled" },
          { id: "all", label: "All" },
        ]}
        active={tab}
        onChange={t => { setTab(t); setPage(1); }}
      />

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Driver name or request ID…"
          className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Request ID</Th>
                <Th>Driver</Th>
                <Th>Points</Th>
                <Th>Current Balance</Th>
                <Th>Contact / Reference</Th>
                <Th>Requested</Th>
                <Th>Status</Th>
                <Th>Reviewed By</Th>
                <Th>Note</Th>
                {ROLE === "owner" && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10}><EmptyState title="No requests in this category" /></td></tr>
              ) : filtered.slice((page - 1) * perPage, page * perPage).map(req => (
                <Tr key={req.id}>
                  <Td><span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{req.id}</span></Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={req.driverAvatar} size="xs" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{req.driverName}</p>
                        <p className="text-xs text-slate-400">{req.city}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="text-sm font-semibold text-green-700 tabular-nums">+{req.requestedPoints}</span></Td>
                  <Td><span className="text-sm tabular-nums text-slate-600">{req.currentBalance} pts</span></Td>
                  <Td><span className="text-xs text-slate-600 max-w-[160px] block truncate" title={req.contactRef}>{req.contactRef}</span></Td>
                  <Td><span className="text-xs text-slate-500">{formatTs(req.requestedAt)}</span></Td>
                  <Td>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[req.status]}`}>
                      {req.status}
                    </span>
                  </Td>
                  <Td><span className="text-xs text-slate-600">{req.reviewedBy ?? "—"}</span></Td>
                  <Td><span className="text-xs text-slate-500 max-w-[120px] block truncate" title={req.adminNote ?? ""}>{req.adminNote ?? "—"}</span></Td>
                  {ROLE === "owner" && (
                    <Td>
                      {req.status === "pending" ? (
                        <div className="flex items-center gap-1">
                          <Button variant="secondary" size="sm" icon={<CheckCircle2 size={13} className="text-green-600" />} onClick={() => setActionReq({ req, type: "approve" })}>Approve</Button>
                          <Button variant="ghost" size="sm" icon={<XCircle size={13} className="text-red-500" />} onClick={() => setActionReq({ req, type: "reject" })}>Reject</Button>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </Card>

      {/* Approve/Reject modal */}
      <Modal open={!!actionReq} onClose={() => { setActionReq(null); setNote(""); }}
        title={actionReq?.type === "approve" ? "Approve Point Request" : "Reject Point Request"}>
        {actionReq && (
          <div className="flex flex-col gap-4">
            <div className={`rounded-[10px] p-4 ${actionReq.type === "approve" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className={`text-sm font-semibold ${actionReq.type === "approve" ? "text-green-800" : "text-red-800"}`}>
                {actionReq.type === "approve" ? "Approve" : "Reject"} request <strong>{actionReq.req.id}</strong> for <strong>{actionReq.req.driverName}</strong>
              </p>
              {actionReq.type === "approve" && (
                <p className="text-xs text-green-700 mt-2">
                  This will atomically: update request status → add <strong>+{actionReq.req.requestedPoints} pts</strong> → create ledger entry → write audit log → notify driver. This action cannot be executed twice.
                </p>
              )}
            </div>

            <Card className="p-4">
              <StatRow label="Driver" value={actionReq.req.driverName} />
              <StatRow label="Current Balance" value={`${actionReq.req.currentBalance} pts`} />
              <StatRow label="Requested" value={<span className="text-green-600 font-semibold">+{actionReq.req.requestedPoints} pts</span>} />
              {actionReq.type === "approve" && (
                <StatRow label="New Balance" value={<span className="font-semibold text-slate-800">{actionReq.req.currentBalance + actionReq.req.requestedPoints} pts</span>} />
              )}
              <StatRow label="Reference" value={actionReq.req.contactRef} />
            </Card>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">
                Admin Note {actionReq.type === "reject" && <span className="text-red-500">*</span>}
              </label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder={actionReq.type === "approve" ? "Optional note (e.g. payment verified)" : "Explain why the request is being rejected…"}
                className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => { setActionReq(null); setNote(""); }}>Cancel</Button>
              <Button
                variant={actionReq.type === "approve" ? "primary" : "danger"}
                disabled={actionReq.type === "reject" && !note.trim()}
                loading={loading}
                onClick={doAction}
              >
                {actionReq.type === "approve" ? "Approve & Add Points" : "Reject Request"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
