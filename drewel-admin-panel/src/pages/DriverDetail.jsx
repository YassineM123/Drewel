import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import {
  getDriverDetailForReview,
  updateDriverReviewStatus,
} from "../utils/api";
import SafeImage from "../components/SafeImage";
import { isTrustedApiAssetUrl, normalizeAssetUrl } from "../utils/media";

const documentFields = [
  {
    keys: ["licenseCarUrl", "carLicenseFrontUrl", "carLicenseUrl"],
    label: "License Car",
  },
  {
    keys: ["licenseDriverUrl", "drivingLicenseFrontUrl", "drivingLicenseUrl"],
    label: "License Driver",
  },
  { keys: ["profileImageUrl"], label: "Profile Image" },
  {
    keys: ["idDocumentUrl", "idProofFrontUrl", "idProofUrl"],
    label: "ID Document",
  },
  { keys: ["passportCopyUrl"], label: "Passport Copy" },
];

const statusBadgeClass = (status) => {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "badge badge-success";
    case "completed":
      return "badge badge-primary";
    case "rejected":
      return "badge badge-danger";
    default:
      return "badge badge-warning";
  }
};

const isPdfDocument = (url) => {
  if (typeof url !== "string") return false;
  return /^data:application\/pdf/i.test(url) || /\.pdf(?:$|[?#])/i.test(url);
};

const getDocumentUrl = (driver, document) => {
  // Legacy app versions used different property names. Pending profile edits
  // are stored in driverLogs until an admin accepts them, so the review screen
  // must also surface those files instead of incorrectly displaying N/A.
  const sources = [driver, driver.driverLogs].filter(Boolean);
  for (const source of sources) {
    for (const key of document.keys) {
      const url = normalizeAssetUrl(source[key]);
      if (url) return url;
    }
  }
  return "";
};

const DriverDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState({ open: false, url: "", label: "" });

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDriverDetailForReview(id);
      setDriver(data);
    } catch {
      Swal.fire("Error", "Failed to load driver details.", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadDetail();
  }, [id, loadDetail]);

  const fullName = useMemo(() => {
    if (!driver) return "";
    const preferred = `${driver.firstName || ""} ${driver.lastName || ""}`.trim();
    return preferred || driver.fullName || "N/A";
  }, [driver]);

  const updateStatus = async (status, rejectionReason = "") => {
    try {
      await updateDriverReviewStatus(id, {
        status,
        rejection_reason: rejectionReason,
      });
      Swal.fire("Success", "Driver status updated.", "success");
      loadDetail();
    } catch (error) {
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to update status.",
        "error"
      );
    }
  };

  const onReject = async () => {
    const result = await Swal.fire({
      title: "Reject Driver Request",
      input: "text",
      inputLabel: "Reason (optional)",
      showCancelButton: true,
      confirmButtonText: "Reject",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;
    updateStatus("rejected", result.value || "");
  };

  const openPreview = (url, label) => {
    setPreview({ open: true, url, label });
  };

  return (
    <main className="app-content">
      <div className="app-title tile p-3 d-flex justify-content-between align-items-center">
        <h1>Driver Review</h1>
        <div>
          <button className="btn btn-secondary mr-2" onClick={() => navigate(-1)}>
            Back
          </button>
          <button className="btn btn-success mr-2" onClick={() => updateStatus("approved")}>
            Approve
          </button>
          <button className="btn btn-danger mr-2" onClick={onReject}>
            Reject
          </button>
          <button className="btn btn-warning" onClick={() => updateStatus("pending")}>
            Set Pending
          </button>
        </div>
      </div>

      <div className="tile p-4 mt-3">
        {loading ? (
          <p>Loading...</p>
        ) : !driver ? (
          <p>Driver not found.</p>
        ) : (
          <>
            <div className="row mb-3">
              <div className="col-md-6">
                <h4>Basic Request</h4>
                <p><strong>Name:</strong> {fullName}</p>
                <p><strong>WhatsApp:</strong> {driver.whatsappNumber || "N/A"}</p>
                <p><strong>Submitted At:</strong> {driver.basicRequestSubmittedAt ? new Date(driver.basicRequestSubmittedAt).toLocaleString() : "N/A"}</p>
              </div>
              <div className="col-md-6">
                <h4>Status</h4>
                <p>
                  <span className={statusBadgeClass(driver.status)}>
                    {(driver.status || "pending").toUpperCase()}
                  </span>
                </p>
                <p><strong>Rejection Reason:</strong> {driver.rejectionReason || "N/A"}</p>
                <p><strong>Approved At:</strong> {driver.approvedAt ? new Date(driver.approvedAt).toLocaleString() : "N/A"}</p>
                <p><strong>Completed At:</strong> {driver.completedAt ? new Date(driver.completedAt).toLocaleString() : "N/A"}</p>
              </div>
            </div>

            <hr />

            <h4>Profile Information</h4>
            <div className="row mb-3">
              <div className="col-md-6">
                <p><strong>Address:</strong> {driver.address || "N/A"}</p>
                <p><strong>Contract Number:</strong> {driver.contractNumber || "N/A"}</p>
                <p><strong>License Company:</strong> {driver.licenseCompany || "N/A"}</p>
              </div>
              <div className="col-md-6">
                <p><strong>City:</strong> {driver.city || "N/A"}</p>
                <p><strong>Vehicle Type:</strong> {driver.vehicleType || "N/A"}</p>
              </div>
            </div>

            <hr />

            <h4>Documents</h4>
            <div className="row">
              {documentFields.map((doc) => {
                const url = getDocumentUrl(driver, doc);
                return (
                  <div className="col-md-4 mb-3" key={doc.keys[0]}>
                    <strong>{doc.label}:</strong>
                    <div className="mt-2">
                      {url ? (
                        isPdfDocument(url) ? (
                          <div
                            className="d-flex flex-column align-items-start justify-content-center p-3"
                            style={{ width: 160, minHeight: 120, border: "1px solid #ddd", borderRadius: 8 }}
                          >
                            <strong className="text-danger mb-2">PDF document</strong>
                            {isTrustedApiAssetUrl(url) && (
                              <button type="button" className="btn btn-link p-0 mb-1" onClick={() => openPreview(url, doc.label)}>
                                Preview
                              </button>
                            )}
                            <a href={url} target="_blank" rel="noreferrer">Open in new tab</a>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="p-0 bg-transparent"
                            style={{ border: 0 }}
                            onClick={() => openPreview(url, doc.label)}
                            aria-label={`Preview ${doc.label}`}
                          >
                            <SafeImage
                              src={url}
                              alt={doc.label}
                              fallbackLabel={`${doc.label} unavailable`}
                              style={{
                                width: 120,
                                height: 120,
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid #ddd",
                              }}
                            />
                          </button>
                        )
                      ) : (
                        <span>N/A</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {preview.open && (
        <div
          className="modal"
          style={{
            display: "block",
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1050,
          }}
          onClick={() => setPreview({ open: false, url: "", label: "" })}
        >
          <div
            className="modal-dialog"
            style={{
              maxWidth: 550,
              margin: "8% auto",
              background: "#fff",
              borderRadius: 8,
              padding: 15,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h5>{preview.label}</h5>
            {isPdfDocument(preview.url) && isTrustedApiAssetUrl(preview.url) ? (
              <>
                <object
                  data={preview.url}
                  type="application/pdf"
                  aria-label={preview.label}
                  style={{ width: "100%", height: "65vh" }}
                >
                  <p>PDF preview is unavailable in this browser.</p>
                </object>
                <a href={preview.url} target="_blank" rel="noreferrer" className="d-inline-block mt-2">
                  Open PDF in a new tab
                </a>
              </>
            ) : isPdfDocument(preview.url) ? (
              <p>
                This external PDF cannot be embedded.{" "}
                <a href={preview.url} target="_blank" rel="noreferrer">Open it in a new tab</a>.
              </p>
            ) : (
              <SafeImage src={preview.url} alt={preview.label} style={{ width: "100%", maxHeight: "70vh", objectFit: "contain" }} />
            )}
          </div>
        </div>
      )}
    </main>
  );
};

export default DriverDetail;
