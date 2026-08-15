import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Clock, FileText, CheckCircle2, XCircle, AlertTriangle,
  Download, Eye, RotateCw, ZoomIn, ZoomOut, X, Calendar, Copy
} from "lucide-react";
import {
  Badge, Avatar, Button, Card, StatRow, Stepper, ConfirmDialog, Modal, Toast, SlaBadge
} from "../components/ui";
import { mockVerificationRequests, mockAuditLog } from "../data/mock";

// ─── Enhanced document types ──────────────────────────────────────────────────

interface EnhancedDoc {
  id: string;
  name: string;
  category: string;
  type: string;
  size?: string;
  status: "reviewed" | "available" | "missing" | "duplicate" | "expired";
  uploadedAt?: string;
  reviewer?: string;
  expiryDate?: string;
  duplicateOf?: string;
}

const mockDocuments: EnhancedDoc[] = [
  { id: "DOC-1", name: "National ID (NIN)", category: "Identity", type: "PDF", size: "384 KB", status: "reviewed", uploadedAt: "2024-07-14T08:22:00Z", reviewer: "J. Kowalski", expiryDate: undefined },
  { id: "DOC-2", name: "Driver's License", category: "License", type: "JPG", size: "1.2 MB", status: "reviewed", uploadedAt: "2024-07-14T08:22:10Z", reviewer: "J. Kowalski", expiryDate: "2026-03-15" },
  { id: "DOC-3", name: "Vehicle Registration", category: "Vehicle", type: "PDF", size: "512 KB", status: "available", uploadedAt: "2024-07-14T08:22:30Z", expiryDate: "2025-09-30" },
  { id: "DOC-4", name: "Motor Insurance Certificate", category: "Insurance", type: "PDF", size: "220 KB", status: "available", uploadedAt: "2024-07-14T08:22:45Z", expiryDate: "2024-09-01" },
  { id: "DOC-5", name: "Roadworthiness Certificate", category: "Vehicle", type: "JPG", size: "890 KB", status: "duplicate", uploadedAt: "2024-07-14T08:23:00Z", duplicateOf: "DOC-3", expiryDate: "2024-12-31" },
  { id: "DOC-6", name: "Background Check", category: "Background", type: "PDF", size: undefined, status: "missing" },
];

// ─── Document zoom modal ───────────────────────────────────────────────────────

function DocPreviewModal({ doc, onClose }: { doc: EnhancedDoc; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const isExpiringSoon = doc.expiryDate
    ? (new Date(doc.expiryDate).getTime() - Date.now()) / 86400000 < 30
    : false;
  const isExpired = doc.expiryDate
    ? new Date(doc.expiryDate) < new Date()
    : false;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white rounded-[16px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">{doc.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{doc.category} · {doc.type}{doc.size ? ` · ${doc.size}` : ""}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[8px] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Warnings */}
        {(isExpired || isExpiringSoon || doc.status === "duplicate") && (
          <div className="px-6 py-3 flex flex-col gap-2 border-b border-slate-100 shrink-0">
            {isExpired && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-[8px] px-3 py-2 text-xs text-red-700">
                <AlertTriangle size={13} className="shrink-0" />
                <span className="font-medium">Document expired on {new Date(doc.expiryDate!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            )}
            {!isExpired && isExpiringSoon && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2 text-xs text-amber-700">
                <AlertTriangle size={13} className="shrink-0" />
                <span className="font-medium">Expiring soon — {new Date(doc.expiryDate!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            )}
            {doc.status === "duplicate" && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-[8px] px-3 py-2 text-xs text-orange-700">
                <Copy size={13} className="shrink-0" />
                <span className="font-medium">Possible duplicate of {doc.duplicateOf} — review carefully before approving.</span>
              </div>
            )}
          </div>
        )}

        {/* Document preview area */}
        <div className="flex-1 overflow-auto bg-slate-50 relative" style={{ minHeight: 320 }}>
          <div
            className="flex items-center justify-center min-h-full py-8"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center top", transition: "transform 0.2s" }}
          >
            <div className="bg-white rounded-[10px] border border-slate-200 shadow-sm w-full max-w-lg mx-8" style={{ minHeight: 280 }}>
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="w-16 h-16 rounded-[14px] bg-red-50 flex items-center justify-center">
                  <FileText size={32} className="text-[#BE1B2C]" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-700">{doc.name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{doc.type} document — preview placeholder</p>
                  {doc.uploadedAt && (
                    <p className="text-xs text-slate-400 mt-2">Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-[10px] p-1.5 shadow-sm">
            <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] text-slate-600 hover:bg-slate-100 transition-colors">
              <ZoomIn size={15} />
            </button>
            <div className="text-center text-[10px] font-mono text-slate-500 w-8">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] text-slate-600 hover:bg-slate-100 transition-colors">
              <ZoomOut size={15} />
            </button>
            <button onClick={() => setZoom(1)}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[9px] font-bold text-slate-500 hover:bg-slate-100 transition-colors">
              1:1
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="px-6 py-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0 bg-slate-50/50">
          <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Type</p><p className="text-xs font-semibold text-slate-700">{doc.type}</p></div>
          <div><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Category</p><p className="text-xs font-semibold text-slate-700">{doc.category}</p></div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Expiry Date</p>
            <p className={`text-xs font-semibold ${isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-slate-700"}`}>
              {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "No expiry"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Review status</p>
            <p className={`text-xs font-semibold capitalize ${doc.status === "reviewed" ? "text-green-600" : doc.status === "missing" ? "text-red-600" : "text-slate-600"}`}>
              {doc.status}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-xs text-slate-400">
            {doc.reviewer ? `Reviewed by ${doc.reviewer}` : "Not yet reviewed"}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Download size={13} />}>Download</Button>
            <Button variant="primary" size="sm" icon={<CheckCircle2 size={13} />}>Mark Reviewed</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Document card ────────────────────────────────────────────────────────────

function DocumentCard({ doc, onPreview }: { doc: EnhancedDoc; onPreview: () => void }) {
  const isExpiringSoon = doc.expiryDate
    ? (new Date(doc.expiryDate).getTime() - Date.now()) / 86400000 < 30
    : false;
  const isExpired = doc.expiryDate ? new Date(doc.expiryDate) < new Date() : false;

  const statusConfig: Record<string, { cls: string; badge: string; badgeCls: string }> = {
    reviewed:  { cls: "border-green-200 bg-green-50/30", badge: "Reviewed", badgeCls: "text-green-700 bg-green-50 border-green-200" },
    available: { cls: "border-slate-200 bg-white",        badge: "Pending review", badgeCls: "text-amber-700 bg-amber-50 border-amber-200" },
    missing:   { cls: "border-red-200 bg-red-50/30",      badge: "Missing", badgeCls: "text-red-700 bg-red-50 border-red-200" },
    duplicate: { cls: "border-orange-200 bg-orange-50/20",badge: "Possible duplicate", badgeCls: "text-orange-700 bg-orange-50 border-orange-200" },
    expired:   { cls: "border-red-200 bg-red-50/20",      badge: "Expired", badgeCls: "text-red-700 bg-red-50 border-red-200" },
  };

  const cfg = statusConfig[doc.status] ?? statusConfig.available;

  return (
    <div className={`border rounded-[12px] p-4 transition-all ${cfg.cls}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-[8px] bg-slate-100 flex items-center justify-center shrink-0">
          {doc.status === "missing"
            ? <AlertTriangle size={16} className="text-red-400" />
            : <FileText size={16} className="text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-slate-800">{doc.name}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.badgeCls}`}>{cfg.badge}</span>
          </div>
          <p className="text-xs text-slate-400">{doc.category} · {doc.type}{doc.size ? ` · ${doc.size}` : ""}</p>

          {doc.expiryDate && (
            <div className={`flex items-center gap-1 mt-1 text-xs
              ${isExpired ? "text-red-600 font-medium" : isExpiringSoon ? "text-amber-600 font-medium" : "text-slate-400"}`}>
              <Calendar size={10} />
              Expires {new Date(doc.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              {isExpired && " — EXPIRED"}
              {!isExpired && isExpiringSoon && " — Soon"}
            </div>
          )}

          {doc.status === "reviewed" && doc.reviewer && (
            <p className="text-xs text-green-600 mt-1">✓ Reviewed by {doc.reviewer}</p>
          )}
          {doc.status === "missing" && (
            <p className="text-xs text-red-600 mt-1">Document not uploaded by driver</p>
          )}
          {doc.status === "duplicate" && doc.duplicateOf && (
            <p className="text-xs text-orange-600 mt-1">May duplicate {doc.duplicateOf} — verify before approving</p>
          )}
        </div>
        {doc.status !== "missing" && (
          <button onClick={onPreview}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0">
            <Eye size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function ApprovalStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    approved: { label: "Approved", color: "text-green-600" },
    rejected: { label: "Rejected", color: "text-red-600" },
    pending: { label: "Pending Review", color: "text-amber-600" },
    not_submitted: { label: "Not Started", color: "text-slate-400" },
  };
  const s = map[status] ?? { label: status, color: "text-slate-500" };
  return <span className={`text-sm font-medium ${s.color}`}>{s.label}</span>;
}

function formatTs(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RequestDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const req = mockVerificationRequests.find(r => r.id === id) ?? mockVerificationRequests[0];

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<EnhancedDoc | null>(null);
  const [currentStatus, setCurrentStatus] = useState(req.status);

  const stepperStep = currentStatus === "completed" ? 2 : currentStatus === "pending" ? 1 : 0;
  const hasMissing = mockDocuments.some(d => d.status === "missing");
  const hasExpired = mockDocuments.some(d => d.status === "expired" || (d.expiryDate && new Date(d.expiryDate) < new Date()));
  const hasDuplicates = mockDocuments.some(d => d.status === "duplicate");
  const prevRejected = mockVerificationRequests.find(r => r.driver.id === req.driver.id && r.id !== req.id && r.status === "rejected");

  const doApprove = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setApproveOpen(false);
      setCurrentStatus("completed");
      setToast({ msg: "Request approved successfully. Driver has been notified.", type: "success" });
    }, 1200);
  };

  const doReject = () => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setRejectOpen(false);
      setCurrentStatus("rejected");
      setRejectReason("");
      setToast({ msg: "Request rejected. Driver has been notified with your reason.", type: "success" });
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate("/verification")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft size={15} /> Back to Verification Requests
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar initials={req.driver.avatar} size="lg" />
            <div>
              <h1 className="text-xl font-semibold text-slate-800">{req.driver.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{req.id}</span>
                <Badge variant={currentStatus as "pending" | "approved" | "rejected" | "completed"} />
                <SlaBadge hours={req.slaHours} breached={req.slaBreached} />
                <span className="text-xs text-slate-400">
                  Submitted {new Date(req.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            Assigned to: <span className="font-medium text-slate-700">{req.responsible}</span>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <Card className="px-8 py-5">
        <Stepper steps={["Initial Application", "Profile & Documents", "Completed"]} current={stepperStep} />
      </Card>

      {/* Alerts strip */}
      <div className="flex flex-col gap-2">
        {prevRejected && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[12px] p-4">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Previous application rejected</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {req.driver.name} had a previous request ({prevRejected.id}) rejected on {formatTs(prevRejected.approval1.at ?? prevRejected.submittedAt)}.
                Review the rejection reason in the audit history below.
              </p>
            </div>
          </div>
        )}
        {hasMissing && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3">
            <AlertTriangle size={15} className="text-red-600 shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              {mockDocuments.filter(d => d.status === "missing").length} required document(s) missing — approval is blocked until all documents are uploaded.
            </p>
          </div>
        )}
        {hasExpired && !hasMissing && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-[12px] px-4 py-3">
            <AlertTriangle size={15} className="text-red-600 shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              {mockDocuments.filter(d => d.expiryDate && new Date(d.expiryDate) < new Date()).length} document(s) have expired. Do not approve until they are renewed.
            </p>
          </div>
        )}
        {hasDuplicates && (
          <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-[12px] px-4 py-3">
            <AlertTriangle size={15} className="text-orange-600 shrink-0" />
            <p className="text-sm text-orange-800 font-medium">
              Possible duplicate documents detected. Review carefully before proceeding.
            </p>
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="flex gap-5 items-start">
        {/* Left content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Personal info */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Driver Identity</h2>
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
              <Avatar initials={req.driver.avatar} size="lg" />
              <div>
                <p className="text-base font-bold text-slate-900">{req.driver.name}</p>
                <p className="text-xs font-mono text-slate-400">{req.driver.id}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={currentStatus as "pending" | "approved" | "rejected" | "completed"} />
                  <span className="text-xs text-slate-400">{req.type}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8">
              <StatRow label="Driver ID" value={req.driver.id} />
              <StatRow label="Request Type" value={req.type} />
              <StatRow label="Submitted" value={new Date(req.submittedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
              <StatRow label="Phone" value={<span className="font-mono text-xs">+234 801 *** 5678</span>} />
              <StatRow label="Email" value={<span className="font-mono text-xs">m.***@email.com</span>} />
              <StatRow label="Area" value="Victoria Island, Lagos" />
              <StatRow label="Vehicle" value="Toyota Camry 2022 · Silver" />
              <StatRow label="Plate" value="ABC-234-EK" />
            </div>
          </Card>

          {/* Approval details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Approval 1 — First Review</h2>
              <StatRow label="Status" value={<ApprovalStatusBadge status={req.approval1.status} />} />
              <StatRow label="Reviewed by" value={req.approval1.admin ?? "—"} />
              <StatRow label="Reviewed at" value={req.approval1.at ? formatTs(req.approval1.at) : "—"} />
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Approval 2 — Final Review</h2>
              <StatRow label="Status" value={<ApprovalStatusBadge status={req.approval2.status} />} />
              <StatRow label="Reviewed by" value={req.approval2.admin ?? "—"} />
              <StatRow label="Reviewed at" value={req.approval2.at ? formatTs(req.approval2.at) : "—"} />
            </Card>
          </div>

          {/* Documents */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Submitted Documents</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {mockDocuments.filter(d => d.status !== "missing").length}/{mockDocuments.length} uploaded ·{" "}
                  {mockDocuments.filter(d => d.status === "reviewed").length} reviewed
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mockDocuments.map(doc => (
                <DocumentCard key={doc.id} doc={doc} onPreview={() => setPreviewDoc(doc)} />
              ))}
            </div>
          </Card>

          {/* Review history / audit timeline */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Review History</h2>
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-200" />
              <div className="flex flex-col gap-5">
                {mockAuditLog.map(log => (
                  <div key={log.id} className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shrink-0 relative z-10">
                      {log.action.includes("Approved") ? <CheckCircle2 size={14} className="text-green-500" /> :
                       log.action.includes("Rejected") ? <XCircle size={14} className="text-red-500" /> :
                       <Clock size={14} className="text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{log.action}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            <span>{log.admin}</span>
                            <span>·</span>
                            <span>{log.from} → {log.to}</span>
                          </div>
                          {log.note && (
                            <div className="mt-2 bg-slate-50 border border-slate-100 rounded-[8px] px-3 py-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Note / Reason</p>
                              <p className="text-xs text-slate-700 italic">"{log.note}"</p>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{formatTs(log.at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right: sticky decision panel */}
        <div className="w-72 shrink-0 sticky top-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Decision Panel</h2>
            <div className="flex flex-col gap-3 mb-5">
              <StatRow label="Stage" value="Approval 2" />
              <StatRow label="Status" value={<Badge variant={currentStatus as "pending" | "approved" | "rejected" | "completed"} />} />
              <StatRow label="Documents" value={
                <span className={hasMissing || hasExpired ? "text-red-600 font-medium text-xs" : "text-green-600 font-medium text-xs"}>
                  {mockDocuments.filter(d => d.status !== "missing").length}/{mockDocuments.length} uploaded
                </span>
              } />
              <StatRow label="Queue Age" value={<SlaBadge hours={req.slaHours} breached={req.slaBreached} />} />
              {hasDuplicates && <StatRow label="Duplicates" value={<span className="text-orange-600 text-xs font-medium">⚠ Detected</span>} />}
            </div>

            {hasMissing && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-[8px] p-3 mb-3">
                <AlertTriangle size={13} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">Missing documents must be resolved before approval.</p>
              </div>
            )}
            {hasExpired && !hasMissing && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-[8px] p-3 mb-3">
                <AlertTriangle size={13} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">Expired documents must be renewed before approval.</p>
              </div>
            )}
            {hasDuplicates && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-[8px] p-3 mb-3">
                <AlertTriangle size={13} className="text-orange-600 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">Review possible duplicate documents before approving.</p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <Button
                variant="primary" className="w-full"
                disabled={currentStatus === "completed" || currentStatus === "rejected" || hasMissing || hasExpired}
                onClick={() => setApproveOpen(true)}
                icon={<CheckCircle2 size={15} />}
              >
                Approve Request
              </Button>
              <Button
                variant="danger" className="w-full"
                disabled={currentStatus === "completed" || currentStatus === "rejected"}
                onClick={() => setRejectOpen(true)}
                icon={<XCircle size={15} />}
              >
                Reject Request
              </Button>
              {currentStatus === "rejected" && (
                <Button variant="secondary" className="w-full" icon={<RotateCw size={15} />}>
                  Reopen Request
                </Button>
              )}
            </div>

            {(currentStatus === "completed" || currentStatus === "rejected") && (
              <div className={`mt-4 p-3 rounded-[8px] text-xs ${currentStatus === "completed" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {currentStatus === "completed" ? "✓ Fully approved." : "✗ Request rejected."}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Document preview modal */}
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}

      {/* Approve confirm */}
      <ConfirmDialog
        open={approveOpen} onClose={() => setApproveOpen(false)} onConfirm={doApprove}
        title="Approve Verification Request" loading={loading} confirmLabel="Approve Request" variant="primary"
        message={
          <div>
            <p>You are approving <strong>{req.id}</strong> for <strong>{req.driver.name}</strong>.</p>
            <p className="mt-2">This will mark the request as <strong>Completed</strong> and notify the driver that their account has been approved.</p>
          </div>
        }
      />

      {/* Reject dialog */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Verification Request">
        <div className="flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-[10px] p-3 text-sm text-red-700">
            You are rejecting <strong>{req.id}</strong> for <strong>{req.driver.name}</strong>. Your reason will be sent to the driver.
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Rejection reason <span className="text-red-500">*</span></label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4}
              placeholder="Explain clearly why the request is being rejected and what the driver must do to reapply..."
              className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 resize-none" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={doReject} disabled={!rejectReason.trim()} loading={loading}>Reject Request</Button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
