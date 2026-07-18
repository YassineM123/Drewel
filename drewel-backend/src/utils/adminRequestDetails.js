import path from "path";
import Driver from "../models/Driver.js";
import DriverLogs from "../models/Driverlogs.js";
import { getPublicAssetReference } from "./publicAssets.js";

export const ADMIN_REQUEST_DRIVER_FIELDS = [
  "_id", "countryCode", "phone", "whatsappNumber", "firstName", "lastName",
  "fullName", "email", "contractNumber", "licenseCompany", "city", "address",
  "vehicleType", "status", "isApproved", "isRestricted",
  "isUpdate", "basicRequestSubmittedAt", "approvedAt", "approvedBy",
  "pendingSince", "completedAt", "rejectionReason", "createdAt", "updatedAt",
  "profileRequestStatus", "profileSubmittedAt", "profileApprovedAt",
  "profileApprovedBy", "profileRejectionReason",
  "licenseCompanyUrl", "licenseCarUrl", "licenseDriverUrl", "idDocumentUrl",
  "carLicenseFrontUrl", "carLicenseBackUrl", "drivingLicenseFrontUrl",
  "drivingLicenseBackUrl", "idProofFrontUrl", "idProofBackUrl",
  "passportCopyUrl", "profileImageUrl",
].join(" ");

export const ADMIN_REQUEST_LOG_FIELDS = [
  "_id", "driverId", "countryCode", "phone", "whatsappNumber", "fullName",
  "email", "city", "address", "vehicleType", "updatedAt",
  "licenseCompanyUrl", "carLicenseFrontUrl", "carLicenseBackUrl",
  "drivingLicenseFrontUrl", "drivingLicenseBackUrl", "idProofFrontUrl",
  "idProofBackUrl", "passportCopyUrl", "profileImageUrl",
].join(" ");

const FALLBACK_FIELDS = [
  "countryCode", "phone", "whatsappNumber", "fullName", "email", "city",
  "address", "vehicleType", "licenseCompanyUrl",
  "carLicenseFrontUrl", "carLicenseBackUrl", "drivingLicenseFrontUrl",
  "drivingLicenseBackUrl", "idProofFrontUrl", "idProofBackUrl",
  "passportCopyUrl", "profileImageUrl",
];

export const ADMIN_REQUEST_DOCUMENTS = Object.freeze({
  companyLicense: {
    label: "Company license",
    fields: ["licenseCompanyUrl"],
  },
  vehicleLicenseFront: {
    label: "Vehicle license (front)",
    fields: ["licenseCarUrl", "carLicenseFrontUrl"],
  },
  vehicleLicenseBack: {
    label: "Vehicle license (back)",
    fields: ["carLicenseBackUrl"],
  },
  drivingLicenseFront: {
    label: "Driving license (front)",
    fields: ["licenseDriverUrl", "drivingLicenseFrontUrl"],
  },
  drivingLicenseBack: {
    label: "Driving license (back)",
    fields: ["drivingLicenseBackUrl"],
  },
  identityFront: {
    label: "Identity document (front)",
    fields: ["idDocumentUrl", "idProofFrontUrl"],
  },
  identityBack: {
    label: "Identity document (back)",
    fields: ["idProofBackUrl"],
  },
  passportCopy: {
    label: "Passport copy",
    fields: ["passportCopyUrl"],
  },
  profileImage: {
    label: "Profile image",
    fields: ["profileImageUrl"],
  },
});

const hasValue = (value) =>
  value !== undefined && value !== null && value !== "";

export const mergeDriverWithLegacyLogs = (driver, logs = []) => {
  const merged = { ...driver };
  for (const field of FALLBACK_FIELDS) {
    if (hasValue(merged[field])) continue;
    const legacy = logs.find((log) => hasValue(log?.[field]));
    if (legacy) merged[field] = legacy[field];
  }

  if (!hasValue(merged.licenseCarUrl)) {
    merged.licenseCarUrl = merged.carLicenseFrontUrl || "";
  }
  if (!hasValue(merged.licenseDriverUrl)) {
    merged.licenseDriverUrl = merged.drivingLicenseFrontUrl || "";
  }
  if (!hasValue(merged.idDocumentUrl)) {
    merged.idDocumentUrl = merged.idProofFrontUrl || "";
  }
  return merged;
};

export const getDocumentStorageValue = (merged, documentKey) => {
  const definition = ADMIN_REQUEST_DOCUMENTS[documentKey];
  if (!definition) return null;
  for (const field of definition.fields) {
    if (hasValue(merged?.[field])) return String(merged[field]).trim();
  }
  return null;
};

export const buildAdminRequestDocumentManifest = (requestId, merged) =>
  Object.entries(ADMIN_REQUEST_DOCUMENTS).map(([key, definition]) => {
    const available = Boolean(getDocumentStorageValue(merged, key));
    const route = `/api/admin/requests/${encodeURIComponent(String(requestId))}/documents/${encodeURIComponent(key)}`;
    return {
      key,
      label: definition.label,
      available,
      viewUrl: available ? route : null,
      downloadUrl: available ? `${route}?download=1` : null,
    };
  });

export const getSafeStoredDocumentFileName = (value) => {
  const storedValue = String(value || "").trim();
  if (!storedValue) return null;

  const reference = getPublicAssetReference(storedValue);
  if (reference) {
    if (/%(?:2f|5c)/i.test(storedValue)) return null;
    return reference.type === "user" &&
      /^[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif|pdf)$/i.test(reference.fileName)
      ? reference.fileName
      : null;
  }

  // Some early local records stored only Multer's generated basename. Do not
  // accept paths, URLs, query strings, or encoded path separators here.
  if (
    storedValue !== path.basename(storedValue) ||
    storedValue.includes("\\") ||
    /[%?#:/]/.test(storedValue)
  ) {
    return null;
  }
  return /^[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp|gif|pdf)$/i.test(storedValue)
    ? storedValue
    : null;
};

export const buildAdminRequestDetailsDto = (merged, legacyLogCount = 0) => {
  const requestId = String(merged._id);
  const requesterName =
    merged.fullName || [merged.firstName, merged.lastName].filter(Boolean).join(" ").trim();
  const documents = buildAdminRequestDocumentManifest(requestId, merged);
  const profileStatus = merged.profileRequestStatus ||
    (merged.status === "completed" ? "approved" : "not_submitted");
  const basicStage = {
    status: merged.status === "completed" ? "approved" : merged.status || "pending",
    submittedAt: merged.basicRequestSubmittedAt || null,
    approvedAt: merged.approvedAt || null,
    approvedBy: merged.approvedBy
      ? {
          _id: String(merged.approvedBy._id || merged.approvedBy),
          fullName: merged.approvedBy.fullName || "",
          email: merged.approvedBy.email || "",
        }
      : null,
    rejectionReason: merged.rejectionReason || "",
  };
  const profileStage = {
    status: profileStatus,
    submittedAt: merged.profileSubmittedAt || null,
    approvedAt: merged.profileApprovedAt || null,
    approvedBy: merged.profileApprovedBy
      ? {
          _id: String(merged.profileApprovedBy._id || merged.profileApprovedBy),
          fullName: merged.profileApprovedBy.fullName || "",
          email: merged.profileApprovedBy.email || "",
        }
      : null,
    rejectionReason: merged.profileRejectionReason || "",
  };

  return {
    _id: requestId,
    requestId,
    requestCode: requestId,
    requestType: "driver_verification",
    type: "driver_verification",
    requesterName,
    firstName: merged.firstName || "",
    lastName: merged.lastName || "",
    fullName: requesterName,
    email: merged.email || "",
    phone: merged.phone || "",
    countryCode: merged.countryCode || "",
    whatsappNumber: merged.whatsappNumber || "",
    contractNumber: merged.contractNumber || "",
    licenseCompany: merged.licenseCompany || "",
    city: merged.city || "",
    address: merged.address || "",
    vehicleType: merged.vehicleType || "",
    status: merged.status || "pending",
    workflowStatus: merged.status || "pending",
    isFullyApproved: merged.status === "completed" && profileStatus === "approved",
    profileRequestStatus: profileStatus,
    profileSubmittedAt: merged.profileSubmittedAt || null,
    profileApprovedAt: merged.profileApprovedAt || null,
    profileApprovedBy: profileStage.approvedBy,
    profileRejectionReason: merged.profileRejectionReason || "",
    stages: { basic: basicStage, profile: profileStage },
    isApproved: Boolean(merged.isApproved),
    isRestricted: Boolean(merged.isRestricted),
    isUpdate: Boolean(merged.isUpdate),
    rejectionReason: merged.rejectionReason || "",
    submittedAt: merged.basicRequestSubmittedAt || null,
    basicRequestSubmittedAt: merged.basicRequestSubmittedAt || null,
    approvedAt: merged.approvedAt || null,
    pendingSince: merged.pendingSince || null,
    completedAt: merged.completedAt || null,
    createdAt: merged.createdAt || null,
    updatedAt: merged.updatedAt || null,
    approvedBy: merged.approvedBy
      ? {
          _id: String(merged.approvedBy._id || merged.approvedBy),
          fullName: merged.approvedBy.fullName || "",
          email: merged.approvedBy.email || "",
        }
      : null,
    approvedByName: merged.approvedBy?.fullName || "",
    documents,
    documentSummary: {
      available: documents.filter((document) => document.available).length,
      total: documents.length,
      includesLegacyData: legacyLogCount > 0,
    },
  };
};

export const resolveAdminRequestDetails = async (requestId) => {
  const driver = await Driver.findById(requestId)
    .select(ADMIN_REQUEST_DRIVER_FIELDS)
    .populate("approvedBy", "fullName email")
    .populate("profileApprovedBy", "fullName email")
    .lean();
  if (!driver) return null;

  // Query by ownership rather than trusting Driver.driverLogs. Older records
  // often omitted that optional reference, while driverId remained canonical.
  const logs = await DriverLogs.find({ driverId: driver._id })
    .select(ADMIN_REQUEST_LOG_FIELDS)
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
  const merged = mergeDriverWithLegacyLogs(driver, logs);
  return {
    merged,
    dto: buildAdminRequestDetailsDto(merged, logs.length),
    legacyLogCount: logs.length,
  };
};
