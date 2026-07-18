import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import RequestAudit from "../models/RequestAudit.js";

export const DRIVER_STATUSES = ["pending", "approved", "rejected", "completed"];
export const PROFILE_REQUEST_STATUSES = ["not_submitted", "pending", "approved", "rejected"];
export const REQUEST_STAGES = ["basic", "profile"];

const TRANSITIONS = {
  pending: new Set(["approved", "rejected"]),
  approved: new Set(["pending", "completed"]),
  rejected: new Set(["pending", "approved"]),
  completed: new Set(["pending"]),
};

const PROFILE_TRANSITIONS = {
  not_submitted: new Set(["pending"]),
  pending: new Set(["approved", "rejected"]),
  approved: new Set(["pending"]),
  rejected: new Set(["pending"]),
};

export class RequestTransitionError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_TRANSITION") {
    super(message);
    this.name = "RequestTransitionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const isAllowedRequestTransition = (oldStatus, newStatus) =>
  Boolean(TRANSITIONS[oldStatus]?.has(newStatus));

export const isAllowedProfileRequestTransition = (oldStatus, newStatus) =>
  Boolean(PROFILE_TRANSITIONS[oldStatus]?.has(newStatus));

export const actionForTransition = (oldStatus, newStatus, requestStage = "basic") => {
  if (requestStage === "profile" && newStatus === "pending" && oldStatus === "not_submitted") {
    return "submitted";
  }
  if (requestStage === "profile" && newStatus === "pending" && oldStatus === "rejected") {
    return "resubmitted";
  }
  if (newStatus === "approved") return "approved";
  if (newStatus === "rejected") return "rejected";
  if (newStatus === "completed") return "completed";
  if (newStatus === "pending" && ["approved", "completed"].includes(oldStatus)) {
    return "reopened";
  }
  return "status_changed";
};

export const applyProfileRequestTransitionFields = (
  driver,
  newStatus,
  now = new Date()
) => {
  driver.profileRequestStatus = newStatus;
  if (newStatus === "pending") {
    driver.profileSubmittedAt = now;
    driver.profileApprovedAt = null;
    driver.profileApprovedBy = null;
    driver.profileRejectionReason = "";
    if (driver.status === "completed") driver.status = "approved";
    driver.completedAt = null;
    driver.isOnline = false;
  } else if (newStatus === "approved") {
    driver.profileApprovedAt = now;
    driver.profileRejectionReason = "";
    driver.status = "completed";
    driver.isApproved = true;
    driver.completedAt = now;
  } else if (newStatus === "rejected") {
    driver.profileApprovedAt = null;
    driver.profileApprovedBy = null;
    if (driver.status === "completed") driver.status = "approved";
    driver.completedAt = null;
    driver.isOnline = false;
  }
  return driver;
};

export const applyRequestTransitionFields = (driver, newStatus, now = new Date()) => {
  driver.status = newStatus;

  if (newStatus === "approved") {
    driver.isApproved = true;
    driver.approvedAt = now;
    driver.pendingSince ||= driver.basicRequestSubmittedAt || driver.createdAt || now;
    driver.rejectionReason = "";
  } else if (newStatus === "pending") {
    driver.isApproved = false;
    driver.approvedAt = null;
    driver.approvedBy = null;
    driver.completedAt = null;
    driver.pendingSince = now;
    driver.rejectionReason = "";
    driver.isOnline = false;
  } else if (newStatus === "rejected") {
    driver.isApproved = false;
    driver.approvedAt = null;
    driver.approvedBy = null;
    driver.isOnline = false;
  } else if (newStatus === "completed") {
    driver.isApproved = true;
    driver.approvedAt ||= now;
    driver.completedAt ||= now;
    driver.rejectionReason = "";
  }

  driver.fullName = [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim();
  return driver;
};

export const transitionDriverRequest = async ({
  requestId,
  newStatus,
  actor,
  reason = "",
  requestStage = "basic",
  mutateDriver,
}) => {
  const normalizedReason = String(reason || "").trim();
  if (normalizedReason.length > 1000) {
    throw new RequestTransitionError(
      "reason must not exceed 1000 characters",
      400,
      "INVALID_REASON"
    );
  }
  if (!mongoose.isValidObjectId(requestId)) {
    throw new RequestTransitionError("Invalid request id", 400, "INVALID_REQUEST_ID");
  }
  if (!REQUEST_STAGES.includes(requestStage)) {
    throw new RequestTransitionError("Invalid request stage", 400, "INVALID_REQUEST_STAGE");
  }
  const validStatuses = requestStage === "profile" ? PROFILE_REQUEST_STATUSES : DRIVER_STATUSES;
  if (!validStatuses.includes(newStatus)) {
    throw new RequestTransitionError("Invalid status value", 400, "INVALID_STATUS");
  }
  if (!actor?._id) {
    throw new RequestTransitionError("Authenticated actor is required", 401, "MISSING_ACTOR");
  }

  const session = await mongoose.startSession();
  let transitionedDriver;
  try {
    await session.withTransaction(async () => {
      const driver = await Driver.findById(requestId).session(session);
      if (!driver) {
        throw new RequestTransitionError("Request not found", 404, "REQUEST_NOT_FOUND");
      }

      const oldStatus = requestStage === "profile"
        ? driver.profileRequestStatus || "not_submitted"
        : driver.status || (driver.isApproved ? "approved" : "pending");
      if (
        requestStage === "profile" &&
        !(
          driver.status === "approved" ||
          (oldStatus === "approved" && newStatus === "pending" && driver.status === "completed")
        )
      ) {
        throw new RequestTransitionError(
          "Profile request actions require an approved basic request",
          409,
          "BASIC_REQUEST_NOT_APPROVED"
        );
      }
      const transitionAllowed = requestStage === "profile"
        ? isAllowedProfileRequestTransition(oldStatus, newStatus)
        : isAllowedRequestTransition(oldStatus, newStatus);
      if (!transitionAllowed) {
        throw new RequestTransitionError(
          `Cannot transition request from ${oldStatus} to ${newStatus}`,
          409,
          "STATUS_CONFLICT"
        );
      }

      const now = new Date();
      if (requestStage === "profile") {
        applyProfileRequestTransitionFields(driver, newStatus, now);
        if (newStatus === "approved") driver.profileApprovedBy = actor._id;
        if (newStatus === "rejected") driver.profileRejectionReason = normalizedReason;
      } else {
        applyRequestTransitionFields(driver, newStatus, now);
        if (newStatus === "approved") driver.approvedBy = actor._id;
        if (newStatus === "rejected") driver.rejectionReason = normalizedReason;
        if (newStatus === "approved" && driver.profileRequestStatus === "approved") {
          driver.status = "completed";
          driver.completedAt ||= driver.profileApprovedAt || now;
        }
      }
      if (mutateDriver) await mutateDriver(driver, { now, session });
      await driver.save({ session });

      await RequestAudit.create(
        [{
          requestId: driver._id,
          requestStage,
          action: actionForTransition(oldStatus, newStatus, requestStage),
          oldStatus,
          newStatus,
          actorId: actor._id,
          actorType: actor.actorType || "admin",
          actorName: actor.fullName || actor.name || "",
          actorEmail: actor.email || "",
          reason: normalizedReason,
          occurredAt: now,
        }],
        { session }
      );

      transitionedDriver = driver;
    });
    return transitionedDriver;
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set member or mongos")
    ) {
      throw new RequestTransitionError(
        "Auditable request transitions require MongoDB replica-set transaction support",
        503,
        "TRANSACTION_UNAVAILABLE"
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
