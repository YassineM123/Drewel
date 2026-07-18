import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import Admin from "../models/Admin.js";
import Driver from "../models/Driver.js";
import RequestAudit from "../models/RequestAudit.js";
import { serveUploadedFile } from "../utils/fileServing.js";
import {
  ADMIN_REQUEST_DOCUMENTS,
  getDocumentStorageValue,
  getSafeStoredDocumentFileName,
  resolveAdminRequestDetails,
} from "../utils/adminRequestDetails.js";
import {
  DRIVER_STATUSES,
  PROFILE_REQUEST_STATUSES,
  RequestTransitionError,
  transitionDriverRequest,
} from "../services/driverRequestTransitionService.js";

const SORT_FIELDS = {
  submittedAt: "basicRequestSubmittedAt",
  basicRequestSubmittedAt: "basicRequestSubmittedAt",
  approvedAt: "approvedAt",
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const httpError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const parsePositiveInteger = (value, fallback, maximum) => {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(String(value))) throw httpError("Pagination values must be integers");
  const parsed = Number(value);
  if (parsed < 1) throw httpError("Pagination values must be greater than zero");
  return Math.min(parsed, maximum);
};

const parseDate = (value, label) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw httpError(`${label} must be a valid ISO date`);
  return parsed;
};

export const parseRequestListQuery = (query = {}, now = new Date()) => {
  const requestStage = String(query.stage || "basic").trim().toLowerCase();
  if (!["basic", "profile"].includes(requestStage)) {
    throw httpError("Invalid request stage");
  }
  const page = parsePositiveInteger(query.page, 1, 100000);
  const limit = parsePositiveInteger(query.limit, 20, 100);
  const timezoneOffsetMinutes = Number(query.timezoneOffsetMinutes || 0);
  if (!Number.isInteger(timezoneOffsetMinutes) || Math.abs(timezoneOffsetMinutes) > 840) {
    throw httpError("Invalid timezone offset");
  }
  const search = String(query.search || "").trim();
  if (search.length > 100) throw httpError("search must not exceed 100 characters");

  const requestType = String(query.type || query.requestType || "").trim();
  if (requestType && requestType !== "driver_verification") {
    throw httpError("Invalid request type");
  }

  const status = String(query.status || "").trim().toLowerCase();
  const allowedStatuses = requestStage === "profile" ? PROFILE_REQUEST_STATUSES : DRIVER_STATUSES;
  if (status && status !== "all" && !allowedStatuses.includes(status)) {
    throw httpError("Invalid status filter");
  }

  const approvedBy = String(query.approvedBy || query.responsible || "").trim();
  if (approvedBy && !mongoose.isValidObjectId(approvedBy)) {
    throw httpError("Invalid responsible id");
  }

  const sortKey = String(query.sortBy || "approvedAt");
  if (!SORT_FIELDS[sortKey]) throw httpError("Invalid sort field");
  const sortOrder = String(query.sortOrder || "desc").toLowerCase();
  if (!['asc', 'desc'].includes(sortOrder)) throw httpError("Invalid sort order");

  let from = parseDate(query.from || query.dateFrom, "from");
  let to = parseDate(query.to || query.dateTo, "to");
  const period = String(query.period || "all").toLowerCase();
  if (!['all', 'today', '7d', '30d', 'custom'].includes(period)) {
    throw httpError("Invalid period filter");
  }
  if (period === "today") {
    const localNow = new Date(now.getTime() - timezoneOffsetMinutes * 60000);
    from = new Date(
      Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) +
        timezoneOffsetMinutes * 60000
    );
    to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);
  } else if (period === "7d" || period === "30d") {
    const days = period === "7d" ? 7 : 30;
    to = now;
    from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  if (from && to && from > to) throw httpError("from must be before to");

  const filter = {};
  // No status means All Requests. Approved screens must ask explicitly for
  // approved (or completed), while status=all is an equivalent explicit form.
  const statusField = requestStage === "profile" ? "profileRequestStatus" : "status";
  const approvedByField = requestStage === "profile" ? "profileApprovedBy" : "approvedBy";
  if (status && status !== "all") {
    filter[statusField] = requestStage === "basic" && status === "approved"
      ? { $in: ["approved", "completed"] }
      : status;
  }
  if (approvedBy) filter[approvedByField] = new mongoose.Types.ObjectId(approvedBy);
  const dateField = ["approved", "completed"].includes(status)
    ? (requestStage === "profile" ? "profileApprovedAt" : "approvedAt")
    : (requestStage === "profile" ? "profileSubmittedAt" : "basicRequestSubmittedAt");
  if (from || to) {
    filter[dateField] = {};
    if (from) filter[dateField].$gte = from;
    if (to) filter[dateField].$lt = to;
  }
  if (search) {
    if (mongoose.isValidObjectId(search)) {
      filter._id = new mongoose.Types.ObjectId(search);
    } else {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ firstName: regex }, { lastName: regex }, { fullName: regex }];
    }
  }

  return {
    page,
    limit,
    filter,
    dateRange: { from, to },
    timezoneOffsetMinutes,
    requestStage,
    sort: {
      [requestStage === "profile"
        ? (sortKey === "approvedAt" ? "profileApprovedAt" : "profileSubmittedAt")
        : SORT_FIELDS[sortKey]]: sortOrder === "asc" ? 1 : -1,
      _id: 1,
    },
  };
};

const actorFromRequest = (req) => ({
  _id: req.admin?._id || req.user?._id,
  fullName: req.admin?.fullName || "",
  email: req.admin?.email || "",
  actorType: "admin",
});

const sendControllerError = (res, error, fallback) => {
  const statusCode = error.statusCode || (error instanceof RequestTransitionError ? error.statusCode : 500);
  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? fallback : error.message,
    ...(error.code ? { code: error.code } : {}),
  });
};

export const getAdminRequests = async (req, res) => {
  try {
    const { page, limit, filter, sort, dateRange, timezoneOffsetMinutes, requestStage } =
      parseRequestListQuery(req.query);
    const isProfileStage = requestStage === "profile";
    const statusField = isProfileStage ? "profileRequestStatus" : "status";
    const submittedAtField = isProfileStage ? "profileSubmittedAt" : "basicRequestSubmittedAt";
    const approvedAtField = isProfileStage ? "profileApprovedAt" : "approvedAt";
    const approvedByField = isProfileStage ? "profileApprovedBy" : "approvedBy";
    const now = new Date();
    const localNow = new Date(now.getTime() - timezoneOffsetMinutes * 60000);
    const startOfToday = new Date(
      Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) +
        timezoneOffsetMinutes * 60000
    );
    const endOfToday = new Date(startOfToday);
    endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

    const publicFields = [
      "firstName", "lastName", "fullName", "vehicleType", "status",
      "basicRequestSubmittedAt", "approvedAt", "completedAt", "approvedBy",
      "profileRequestStatus", "profileSubmittedAt", "profileApprovedAt",
      "profileApprovedBy", "profileRejectionReason",
    ].join(" ");

    const kpiFilter = {
      ...filter,
      [statusField]: isProfileStage ? "approved" : { $in: ["approved", "completed"] },
    };
    delete kpiFilter[submittedAtField];
    if (dateRange.from || dateRange.to) {
      kpiFilter[approvedAtField] = {};
      if (dateRange.from) kpiFilter[approvedAtField].$gte = dateRange.from;
      if (dateRange.to) kpiFilter[approvedAtField].$lt = dateRange.to;
    }
    const todayLowerBound = dateRange.from && dateRange.from > startOfToday
      ? dateRange.from
      : startOfToday;
    const todayUpperBound = dateRange.to && dateRange.to < endOfToday
      ? dateRange.to
      : endOfToday;
    const approvedTodayFilter = {
      ...kpiFilter,
      [approvedAtField]: { $gte: todayLowerBound, $lt: todayUpperBound },
    };

    const [requests, total, totalApproved, approvedToday, completed, averageRows, responsibleIds] =
      await Promise.all([
        Driver.find(filter)
          .select(publicFields)
          .populate(approvedByField, "fullName email")
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Driver.countDocuments(filter),
        Driver.countDocuments(kpiFilter),
        todayLowerBound < todayUpperBound ? Driver.countDocuments(approvedTodayFilter) : 0,
        Driver.countDocuments({ ...kpiFilter, status: "completed" }),
        Driver.aggregate([
          {
            $match: {
              ...kpiFilter,
              [approvedAtField]: { ...(kpiFilter[approvedAtField] || {}), $type: "date" },
            },
          },
          {
            $project: {
              duration: {
                $subtract: [
                  `$${approvedAtField}`,
                  isProfileStage
                    ? { $ifNull: ["$profileSubmittedAt", "$createdAt"] }
                    : { $ifNull: ["$pendingSince", { $ifNull: ["$basicRequestSubmittedAt", "$createdAt"] }] },
                ],
              },
            },
          },
          { $match: { duration: { $gte: 0 } } },
          { $group: { _id: null, average: { $avg: "$duration" } } },
        ]),
        Driver.distinct(approvedByField, {
          [statusField]: isProfileStage ? "approved" : { $in: ["approved", "completed"] },
          [approvedByField]: { $ne: null },
        }),
      ]);

    const responsibles = responsibleIds.length
      ? await Admin.find({ _id: { $in: responsibleIds } }).select("fullName email").sort({ fullName: 1 }).lean()
      : [];
    const normalizedRequests = requests.map((request) => {
      const responsible = request[approvedByField];
      return {
      ...request,
      requestId: String(request._id),
      requestCode: String(request._id),
      requestType: "driver_verification",
      requestStage,
      type: "driver_verification",
      requesterName: request.fullName || [request.firstName, request.lastName].filter(Boolean).join(" ").trim(),
      overallStatus: request.status,
      basicRequestStatus: request.status === "completed" ? "approved" : request.status,
      stageStatus:
        requestStage === "basic" && request.status === "completed"
          ? "approved"
          : request[statusField],
      submittedAt: request[submittedAtField],
      approvedAt: request[approvedAtField],
      approvedBy: responsible || null,
      approvedByName: responsible?.fullName || "",
      rejectionReason: isProfileStage ? request.profileRejectionReason || "" : request.rejectionReason || "",
    };
    });
    const payload = {
      requests: normalizedRequests,
      requestStage,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      kpis: {
        totalApproved,
        approvedToday,
        completed,
        averageApprovalTimeMs: Math.round(averageRows[0]?.average || 0),
      },
      filterOptions: {
        types: total > 0 ? [{ value: "driver_verification", label: "Driver verification" }] : [],
        responsibles,
      },
    };
    return res.status(200).json({
      success: true,
      message: "Requests fetched successfully",
      ...payload,
      data: payload,
    });
  } catch (error) {
    return sendControllerError(res, error, "Failed to fetch requests");
  }
};

export const approveAdminRequest = async (req, res) => {
  try {
    const driver = await transitionDriverRequest({
      requestId: req.params.id,
      newStatus: "approved",
      actor: actorFromRequest(req),
      reason: req.body?.reason || "",
    });
    return res.status(200).json({ success: true, message: "Request approved successfully", driver });
  } catch (error) {
    return sendControllerError(res, error, "Failed to approve request");
  }
};

export const reopenAdminRequest = async (req, res) => {
  try {
    if (req.body?.confirmed !== true) throw httpError("Reopening must be explicitly confirmed");
    const reason = String(req.body?.reason || "").trim();
    if (reason.length > 1000) throw httpError("reason must not exceed 1000 characters");
    const driver = await transitionDriverRequest({
      requestId: req.params.id,
      newStatus: "pending",
      actor: actorFromRequest(req),
      reason,
    });
    return res.status(200).json({ success: true, message: "Request reopened successfully", driver });
  } catch (error) {
    return sendControllerError(res, error, "Failed to reopen request");
  }
};

const transitionProfileRequest = async (req, res, newStatus) => {
  try {
    if (newStatus === "pending" && req.body?.confirmed !== true) {
      throw httpError("Reopening must be explicitly confirmed");
    }
    const reason = String(req.body?.rejection_reason || req.body?.reason || "").trim();
    if (reason.length > 1000) throw httpError("reason must not exceed 1000 characters");
    if (newStatus === "rejected" && !reason) {
      throw httpError("A rejection reason is required");
    }
    const driver = await transitionDriverRequest({
      requestId: req.params.id,
      newStatus,
      requestStage: "profile",
      actor: actorFromRequest(req),
      reason,
      mutateDriver: async (currentDriver) => {
        if (["pending", "rejected"].includes(newStatus)) currentDriver.isOnline = false;
      },
    });
    const messages = {
      approved: "Profile request approved successfully",
      rejected: "Profile request rejected successfully",
      pending: "Profile request reopened successfully",
    };
    return res.status(200).json({ success: true, message: messages[newStatus], driver });
  } catch (error) {
    return sendControllerError(res, error, "Failed to update profile request");
  }
};

export const approveAdminProfileRequest = (req, res) =>
  transitionProfileRequest(req, res, "approved");

export const rejectAdminProfileRequest = (req, res) =>
  transitionProfileRequest(req, res, "rejected");

export const reopenAdminProfileRequest = (req, res) =>
  transitionProfileRequest(req, res, "pending");

export const getAdminRequestHistory = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError("Invalid request id");
    const exists = await Driver.exists({ _id: req.params.id });
    if (!exists) throw httpError("Request not found", 404);
    const requestStage = String(req.query.stage || "").trim().toLowerCase();
    if (requestStage && !["basic", "profile"].includes(requestStage)) {
      throw httpError("Invalid request stage");
    }
    const history = await RequestAudit.find({
      requestId: req.params.id,
      ...(requestStage ? { requestStage } : {}),
    })
      .sort({ occurredAt: -1, _id: -1 })
      .lean();
    return res.status(200).json({
      success: true,
      message: "Request history fetched successfully",
      history,
      data: { history },
    });
  } catch (error) {
    return sendControllerError(res, error, "Failed to fetch request history");
  }
};

export const getAdminRequestDetails = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError("Invalid request id");
    const details = await resolveAdminRequestDetails(req.params.id);
    if (!details) throw httpError("Request not found", 404);
    const normalized = details.dto;
    return res.status(200).json({
      success: true,
      message: "Request details fetched successfully",
      request: normalized,
      driver: normalized,
      data: normalized,
    });
  } catch (error) {
    return sendControllerError(res, error, "Failed to fetch request details");
  }
};

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const getAdminRequestDocument = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw httpError("Invalid request id");
    const documentKey = String(req.params.documentKey || "");
    if (!Object.hasOwn(ADMIN_REQUEST_DOCUMENTS, documentKey)) {
      throw httpError("Invalid document key");
    }

    const details = await resolveAdminRequestDetails(req.params.id);
    if (!details) throw httpError("Request not found", 404);
    const storedValue = getDocumentStorageValue(details.merged, documentKey);
    if (!storedValue) throw httpError("Document not found", 404);

    const fileName = getSafeStoredDocumentFileName(storedValue);
    if (!fileName) {
      throw httpError(
        "This legacy document uses unsupported external storage and cannot be served safely",
        409
      );
    }

    await serveUploadedFile({
      res,
      fileName,
      localPaths: [
        path.join(backendRoot, "public", "user-images", fileName),
        path.join(backendRoot, "public", "driver-documents", fileName),
      ],
      s3Prefixes: ["user-images", "driver-documents"],
      disposition: String(req.query.download || "") === "1" ? "attachment" : "inline",
      cacheControl: "no-store",
    });
  } catch (error) {
    if (res.headersSent) return;
    sendControllerError(res, error, "Failed to fetch request document");
  }
};

export const updateAdminRequestStatus = async (req, res) => {
  try {
    const status = String(req.body?.status || "").toLowerCase();
    if (!DRIVER_STATUSES.includes(status)) throw httpError("Invalid status value");
    if (status === "pending" && req.body?.confirmed !== true) {
      throw httpError("Reopening must be explicitly confirmed");
    }
    const reason = String(req.body?.rejection_reason || req.body?.reason || "").trim();
    if (reason.length > 1000) throw httpError("reason must not exceed 1000 characters");
    const driver = await transitionDriverRequest({
      requestId: req.params.id,
      newStatus: status,
      actor: actorFromRequest(req),
      reason,
    });
    return res.status(200).json({ success: true, message: "Driver status updated successfully", driver });
  } catch (error) {
    return sendControllerError(res, error, "Failed to update driver status");
  }
};
