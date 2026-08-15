import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Download, RefreshCw, X } from "lucide-react";
import {
  Badge, SlaBadge, Avatar, Button, Card, Select, KpiCard,
  Th, Td, Tr, Pagination, FilterChip, EmptyState, SectionHeader
} from "../components/ui";
import { mockVerificationRequests } from "../data/mock";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "New Driver", label: "New Driver" },
  { value: "Document Update", label: "Document Update" },
  { value: "Vehicle Change", label: "Vehicle Change" },
  { value: "Background Recheck", label: "Background Recheck" },
];

const SLA_OPTIONS = [
  { value: "all", label: "All SLA" },
  { value: "breached", label: "SLA Breached" },
  { value: "ok", label: "Within SLA" },
];

export default function VerificationRequests({ defaultStatus }: { defaultStatus?: string }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(defaultStatus ?? "all");
  const [type, setType] = useState("all");
  const [sla, setSla] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = mockVerificationRequests.filter(r => {
    const matchSearch = !search || r.id.toLowerCase().includes(search.toLowerCase()) || r.driver.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = status === "all" || r.status === status;
    const matchType = type === "all" || r.type === type;
    const matchSla = sla === "all" || (sla === "breached" ? r.slaBreached : !r.slaBreached);
    return matchSearch && matchStatus && matchType && matchSla;
  });

  const activeFilters: { label: string; clear: () => void }[] = [];
  if (status !== "all") activeFilters.push({ label: `Status: ${status}`, clear: () => setStatus("all") });
  if (type !== "all") activeFilters.push({ label: `Type: ${type}`, clear: () => setType("all") });
  if (sla !== "all") activeFilters.push({ label: `SLA: ${sla}`, clear: () => setSla("all") });

  const perPage = 5;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSelect = (id: string) => {
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const pending = mockVerificationRequests.filter(r => r.status === "pending").length;
  const completed = mockVerificationRequests.filter(r => r.status === "completed").length;
  const approvedToday = mockVerificationRequests.filter(r => r.status === "completed").length;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Verification Requests"
        description="Review and approve driver onboarding and document submissions."
        actions={
          <>
            <div className="text-xs text-slate-400">Synced 2m ago</div>
            <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />}>Refresh</Button>
            <Button variant="secondary" size="sm" icon={<Download size={14} />}>Export CSV</Button>
          </>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Pending" value={pending} urgent tooltip="Requests awaiting any stage of approval" onClick={() => setStatus("pending")} sparkline={[8, 9, 10, 11, 10, 12, pending]} />
        <KpiCard label="Approved Today" value={approvedToday} tooltip="Requests fully completed today" sparkline={[2, 4, 3, 5, 4, 4, approvedToday]} />
        <KpiCard label="Completed Total" value={completed} tooltip="All fully processed verification requests" />
        <KpiCard label="Avg. Approval Time" value="3.2h" prev="4.1h" trend="down" tooltip="Average time from submission to completion" />
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by request ID or driver name..."
              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} className="w-40" />
          <Select value={type} onChange={setType} options={TYPE_OPTIONS} className="w-44" />
          <Select value={sla} onChange={setSla} options={SLA_OPTIONS} className="w-36" />
          {activeFilters.length > 0 && (
            <button onClick={() => { setStatus("all"); setType("all"); setSla("all"); }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 underline underline-offset-2">
              Clear all
            </button>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {activeFilters.map(f => <FilterChip key={f.label} label={f.label} onRemove={f.clear} />)}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 accent-[#BE1B2C]"
                    checked={selectedIds.length === paginated.length && paginated.length > 0}
                    onChange={() => setSelectedIds(selectedIds.length === paginated.length ? [] : paginated.map(r => r.id))}
                  />
                </Th>
                <Th>Request ID</Th>
                <Th>Type</Th>
                <Th>Driver</Th>
                <Th>Submitted</Th>
                <Th>Approval 1</Th>
                <Th>Approval 2</Th>
                <Th>Status</Th>
                <Th>Responsible</Th>
                <Th>SLA Age</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    {filtered.length === 0 && mockVerificationRequests.length > 0
                      ? <EmptyState title="No results match your filters" description="Try adjusting your search or clearing the active filters." action={<Button variant="secondary" size="sm" onClick={() => { setSearch(""); setStatus("all"); setType("all"); setSla("all"); }}>Clear filters</Button>} />
                      : <EmptyState title="No verification requests" description="Requests will appear here as drivers submit their documents." />}
                  </td>
                </tr>
              ) : paginated.map(req => (
                <Tr key={req.id} selected={selectedIds.includes(req.id)}>
                  <Td>
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 accent-[#BE1B2C]" checked={selectedIds.includes(req.id)} onChange={() => toggleSelect(req.id)} onClick={e => e.stopPropagation()} />
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{req.id}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-600">{req.type}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={req.driver.avatar} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{req.driver.name}</div>
                        <div className="text-xs text-slate-400">{req.driver.id}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-600">{formatDate(req.submittedAt)}</span>
                  </Td>
                  <Td>
                    <ApprovalCell status={req.approval1.status} admin={req.approval1.admin} />
                  </Td>
                  <Td>
                    <ApprovalCell status={req.approval2.status} admin={req.approval2.admin} />
                  </Td>
                  <Td>
                    <Badge variant={req.status as "pending" | "approved" | "rejected" | "completed"} />
                  </Td>
                  <Td>
                    <span className={`text-xs ${req.responsible === "Unassigned" ? "text-amber-600 font-medium" : "text-slate-600"}`}>
                      {req.responsible}
                    </span>
                  </Td>
                  <Td>
                    <SlaBadge hours={req.slaHours} breached={req.slaBreached} />
                  </Td>
                  <Td>
                    <Button variant="primary" size="sm" onClick={() => navigate(`/verification/${req.id}`)}>
                      Review
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </Card>
    </div>
  );
}

function ApprovalCell({ status, admin }: { status: string; admin: string | null }) {
  if (status === "approved") return (
    <div>
      <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Approved</span>
      {admin && <div className="text-xs text-slate-400 mt-0.5">{admin}</div>}
    </div>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Rejected</span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Pending</span>
  );
  return <span className="text-xs text-slate-400">—</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
