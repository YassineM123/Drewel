import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import PropTypes from "prop-types";
import {
  ArrowLeft, CheckCircle2, XCircle, RotateCw, AlertTriangle,
  FileText, Eye, Download, X, Clock, MapPin, Trash2,
} from "lucide-react";
import SafeImage from "../components/SafeImage";
import { updateDriverReviewStatus } from "../utils/api";
import { deleteDriver } from "../api/domains/drivers";
import { isTrustedApiAssetUrl, normalizeAssetUrl } from "../utils/media";
import {
  approveProfileRequest,
  approveRequest,
  getProtectedDocumentBlob,
  getDocumentErrorMessage,
  getRequestDetails,
  getRequestHistory,
  rejectProfileRequest,
  reopenProfileRequest,
  reopenRequest,
} from "../utils/requestsApi";
import {
  Badge, Button, Card, StatRow, ConfirmDialog, Modal, Toast, LoadingState, ErrorState,
} from "../components/ui";

const documentFields = [
  { key: "companyLicense", label: "Company licence", group: "Company" },
  { key: "vehicleLicenseFront", label: "Vehicle registration", side: "Front", group: "Vehicle" },
  { key: "vehicleLicenseBack", label: "Vehicle registration", side: "Back", group: "Vehicle" },
  { key: "drivingLicenseFront", label: "Driving licence", side: "Front", group: "Driver" },
  { key: "drivingLicenseBack", label: "Driving licence", side: "Back", group: "Driver" },
  { key: "identityFront", label: "Identity document", side: "Front", group: "Identity" },
  { key: "identityBack", label: "Identity document", side: "Back", group: "Identity" },
  { key: "passportCopy", label: "Passport copy", group: "Identity" },
  { key: "profileImage", label: "Profile image", group: "Profile" },
];

const stageStatus = (request, stage) => {
  const nested = request?.stages?.[stage]?.status;
  if (nested) {
    const normalized = String(nested).toLowerCase();
    return stage === "basic" && normalized === "completed" ? "approved" : normalized;
  }
  if (stage === "profile") {
    if (request?.profileRequestStatus) return String(request.profileRequestStatus).toLowerCase();
    return String(request?.status).toLowerCase() === "completed" ? "approved" : "not_submitted";
  }
  const aggregate = String(request?.status || "pending").toLowerCase();
  return ["approved", "completed"].includes(aggregate) ? "approved" : aggregate;
};

const stageActorName = (request, stage) => {
  const actor = request?.stages?.[stage]?.approvedBy || (stage === "profile" ? request?.profileApprovedBy : request?.approvedBy);
  return actor?.fullName || actor?.name || actor?.email || (stage === "profile" ? request?.profileApprovedByName : request?.approvedByName) || "—";
};

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value)) : "—";
const formatNumber = (value) => Number(value || 0).toLocaleString();
const compactStatus = (value) => String(value || "not available").replaceAll("_", " ");
const gpsAge = (driver) => {
  const seconds = Number(driver?.locationAgeSeconds);
  if (!Number.isFinite(seconds)) return "No GPS fix";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
};

const getDocumentUrl = (request, document) => {
  const manifestEntry = request?.documents?.find((item) => item.key === document.key);
  return manifestEntry?.available ? normalizeAssetUrl(manifestEntry.viewUrl) : "";
};

const isPdfDocument = (url, contentType = "") =>
  String(contentType).toLowerCase().includes("application/pdf") ||
  /^data:application\/pdf/i.test(url) ||
  /\.pdf(?:$|[?#])/i.test(url);

const extensionFor = (url, contentType) => {
  if (String(contentType).includes("pdf") || isPdfDocument(url)) return "pdf";
  const match = String(url).match(/\.([a-z0-9]{2,5})(?:$|[?#])/i);
  return match?.[1] || "jpg";
};

const saveBlob = (blob, filename) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

function Stepper({ steps }) {
  const stateStyles = {
    complete: { dot: "bg-green-500 text-white", line: "bg-green-500", text: "text-slate-700" },
    "in-progress": { dot: "bg-[#BE1B2C] text-white", line: "bg-slate-200", text: "text-slate-700" },
    attention: { dot: "bg-red-500 text-white", line: "bg-slate-200", text: "text-red-700" },
    waiting: { dot: "bg-slate-200 text-slate-500", line: "bg-slate-200", text: "text-slate-400" },
  };
  return (
    <div className="flex items-center">
      {steps.map((step, index) => {
        const style = stateStyles[step.state] || stateStyles.waiting;
        return (
          <div key={step.title} className={`flex items-center ${index < steps.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${style.dot}`}>
                {step.state === "complete" ? <CheckCircle2 size={16} /> : index + 1}
              </div>
              <div className="text-center">
                <p className={`text-xs font-semibold ${style.text}`}>{step.title}</p>
                <p className="text-[10px] text-slate-400 max-w-[110px]">{step.meta}</p>
              </div>
            </div>
            {index < steps.length - 1 && <div className={`h-0.5 flex-1 mx-2 rounded-full ${style.line}`} />}
          </div>
        );
      })}
    </div>
  );
}
Stepper.propTypes = { steps: PropTypes.array.isRequired };

function DocumentCard({ document, busyDocument, onPreview, onDownload }) {
  const available = Boolean(document.url);
  return (
    <div className={`rounded-[12px] p-4 border flex items-start gap-3 ${available ? "border-slate-200 bg-white" : "border-red-200 bg-red-50/30"}`}>
      <div className="w-9 h-9 rounded-[8px] bg-slate-100 flex items-center justify-center shrink-0">
        {available ? <FileText size={16} className="text-slate-400" /> : <AlertTriangle size={16} className="text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400">{document.group}{document.side ? ` · ${document.side}` : ""}</p>
        <p className="text-sm font-semibold text-slate-800">{document.label}</p>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-1
          ${available ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"}`}>
          {available ? "Available" : "Missing"}
        </span>
      </div>
      {available && (
        <div className="flex flex-col gap-1.5 shrink-0">
          <button type="button" disabled={Boolean(busyDocument)} onClick={(event) => onPreview(document, event)}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50" title="Preview" aria-label={`Preview ${document.label}`}>
            {busyDocument === `preview-${document.key}` ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin block" /> : <Eye size={14} />}
          </button>
          <button type="button" disabled={Boolean(busyDocument)} onClick={() => onDownload(document)}
            className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50" title="Download" aria-label={`Download ${document.label}`}>
            {busyDocument === `download-${document.key}` ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin block" /> : <Download size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
DocumentCard.propTypes = {
  document: PropTypes.shape({ key: PropTypes.string, label: PropTypes.string, group: PropTypes.string, side: PropTypes.string, url: PropTypes.string }).isRequired,
  busyDocument: PropTypes.string,
  onPreview: PropTypes.func.isRequired,
  onDownload: PropTypes.func.isRequired,
};

const PreviewDialog = ({ preview, onClose }) => {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <div className="relative bg-white rounded-[16px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="document-preview-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h3 id="document-preview-title" className="text-base font-bold text-slate-900">{preview.label}</h3>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close document preview"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[8px] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-6 flex items-center justify-center">
          {preview.isPdf ? (
            <object data={preview.objectUrl} type="application/pdf" aria-label={preview.label} className="w-full h-[70vh]">
              <p className="text-sm text-slate-500">PDF preview is unavailable in this browser.</p>
            </object>
          ) : (
            <SafeImage src={preview.objectUrl} alt={preview.label} fallbackLabel={`${preview.label} unavailable`} className="max-h-[70vh] rounded-[10px]" />
          )}
        </div>
      </div>
    </div>
  );
};

PreviewDialog.propTypes = {
  preview: PropTypes.shape({
    label: PropTypes.string.isRequired,
    objectUrl: PropTypes.string.isRequired,
    isPdf: PropTypes.bool.isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

const DriverDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [busyDocument, setBusyDocument] = useState("");
  const [preview, setPreview] = useState(null);
  const [rejectDialog, setRejectDialog] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toastMsg, setToastMsg] = useState(null);
  const previewTriggerRef = useRef(null);

  const closePreview = useCallback(() => {
    setPreview(null);
    window.setTimeout(() => previewTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => () => {
    if (preview?.revoke) URL.revokeObjectURL(preview.objectUrl);
  }, [preview]);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setHistoryError("");
      const detailPayload = await getRequestDetails(id);
      const detail = detailPayload?.request || detailPayload?.driver || detailPayload?.data || detailPayload;
      setRequest(detail);

      try {
        const historyPayload = await getRequestHistory(id);
        setHistory(historyPayload?.history || historyPayload?.data?.history || []);
      } catch (auditError) {
        setHistory([]);
        setHistoryError(auditError?.response?.data?.message || "Audit history could not be loaded.");
      }
    } catch (detailError) {
      setRequest(null);
      setError(detailError?.response?.data?.message || "Request details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleDeleteDriver = async () => {
    const result = await Swal.fire({
      title: "Delete Driver Account Completely?",
      text: "Warning: This driver account and all associated documents will be permanently erased. If they sign up again, they will start from scratch.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete permanently!",
    });
    if (!result.isConfirmed) return;
    try {
      setBusyAction("delete-driver");
      await deleteDriver(id);
      navigate("/drivers", { replace: true });
    } catch (err) {
      setToast({ message: err?.response?.data?.message || err?.message || "Failed to delete driver.", type: "error" });
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    if (id) loadDetail();
  }, [id, loadDetail]);

  const documents = useMemo(() => documentFields.map((document) => ({
    ...document,
    url: getDocumentUrl(request, document),
  })), [request]);

  const availableDocuments = documents.filter((document) => document.url).length;
  const fullName = request?.requesterName || `${request?.firstName || ""} ${request?.lastName || ""}`.trim() || request?.fullName || "Unnamed driver";
  const status = String(request?.status || "pending").toLowerCase();
  const basicStatus = stageStatus(request, "basic");
  const profileStatus = stageStatus(request, "profile");
  const initials = fullName.split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase()).slice(0, 2).join("") || "?";

  const steps = useMemo(() => [
    { title: "Request 1", description: "Initial application approval", state: basicStatus === "approved" ? "complete" : basicStatus === "rejected" ? "attention" : "in-progress", meta: basicStatus.replaceAll("_", " ") },
    { title: "Request 2", description: "Profile and documents approval", state: profileStatus === "approved" ? "complete" : profileStatus === "rejected" ? "attention" : profileStatus === "pending" ? "in-progress" : "waiting", meta: profileStatus === "not_submitted" ? `${availableDocuments}/${documents.length} documents available` : profileStatus.replaceAll("_", " ") },
    { title: "Completed", description: "Both approvals granted", state: status === "completed" ? "complete" : "waiting", meta: status === "completed" ? formatDate(request?.completedAt || request?.profileApprovedAt) : "Waiting for both approvals" },
  ], [availableDocuments, basicStatus, documents.length, profileStatus, request, status]);

  const toast = (icon, title) => Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 2500 });

  const runMutation = async (name, action, successMessage) => {
    try {
      setBusyAction(name);
      await action();
      setToastMsg(successMessage);
      await loadDetail();
    } catch (mutationError) {
      Swal.fire("Error", mutationError?.response?.data?.message || "The request could not be updated.", "error");
    } finally {
      setBusyAction("");
    }
  };

  const approve = () => runMutation("basic-approve", () => approveRequest(id), "Request 1 approved");
  const approveProfile = () => runMutation("profile-approve", () => approveProfileRequest(id), "Request 2 approved");

  const reject = () => setRejectDialog("basic");
  const rejectProfile = () => setRejectDialog("profile");

  const submitReject = () => {
    if (rejectDialog === "profile" && !rejectReason.trim()) return;
    const stage = rejectDialog;
    setRejectDialog(null);
    if (stage === "basic") {
      runMutation("basic-reject", () => updateDriverReviewStatus(id, { status: "rejected", rejection_reason: rejectReason || "" }), "Request 1 rejected");
    } else {
      runMutation("profile-reject", () => rejectProfileRequest(id, rejectReason.trim()), "Request 2 rejected");
    }
    setRejectReason("");
  };

  const reopen = async () => {
    const result = await Swal.fire({
      title: "Reopen this request?",
      text: "It will return to Pending Requests and keep its audit history.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reopen request",
      confirmButtonColor: "#BE1B2C",
    });
    if (result.isConfirmed) runMutation("basic-reopen", () => reopenRequest(id), "Request 1 reopened");
  };

  const reopenProfile = async () => {
    const result = await Swal.fire({
      title: "Reopen Request 2?",
      text: "The profile and documents will return to pending review. Its history will be preserved.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reopen Request 2",
      confirmButtonColor: "#BE1B2C",
    });
    if (result.isConfirmed) runMutation("profile-reopen", () => reopenProfileRequest(id, ""), "Request 2 reopened");
  };

  const getDocumentBlob = async (document) => {
    if (!isTrustedApiAssetUrl(document.url)) {
      throw Object.assign(new Error("This legacy document is stored outside the protected API. Use Open in new tab."), { code: "EXTERNAL_DOCUMENT" });
    }
    return getProtectedDocumentBlob(document.url);
  };

  const openDocument = async (document, event) => {
    previewTriggerRef.current = event.currentTarget;
    try {
      setBusyDocument(`preview-${document.key}`);
      const { blob, contentType } = await getDocumentBlob(document);
      const objectUrl = URL.createObjectURL(blob);
      setPreview({ label: `${document.label}${document.side ? ` — ${document.side}` : ""}`, objectUrl, isPdf: isPdfDocument(document.url, contentType), revoke: true });
    } catch (documentError) {
      if (documentError.code === "EXTERNAL_DOCUMENT") {
        window.open(document.url, "_blank", "noopener,noreferrer");
        toast("info", "Opened from external storage");
      } else {
        Swal.fire("Error", await getDocumentErrorMessage(documentError), "error");
      }
    } finally {
      setBusyDocument("");
    }
  };

  const downloadDocument = async (document) => {
    try {
      setBusyDocument(`download-${document.key}`);
      const { blob, contentType } = await getDocumentBlob(document);
      saveBlob(blob, `${document.key}.${extensionFor(document.url, contentType)}`);
      toast("success", "Document downloaded");
    } catch (documentError) {
      if (documentError.code === "EXTERNAL_DOCUMENT") {
        window.open(document.url, "_blank", "noopener,noreferrer");
        toast("info", "Opened from external storage");
      } else {
        Swal.fire("Error", await getDocumentErrorMessage(documentError), "error");
      }
    } finally {
      setBusyDocument("");
    }
  };

  if (loading) return <div className="flex flex-col gap-6"><Card className="p-0"><LoadingState label="Loading request details…" /></Card></div>;
  if (error || !request) {
    return (
      <div className="flex flex-col gap-6">
        <Card className="p-0">
          <ErrorState title="Request unavailable" description={error || "Request not found."}
            action={
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Back</Button>
                <Button variant="primary" size="sm" onClick={loadDetail}>Retry</Button>
              </div>
            } />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button type="button" onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#BE1B2C]/10 flex items-center justify-center text-lg font-bold text-[#BE1B2C]">{initials}</div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">{fullName}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{request.requestId || request._id || id}</span>
                <Badge variant={status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<MapPin size={14} />} onClick={() => navigate(`/live-map?driverId=${encodeURIComponent(id)}`)}>View on Live Map</Button>
            <Button variant="secondary" size="sm" icon={<RotateCw size={14} />} onClick={loadDetail} loading={loading}>Refresh</Button>
          </div>
        </div>
      </div>

      <Card className="px-8 py-5">
        <Stepper steps={steps} />
      </Card>

      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Request 1 — Initial Application</h2>
            <div className="grid grid-cols-2 gap-x-8">
              <StatRow label="Full name" value={fullName} />
              <StatRow label="Phone" value={`${request.countryCode || ""} ${request.phone || "—"}`.trim()} />
              <StatRow label="WhatsApp" value={request.whatsappNumber || "—"} />
              <StatRow label="Email" value={request.email || "—"} />
              <StatRow label="Submitted" value={formatDate(request.basicRequestSubmittedAt || request.submittedAt)} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Request 2 — Profile &amp; Documents</h2>
              <span className="text-xs text-slate-400">{availableDocuments}/{documents.length} available</span>
            </div>
            {request.isUpdate && ["pending", "rejected"].includes(profileStatus) && (
              <div className="mb-3 bg-sky-50 border border-sky-200 rounded-[10px] px-3.5 py-2.5 text-xs text-sky-700">
                This section shows the driver&apos;s latest submitted changes. Approving Request 2 will apply them to the live profile.
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-8 mb-4">
              <StatRow label="Address" value={request.address || request.driverLogs?.address || "—"} />
              <StatRow label="City" value={request.city || request.driverLogs?.city || "—"} />
              <StatRow label="Vehicle type" value={request.vehicleType || request.driverLogs?.vehicleType || "—"} />
              <StatRow label="Contract number" value={request.contractNumber || "—"} />
              <StatRow label="Licence company" value={request.licenseCompany || "—"} />
              <StatRow label="Completed at" value={formatDate(request.completedAt)} />
            </div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map((document) => (
                <DocumentCard key={document.key} document={document} busyDocument={busyDocument} onPreview={openDocument} onDownload={downloadDocument} />
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Driver Activity</h2>
              <Badge variant={request.isDiscoverable ? "active" : "restricted"} label={request.isDiscoverable ? "Discoverable" : "Not discoverable"} />
            </div>
            <div className="grid grid-cols-2 gap-x-8">
              <StatRow label="Availability" value={request.availabilityStatus || "Offline"} />
              <StatRow label="Presence" value={request.presenceStatus || "Offline"} />
              <StatRow label="Last GPS" value={`${gpsAge(request)}${request.locationAccuracyM !== null && request.locationAccuracyM !== undefined ? ` / ±${Math.round(Number(request.locationAccuracyM))}m` : ""}`} />
              <StatRow label="Service area" value={request.currentServiceArea || "—"} />
              <StatRow label="Points available" value={formatNumber(request.pointsWallet?.availablePoints)} />
              <StatRow label="Reserved points" value={formatNumber(request.pointsWallet?.reservedPoints)} />
              <StatRow label="Completed rides" value={formatNumber(request.rideSummary?.completed)} />
              <StatRow label="Pending trip offers" value={formatNumber(request.tripOfferSummary?.pending)} />
            </div>
            {!request.isDiscoverable && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-[10px] px-3.5 py-2.5 text-xs text-amber-700">
                {(request.discoverabilityReasons || []).map(compactStatus).join(", ") || "Driver is blocked from passenger discovery."}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Recent Rides &amp; Offers</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-slate-50 rounded-[10px] p-3 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Active ride</p>
                <p className="text-sm font-semibold text-slate-700">{request.rideSummary?.activeRide?.reference || "None"}</p>
                <p className="text-xs text-slate-400">{compactStatus(request.rideSummary?.activeRide?.status || "No active ride")}</p>
              </div>
              <div className="bg-slate-50 rounded-[10px] p-3 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Trip offers</p>
                <p className="text-sm font-semibold text-slate-700">{formatNumber(request.tripOfferSummary?.total)} total</p>
                <p className="text-xs text-slate-400">{formatNumber(request.tripOfferSummary?.pending)} pending</p>
              </div>
            </div>
            {request.recentRides?.length ? (
              <div className="flex flex-col gap-2">
                {request.recentRides.slice(0, 5).map((ride) => (
                  <div key={ride._id} className="flex items-start gap-3 bg-white rounded-[10px] border border-slate-100 px-3.5 py-2.5">
                    <Clock size={14} className="text-slate-300 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700">{ride.reference || ride._id} · {compactStatus(ride.status)}</p>
                      <p className="text-xs text-slate-400 truncate">{ride.pickup?.address || "Pickup not available"} → {ride.destination?.address || "Destination not available"}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{formatDate(ride.updatedAt || ride.requestedAt)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400">No ride history returned for this driver.</p>}
          </Card>
        </div>

        <div className="w-full xl:w-80 shrink-0 flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Approval 1</h2>
              <Badge variant={basicStatus} />
            </div>
            <StatRow label="Approved" value={formatDate(request.stages?.basic?.approvedAt || request.approvedAt)} />
            <StatRow label="Approved by" value={stageActorName(request, "basic")} />
            {request.rejectionReason && <StatRow label="Rejection reason" value={request.rejectionReason} />}
            <div className="flex flex-col gap-2 mt-3">
              {["pending", "rejected"].includes(basicStatus) && (
                <Button variant="primary" size="sm" disabled={Boolean(busyAction)} loading={busyAction === "basic-approve"} icon={<CheckCircle2 size={13} />} onClick={approve}>Approve Request 1</Button>
              )}
              {basicStatus === "pending" && (
                <Button variant="danger" size="sm" disabled={Boolean(busyAction)} icon={<XCircle size={13} />} onClick={reject}>Reject Request 1</Button>
              )}
              {basicStatus === "approved" && (
                <Button variant="warning" size="sm" disabled={Boolean(busyAction)} loading={busyAction === "basic-reopen"} icon={<RotateCw size={13} />} onClick={reopen}>Reopen Request 1</Button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Approval 2</h2>
              <Badge variant={profileStatus} />
            </div>
            <StatRow label="Approved" value={formatDate(request.stages?.profile?.approvedAt || request.profileApprovedAt)} />
            <StatRow label="Approved by" value={stageActorName(request, "profile")} />
            {request.profileRejectionReason && <StatRow label="Rejection reason" value={request.profileRejectionReason} />}
            {profileStatus === "not_submitted" ? (
              <p className="text-xs text-slate-400 mt-2">The driver has not submitted Request 2 yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mt-3">
                {profileStatus === "pending" && (
                  <Button variant="primary" size="sm" disabled={Boolean(busyAction)} loading={busyAction === "profile-approve"} icon={<CheckCircle2 size={13} />} onClick={approveProfile}>Approve Request 2</Button>
                )}
                {profileStatus === "pending" && (
                  <Button variant="danger" size="sm" disabled={Boolean(busyAction)} icon={<XCircle size={13} />} onClick={rejectProfile}>Reject Request 2</Button>
                )}
                {profileStatus === "approved" && (
                  <Button variant="warning" size="sm" disabled={Boolean(busyAction)} loading={busyAction === "profile-reopen"} icon={<RotateCw size={13} />} onClick={reopenProfile}>Reopen Request 2</Button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Overall Decision</h2>
            <StatRow label="Status" value={<Badge variant={status} />} />
            <StatRow label="Approved by" value={request.approvedBy?.fullName || request.approvedByName || "—"} />
            <StatRow label="Completed" value={formatDate(request.completedAt)} />
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Button variant="danger" size="sm" className="w-full" disabled={Boolean(busyAction)} loading={busyAction === "delete-driver"} icon={<Trash2 size={13} />} onClick={handleDeleteDriver}>
                Delete Driver Completely
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Audit Log</h2>
              <span className="text-xs text-slate-400">{history.length} events</span>
            </div>
            {historyError ? (
              <div className="bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2 text-xs text-amber-700">{historyError}</div>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-400">No status changes have been recorded yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
                <div className="flex flex-col gap-4">
                  {history.map((entry) => (
                    <div key={entry._id || `${entry.occurredAt}-${entry.action}`} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shrink-0 relative z-10">
                        {String(entry.newStatus).includes("approv") ? <CheckCircle2 size={12} className="text-green-500" /> : String(entry.newStatus).includes("reject") ? <XCircle size={12} className="text-red-500" /> : <Clock size={12} className="text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{entry.requestStage === "profile" ? "Request 2" : "Request 1"} · {String(entry.action || "status changed").replaceAll("_", " ")}</p>
                        <p className="text-[11px] text-slate-400">{entry.oldStatus} → {entry.newStatus}</p>
                        <p className="text-[11px] text-slate-400">{entry.actorName || entry.actorEmail || entry.actorType || "System"} · {formatDate(entry.occurredAt || entry.createdAt)}</p>
                        {entry.reason && <p className="text-xs text-slate-500 italic mt-0.5">&quot;{entry.reason}&quot;</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {preview && <PreviewDialog preview={preview} onClose={closePreview} />}

      <ConfirmDialog
        open={rejectDialog === "basic"} onClose={() => setRejectDialog(null)}
        onConfirm={submitReject} title="Reject Request 1" confirmLabel="Reject Request 1" variant="danger"
        message={
          <div className="flex flex-col gap-3">
            <p>You are rejecting Request 1 for <strong>{fullName}</strong>.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
              placeholder="Reason (optional)…"
              className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-400 resize-none" />
          </div>
        }
      />

      <Modal open={rejectDialog === "profile"} onClose={() => setRejectDialog(null)} title="Reject Request 2">
        <div className="flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-[10px] p-3 text-sm text-red-700">
            You are rejecting Request 2 for <strong>{fullName}</strong>. Your reason will be sent to the driver.
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Rejection reason <span className="text-red-500">*</span></label>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4}
              placeholder="Explain what the driver needs to correct…"
              className="w-full bg-white border border-slate-200 rounded-[10px] p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 resize-none" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button variant="danger" onClick={submitReject} disabled={!rejectReason.trim()} loading={busyAction === "profile-reject"}>Reject Request 2</Button>
          </div>
        </div>
      </Modal>

      {toastMsg && <Toast message={toastMsg} type="success" onClose={() => setToastMsg(null)} />}
    </div>
  );
};

export default DriverDetail;
