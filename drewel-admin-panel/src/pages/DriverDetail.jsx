import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import PropTypes from "prop-types";
import SafeImage from "../components/SafeImage";
import { updateDriverReviewStatus } from "../utils/api";
import { isTrustedApiAssetUrl, normalizeAssetUrl } from "../utils/media";
import {
  approveProfileRequest,
  approveRequest,
  getProtectedDocumentBlob,
  getRequestDetails,
  getRequestHistory,
  rejectProfileRequest,
  reopenProfileRequest,
  reopenRequest,
} from "../utils/requestsApi";
import "../assets/css/requests.css";

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

const statusBadgeClass = (status) => ({
  approved: "badge-success",
  completed: "badge-primary",
  rejected: "badge-danger",
  pending: "badge-warning",
}[String(status || "pending").toLowerCase()] || "badge-secondary");

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
  return actor?.fullName || actor?.name || actor?.email || (stage === "profile" ? request?.profileApprovedByName : request?.approvedByName) || "Not available";
};

const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value)) : "Not available";

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
  URL.revokeObjectURL(objectUrl);
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

  return <div className="request-preview" role="presentation" onMouseDown={onClose}>
    <section
      className="request-preview__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="request-preview__header">
        <div>
          <span>Document preview</span>
          <h2 id="document-preview-title">{preview.label}</h2>
        </div>
        <button ref={closeButtonRef} type="button" className="btn btn-light" onClick={onClose} aria-label="Close document preview">Close</button>
      </header>
      <div className="request-preview__body">
        {preview.isPdf ? <object data={preview.objectUrl} type="application/pdf" aria-label={preview.label}>
          <p>PDF preview is unavailable in this browser.</p>
        </object> : <SafeImage src={preview.objectUrl} alt={preview.label} fallbackLabel={`${preview.label} unavailable`} />}
      </div>
    </section>
  </div>;
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
  const previewTriggerRef = useRef(null);

  const closePreview = useCallback(() => {
    setPreview((current) => {
      if (current?.revoke) URL.revokeObjectURL(current.objectUrl);
      return null;
    });
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

  const steps = useMemo(() => {
    return [
      { title: "Request 1", description: "Initial application approval", state: basicStatus === "approved" ? "complete" : basicStatus === "rejected" ? "attention" : "in-progress", meta: basicStatus.replaceAll("_", " ") },
      { title: "Request 2", description: "Profile and documents approval", state: profileStatus === "approved" ? "complete" : profileStatus === "rejected" ? "attention" : profileStatus === "pending" ? "in-progress" : "waiting", meta: profileStatus === "not_submitted" ? `${availableDocuments}/${documents.length} documents available` : profileStatus.replaceAll("_", " ") },
      { title: "Completed", description: "Both approvals granted", state: status === "completed" ? "complete" : "waiting", meta: status === "completed" ? formatDate(request?.completedAt || request?.profileApprovedAt) : "Waiting for both approvals" },
    ];
  }, [availableDocuments, basicStatus, documents.length, profileStatus, request, status]);

  const toast = (icon, title) => Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    showConfirmButton: false,
    timer: 2500,
  });

  const runMutation = async (name, action, successMessage) => {
    try {
      setBusyAction(name);
      await action();
      toast("success", successMessage);
      await loadDetail();
    } catch (mutationError) {
      Swal.fire("Error", mutationError?.response?.data?.message || "The request could not be updated.", "error");
    } finally {
      setBusyAction("");
    }
  };

  const approve = () => runMutation("basic-approve", () => approveRequest(id), "Request 1 approved");

  const reject = async () => {
    const result = await Swal.fire({
      title: "Reject request",
      input: "text",
      inputLabel: "Reason (optional)",
      showCancelButton: true,
      confirmButtonText: "Reject",
      confirmButtonColor: "#dc3545",
    });
    if (result.isConfirmed) {
      runMutation("basic-reject", () => updateDriverReviewStatus(id, { status: "rejected", rejection_reason: result.value || "" }), "Request 1 rejected");
    }
  };

  const reopen = async () => {
    const result = await Swal.fire({
      title: "Reopen this request?",
      text: "It will return to Pending Requests and keep its audit history.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reopen request",
      confirmButtonColor: "#00489d",
    });
    if (result.isConfirmed) runMutation("basic-reopen", () => reopenRequest(id), "Request 1 reopened");
  };

  const approveProfile = () => runMutation("profile-approve", () => approveProfileRequest(id), "Request 2 approved");

  const rejectProfile = async () => {
    const result = await Swal.fire({
      title: "Reject Request 2",
      input: "textarea",
      inputLabel: "Reason",
      inputPlaceholder: "Explain what the driver needs to correct",
      inputValidator: (value) => value.trim() ? undefined : "A rejection reason is required.",
      showCancelButton: true,
      confirmButtonText: "Reject Request 2",
      confirmButtonColor: "#dc3545",
    });
    if (result.isConfirmed) runMutation("profile-reject", () => rejectProfileRequest(id, result.value.trim()), "Request 2 rejected");
  };

  const reopenProfile = async () => {
    const result = await Swal.fire({
      title: "Reopen Request 2?",
      text: "The profile and documents will return to pending review. Its history will be preserved.",
      icon: "warning",
      input: "text",
      inputLabel: "Reason (optional)",
      showCancelButton: true,
      confirmButtonText: "Reopen Request 2",
      confirmButtonColor: "#00489d",
    });
    if (result.isConfirmed) runMutation("profile-reopen", () => reopenProfileRequest(id, result.value || ""), "Request 2 reopened");
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
        Swal.fire("Error", documentError?.response?.data?.message || "The document could not be opened.", "error");
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
        Swal.fire("Error", documentError?.response?.data?.message || "The document could not be downloaded.", "error");
      }
    } finally {
      setBusyDocument("");
    }
  };

  if (loading) return <main className="app-content requests-page"><div className="tile requests-detail-state" aria-live="polite"><div className="loader"/><span>Loading request details...</span></div></main>;
  if (error || !request) return <main className="app-content requests-page"><div className="tile requests-detail-state" role="alert"><i className="fa fa-exclamation-circle" aria-hidden="true"/><h1>Request unavailable</h1><p>{error || "Request not found."}</p><div><button type="button" className="btn btn-outline-secondary mr-2" onClick={() => navigate(-1)}>Back</button><button type="button" className="btn btn-primary" onClick={loadDetail}>Retry</button></div></div></main>;

  return <main className="app-content requests-page request-detail-page">
    <header className="app-title tile p-3 request-detail-header">
      <div>
        <button type="button" className="request-back-link" onClick={() => navigate(-1)}><i className="fa fa-arrow-left" aria-hidden="true"/> Back to requests</button>
        <div className="request-detail-title"><div><span>Driver verification</span><h1>{fullName}</h1><p>Request ID: <strong>{request.requestId || request._id || id}</strong></p></div><span className={`badge ${statusBadgeClass(status)}`}>{status.toUpperCase()}</span></div>
      </div>
      <div className="request-detail-actions" aria-label="Request actions" aria-busy={Boolean(busyAction)}>
        <button type="button" className="btn btn-outline-primary" disabled={loading || Boolean(busyAction)} onClick={loadDetail}>Refresh</button>
      </div>
    </header>

    <section className="tile p-4 request-progress-section" aria-labelledby="request-progress-title">
      <h2 id="request-progress-title">Request progress</h2>
      <ol className="request-stepper">
        {steps.map((step, index) => <li key={step.title} className={`request-step request-step--${step.state}`}>
          <span className="request-step__number" aria-hidden="true">{step.state === "complete" ? <i className="fa fa-check"/> : index + 1}</span>
          <div><strong>{step.title}</strong><span>{step.description}</span><small>{step.meta}</small></div>
          <span className="sr-only">{step.state.replace("-", " ")}</span>
        </li>)}
      </ol>
    </section>

    <div className="request-detail-layout">
      <div>
        <section className="tile p-4 request-detail-section" aria-labelledby="request-one-title">
          <div className="request-section-heading"><div><span>Request 1</span><h2 id="request-one-title">Initial application</h2></div><span className={`badge ${statusBadgeClass(basicStatus)}`}>{basicStatus.replaceAll("_", " ").toUpperCase()}</span></div>
          <dl className="request-info-grid">
            <div><dt>Full name</dt><dd>{fullName}</dd></div><div><dt>Phone</dt><dd>{request.countryCode || ""} {request.phone || "Not available"}</dd></div>
            <div><dt>WhatsApp</dt><dd>{request.whatsappNumber || "Not available"}</dd></div><div><dt>Email</dt><dd>{request.email || "Not available"}</dd></div>
          </dl>
        </section>

        <section className="tile p-4 request-detail-section" aria-labelledby="request-two-title">
          <div className="request-section-heading"><div><span>Request 2</span><h2 id="request-two-title">Driver profile and documents</h2></div><div className="request-stage-heading-status"><span className={`badge ${statusBadgeClass(profileStatus)}`}>{profileStatus.replaceAll("_", " ").toUpperCase()}</span><strong>{availableDocuments}/{documents.length} available</strong></div></div>
          <dl className="request-info-grid">
            <div><dt>Address</dt><dd>{request.address || request.driverLogs?.address || "Not available"}</dd></div><div><dt>City</dt><dd>{request.city || request.driverLogs?.city || "Not available"}</dd></div>
            <div><dt>Vehicle type</dt><dd>{request.vehicleType || request.driverLogs?.vehicleType || "Not available"}</dd></div><div><dt>Contract number</dt><dd>{request.contractNumber || "Not available"}</dd></div>
            <div><dt>Licence company</dt><dd>{request.licenseCompany || "Not available"}</dd></div><div><dt>Completed at</dt><dd>{formatDate(request.completedAt)}</dd></div>
          </dl>

          <h3 className="request-documents-title">Documents</h3>
          <div className="request-documents-grid">
            {documents.map((document) => <article className={`request-document-card ${document.url ? "is-available" : "is-missing"}`} key={document.key}>
              <div className="request-document-thumb">
                <i className={`fa ${document.url ? "fa-file-text-o" : "fa-file-o"}`} aria-hidden="true"/>
              </div>
              <div className="request-document-content"><span>{document.group}{document.side ? ` · ${document.side}` : ""}</span><h4>{document.label}</h4><span className={`request-document-availability ${document.url ? "available" : "missing"}`}><i className={`fa ${document.url ? "fa-check-circle" : "fa-minus-circle"}`} aria-hidden="true"/> {document.url ? "Available" : "Missing"}</span></div>
              {document.url && <div className="request-document-actions"><button type="button" className="btn btn-sm btn-outline-primary" disabled={Boolean(busyDocument)} aria-busy={busyDocument === `preview-${document.key}`} onClick={(event) => openDocument(document, event)}>{busyDocument === `preview-${document.key}` ? "Opening..." : "Preview"}</button><button type="button" className="btn btn-sm btn-outline-secondary" disabled={Boolean(busyDocument)} aria-busy={busyDocument === `download-${document.key}`} onClick={() => downloadDocument(document)}>{busyDocument === `download-${document.key}` ? "Downloading..." : "Download"}</button></div>}
            </article>)}
          </div>
        </section>
      </div>

      <aside>
        <section className="tile p-4 request-detail-section request-approval-card" aria-labelledby="approval-one-title">
          <div className="request-section-heading"><div><span>Approval 1</span><h2 id="approval-one-title">Initial request decision</h2></div><span className={`badge ${statusBadgeClass(basicStatus)}`}>{basicStatus.replaceAll("_", " ").toUpperCase()}</span></div>
          <dl className="request-review-list"><div><dt>Submitted</dt><dd>{formatDate(request.basicRequestSubmittedAt || request.submittedAt)}</dd></div><div><dt>Approved</dt><dd>{formatDate(request.stages?.basic?.approvedAt || request.approvedAt)}</dd></div><div><dt>Approved by</dt><dd>{stageActorName(request, "basic")}</dd></div>{request.rejectionReason && <div><dt>Rejection reason</dt><dd>{request.rejectionReason}</dd></div>}</dl>
          <div className="request-stage-actions" aria-label="Request 1 approval actions" aria-busy={busyAction.startsWith("basic-")}>
            {["pending", "rejected"].includes(basicStatus) && <button type="button" className="btn btn-success" disabled={Boolean(busyAction)} onClick={approve}>{busyAction === "basic-approve" ? "Approving..." : "Approve Request 1"}</button>}
            {basicStatus === "pending" && <button type="button" className="btn btn-danger" disabled={Boolean(busyAction)} onClick={reject}>{busyAction === "basic-reject" ? "Rejecting..." : "Reject Request 1"}</button>}
            {basicStatus === "approved" && <button type="button" className="btn btn-warning" disabled={Boolean(busyAction)} onClick={reopen}>{busyAction === "basic-reopen" ? "Reopening..." : "Reopen Request 1"}</button>}
          </div>
        </section>

        <section className="tile p-4 request-detail-section request-approval-card" aria-labelledby="approval-two-title">
          <div className="request-section-heading"><div><span>Approval 2</span><h2 id="approval-two-title">Profile and documents decision</h2></div><span className={`badge ${statusBadgeClass(profileStatus)}`}>{profileStatus.replaceAll("_", " ").toUpperCase()}</span></div>
          <dl className="request-review-list"><div><dt>Submitted</dt><dd>{formatDate(request.stages?.profile?.submittedAt || request.profileSubmittedAt)}</dd></div><div><dt>Approved</dt><dd>{formatDate(request.stages?.profile?.approvedAt || request.profileApprovedAt)}</dd></div><div><dt>Approved by</dt><dd>{stageActorName(request, "profile")}</dd></div>{request.profileRejectionReason && <div><dt>Rejection reason</dt><dd>{request.profileRejectionReason}</dd></div>}</dl>
          {profileStatus === "not_submitted" ? <p className="request-muted">The driver has not submitted Request 2 yet.</p> : <div className="request-stage-actions" aria-label="Request 2 approval actions" aria-busy={busyAction.startsWith("profile-")}>
            {profileStatus === "pending" && <button type="button" className="btn btn-success" disabled={Boolean(busyAction)} onClick={approveProfile}>{busyAction === "profile-approve" ? "Approving..." : "Approve Request 2"}</button>}
            {profileStatus === "pending" && <button type="button" className="btn btn-danger" disabled={Boolean(busyAction)} onClick={rejectProfile}>{busyAction === "profile-reject" ? "Rejecting..." : "Reject Request 2"}</button>}
            {profileStatus === "approved" && <button type="button" className="btn btn-warning" disabled={Boolean(busyAction)} onClick={reopenProfile}>{busyAction === "profile-reopen" ? "Reopening..." : "Reopen Request 2"}</button>}
          </div>}
        </section>

        <section className="tile p-4 request-detail-section" aria-labelledby="review-title">
          <div className="request-section-heading"><div><span>Review</span><h2 id="review-title">Decision</h2></div><span className={`badge ${statusBadgeClass(status)}`}>{status.toUpperCase()}</span></div>
          <dl className="request-review-list"><div><dt>Submitted</dt><dd>{formatDate(request.basicRequestSubmittedAt || request.submittedAt)}</dd></div><div><dt>Approved</dt><dd>{formatDate(request.approvedAt)}</dd></div><div><dt>Approved by</dt><dd>{request.approvedBy?.fullName || request.approvedByName || "Not available"}</dd></div><div><dt>Completed</dt><dd>{formatDate(request.completedAt)}</dd></div>{request.rejectionReason && <div><dt>Rejection reason</dt><dd>{request.rejectionReason}</dd></div>}</dl>
        </section>

        <section className="tile p-4 request-detail-section" aria-labelledby="history-title">
          <div className="request-section-heading"><div><span>Audit log</span><h2 id="history-title">History</h2></div><span>{history.length} events</span></div>
          {historyError ? <div className="alert alert-warning" role="alert">{historyError}</div> : history.length === 0 ? <p className="request-muted">No status changes have been recorded yet.</p> : <ol className="request-history">
            {history.map((entry) => <li key={entry._id || `${entry.occurredAt}-${entry.action}`}><span className={`request-history__dot ${statusBadgeClass(entry.newStatus)}`} aria-hidden="true"/><div><strong>{entry.requestStage === "profile" ? "Request 2" : "Request 1"} · {String(entry.action || "status changed").replaceAll("_", " ")}</strong><span>{entry.oldStatus} → {entry.newStatus}</span><small>{entry.actorName || entry.actorEmail || entry.actorType || "System"} · {formatDate(entry.occurredAt || entry.createdAt)}</small>{entry.reason && <p>{entry.reason}</p>}</div></li>)}
          </ol>}
        </section>
      </aside>
    </div>

    {preview && <PreviewDialog preview={preview} onClose={closePreview}/>}
  </main>;
};

export default DriverDetail;
