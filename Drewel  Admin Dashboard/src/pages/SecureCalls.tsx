import { useState } from "react";
import { Search, PhoneCall, PhoneMissed, Flag, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  Avatar, Button, Card, Drawer, StatRow, SectionHeader, EmptyState,
  Th, Td, Tr, Pagination, AlertBanner, Select
} from "../components/ui";
import { mockCalls } from "../data/mock";

export default function SecureCalls() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [selectedCall, setSelectedCall] = useState<typeof mockCalls[0] | null>(null);
  const [page, setPage] = useState(1);

  const filtered = mockCalls.filter(c => {
    const matchSearch = !search || c.id.toLowerCase().includes(search.toLowerCase()) || c.rideId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchReported = !reportedOnly || c.reported;
    return matchSearch && matchStatus && matchReported;
  });

  const reportedCount = mockCalls.filter(c => c.reported).length;
  const perPage = 8;
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Secure Calls"
        description="Call metadata and safety report monitoring. Audio is never stored or accessible."
        actions={
          reportedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-full">
              <Flag size={12} /> {reportedCount} reported
            </span>
          )
        }
      />

      {/* Privacy notice */}
      <div className="flex items-start gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px] px-4 py-3.5">
        <ShieldCheck size={18} className="text-[#BE1B2C] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#BE1B2C]">Call Audio Privacy Notice</p>
          <p className="text-xs text-[#BE1B2C] mt-0.5 leading-relaxed">
            Call audio is <strong>never recorded, stored or available</strong> to administrators. This page shows metadata only: call IDs, participant roles, timestamps, durations and safety reports.
          </p>
        </div>
      </div>

      {/* Reported alert */}
      {reportedCount > 0 && (
        <AlertBanner
          type="danger"
          title={`${reportedCount} call${reportedCount > 1 ? "s" : ""} flagged for safety review`}
          message="Reported calls require administrator review. Check the report details and follow the safety escalation procedure."
        />
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Calls", value: mockCalls.length, color: "text-slate-800" },
          { label: "Completed", value: mockCalls.filter(c => c.status === "completed").length, color: "text-green-700" },
          { label: "Failed", value: mockCalls.filter(c => c.status === "failed").length, color: "text-slate-600" },
          { label: "Reported", value: reportedCount, color: reportedCount > 0 ? "text-red-700" : "text-slate-600", urgent: reportedCount > 0 },
        ].map(k => (
          <Card key={k.label} className={`p-4 ${k.urgent ? "border-red-200 bg-red-50/30" : ""}`}>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${k.color}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Call ID or Ride ID…"
            className="w-full h-10 bg-white border border-slate-200 rounded-[10px] pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 transition-all"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All Statuses" },
            { value: "completed", label: "Completed" },
            { value: "failed", label: "Failed" },
          ]}
          className="w-40"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={reportedOnly}
            onChange={e => setReportedOnly(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 accent-[#BE1B2C]"
          />
          <span className="text-sm text-slate-600 font-medium">Reported only</span>
        </label>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Call ID</Th>
                <Th>Ride</Th>
                <Th>Caller</Th>
                <Th>Receiver</Th>
                <Th>Start Time</Th>
                <Th>Duration</Th>
                <Th>Status</Th>
                <Th>End Reason</Th>
                <Th>Reported</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={10}><EmptyState title="No calls match your filters" description="Adjust the search or filter criteria." /></td></tr>
              ) : paginated.map(call => (
                <Tr key={call.id} onClick={() => setSelectedCall(call)}>
                  <Td>
                    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{call.id}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-[#BE1B2C]">{call.rideId}</span>
                  </Td>
                  <Td>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{call.caller.name}</p>
                      <p className="text-xs text-slate-400">{call.caller.type}</p>
                    </div>
                  </Td>
                  <Td>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{call.receiver.name}</p>
                      <p className="text-xs text-slate-400">{call.receiver.type}</p>
                    </div>
                  </Td>
                  <Td><span className="text-xs text-slate-600">{formatTs(call.startTime)}</span></Td>
                  <Td><span className="text-xs font-mono text-slate-600">{call.duration}</span></Td>
                  <Td>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full
                      ${call.status === "completed" ? "bg-green-50 text-green-700 border border-green-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                      {call.status === "completed" ? <PhoneCall size={11} /> : <PhoneMissed size={11} />}
                      {call.status}
                    </span>
                  </Td>
                  <Td><span className="text-xs text-slate-500">{call.endReason}</span></Td>
                  <Td>
                    {call.reported ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        <Flag size={10} /> Reported
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedCall(call); }}>
                      Details
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} perPage={perPage} onChange={setPage} />
      </Card>

      {/* Call details drawer */}
      <Drawer open={!!selectedCall} onClose={() => setSelectedCall(null)} title="Call Details">
        {selectedCall && (
          <div className="p-6 flex flex-col gap-5">
            {selectedCall.reported && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] p-4">
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Safety Report</p>
                  <p className="text-xs text-red-700 mt-1">{selectedCall.reportReason}</p>
                </div>
              </div>
            )}

            <Card className="p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Call Metadata</h4>
              <StatRow label="Call ID" value={<span className="font-mono text-xs">{selectedCall.id}</span>} />
              <StatRow label="Ride" value={<span className="font-mono text-xs text-[#BE1B2C]">{selectedCall.rideId}</span>} />
              <StatRow label="Start Time" value={formatTs(selectedCall.startTime)} />
              <StatRow label="Duration" value={selectedCall.duration} />
              <StatRow label="Status" value={selectedCall.status} />
              <StatRow label="End Reason" value={selectedCall.endReason} />
              <StatRow label="Reported" value={selectedCall.reported ? <span className="text-red-600 font-medium">Yes</span> : "No"} />
            </Card>

            <Card className="p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Participants</h4>
              <div className="flex flex-col gap-3">
                {[selectedCall.caller, selectedCall.receiver].map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-[8px]">
                    <Avatar initials={p.name.split(" ").map(n => n[0]).join("")} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400 capitalize">{i === 0 ? "Caller" : "Receiver"} · {p.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 flex items-start gap-3">
              <ShieldCheck size={15} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Audio content is never recorded or stored. No playback or transcription is available.
              </p>
            </div>

            {selectedCall.reported && (
              <div className="flex flex-col gap-2.5">
                <Button variant="danger" className="w-full">Escalate Safety Report</Button>
                <Button variant="secondary" className="w-full">View Related Ride</Button>
                <Button variant="ghost" className="w-full">Dismiss Report</Button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
