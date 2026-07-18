import test from "node:test";
import assert from "node:assert/strict";

import {
  parseRequestListQuery,
} from "../src/controllers/adminRequestController.js";
import {
  actionForTransition,
  applyProfileRequestTransitionFields,
  applyRequestTransitionFields,
  isAllowedProfileRequestTransition,
  isAllowedRequestTransition,
} from "../src/services/driverRequestTransitionService.js";
import RequestAudit from "../src/models/RequestAudit.js";
import adminRoutes from "../src/routes/adminRoute.js";
import { reconcileWorkflowFields } from "../scripts/backfill-request-workflow.js";
import {
  ADMIN_REQUEST_DOCUMENTS,
  ADMIN_REQUEST_DRIVER_FIELDS,
  ADMIN_REQUEST_LOG_FIELDS,
  buildAdminRequestDetailsDto,
  getDocumentStorageValue,
  getSafeStoredDocumentFileName,
  mergeDriverWithLegacyLogs,
} from "../src/utils/adminRequestDetails.js";

const routeLayer = (path, method) =>
  adminRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods?.[method]);

test("approved request query validates and caps pagination", () => {
  const parsed = parseRequestListQuery({ page: "2", limit: "999", sortBy: "submittedAt", sortOrder: "asc" });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.filter.status, undefined);
  assert.equal(parsed.sort.basicRequestSubmittedAt, 1);
  assert.throws(() => parseRequestListQuery({ page: "0" }), /greater than zero/);
  assert.throws(() => parseRequestListQuery({ sortBy: "password" }), /Invalid sort field/);
  assert.throws(() => parseRequestListQuery({ approvedBy: "not-an-id" }), /Invalid responsible id/);
  assert.throws(() => parseRequestListQuery({ timezoneOffsetMinutes: "900" }), /Invalid timezone offset/);
});

test("request query escapes regular-expression search input", () => {
  const parsed = parseRequestListQuery({ search: "Jane.*" });
  assert.equal(parsed.filter.$or[0].firstName.test("Jane.*"), true);
  assert.equal(parsed.filter.$or[0].firstName.test("Jane-anything"), false);
});

test("request query supports deterministic periods and exact statuses", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");
  const parsed = parseRequestListQuery({ period: "today", status: "approved" }, now);
  assert.deepEqual(parsed.filter.status, { $in: ["approved", "completed"] });
  assert.equal(parsed.filter.approvedAt.$gte.toISOString(), "2026-07-17T00:00:00.000Z");
  assert.equal(parsed.filter.approvedAt.$lt.toISOString(), "2026-07-18T00:00:00.000Z");
  const pending = parseRequestListQuery({ period: "today", status: "pending" }, now);
  assert.equal(pending.filter.approvedAt, undefined);
  assert.equal(
    pending.filter.basicRequestSubmittedAt.$gte.toISOString(),
    "2026-07-17T00:00:00.000Z"
  );
  assert.throws(
    () => parseRequestListQuery({ from: "2026-07-18", to: "2026-07-17" }),
    /from must be before to/
  );
  const tunis = parseRequestListQuery(
    { period: "today", status: "approved", timezoneOffsetMinutes: "-60" },
    new Date("2026-07-17T00:30:00.000Z")
  );
  assert.equal(tunis.filter.approvedAt.$gte.toISOString(), "2026-07-16T23:00:00.000Z");
});

test("profile request query maps filters, dates, approver and sort to stage 2 fields", () => {
  const adminId = "69ca8d07657eef3a66dd6a12";
  const parsed = parseRequestListQuery({
    stage: "profile",
    status: "approved",
    approvedBy: adminId,
    from: "2026-07-01T00:00:00.000Z",
    sortBy: "submittedAt",
  });
  assert.equal(parsed.requestStage, "profile");
  assert.equal(parsed.filter.profileRequestStatus, "approved");
  assert.equal(String(parsed.filter.profileApprovedBy), adminId);
  assert.equal(parsed.filter.profileApprovedAt.$gte.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(parsed.sort.profileSubmittedAt, -1);
  assert.throws(
    () => parseRequestListQuery({ stage: "profile", status: "completed" }),
    /Invalid status filter/
  );
  assert.throws(() => parseRequestListQuery({ stage: "unknown" }), /Invalid request stage/);
});

test("workflow allows only explicit business transitions", () => {
  assert.equal(isAllowedRequestTransition("pending", "approved"), true);
  assert.equal(isAllowedRequestTransition("approved", "pending"), true);
  assert.equal(isAllowedRequestTransition("completed", "approved"), false);
  assert.equal(isAllowedRequestTransition("pending", "completed"), false);
  assert.equal(actionForTransition("approved", "pending"), "reopened");
});

test("transition field updates keep legacy approval state synchronized", () => {
  const now = new Date("2026-07-17T09:00:00.000Z");
  const driver = {
    firstName: "Jane",
    lastName: "Doe",
    basicRequestSubmittedAt: new Date("2026-07-16T09:00:00.000Z"),
    isApproved: false,
  };
  applyRequestTransitionFields(driver, "approved", now);
  assert.equal(driver.status, "approved");
  assert.equal(driver.isApproved, true);
  assert.equal(driver.approvedAt, now);
  assert.equal(driver.pendingSince, driver.basicRequestSubmittedAt);
  applyRequestTransitionFields(driver, "pending", now);
  assert.equal(driver.isApproved, false);
  assert.equal(driver.approvedAt, null);
  assert.equal(driver.pendingSince, now);
});

test("profile transitions are independent and preserve aggregate compatibility", () => {
  assert.equal(isAllowedProfileRequestTransition("not_submitted", "pending"), true);
  assert.equal(isAllowedProfileRequestTransition("pending", "approved"), true);
  assert.equal(isAllowedProfileRequestTransition("approved", "rejected"), false);
  assert.equal(actionForTransition("not_submitted", "pending", "profile"), "submitted");
  assert.equal(actionForTransition("rejected", "pending", "profile"), "resubmitted");

  const now = new Date("2026-07-18T10:00:00.000Z");
  const driver = { status: "approved", isApproved: true, isOnline: false };
  applyProfileRequestTransitionFields(driver, "pending", now);
  assert.equal(driver.status, "approved");
  assert.equal(driver.profileRequestStatus, "pending");
  assert.equal(driver.profileSubmittedAt, now);
  applyProfileRequestTransitionFields(driver, "approved", now);
  assert.equal(driver.status, "completed");
  assert.equal(driver.completedAt, now);
  applyProfileRequestTransitionFields(driver, "pending", now);
  assert.equal(driver.status, "approved");
  assert.equal(driver.completedAt, null);
  assert.equal(driver.isOnline, false);
});

test("workflow migration reconciles legacy approval flags without inventing actors", () => {
  const legacyApproved = reconcileWorkflowFields({
    status: "pending",
    isApproved: true,
    basicRequestSubmittedAt: new Date("2026-07-16T09:00:00.000Z"),
  });
  assert.equal(legacyApproved.status, "approved");
  assert.equal(legacyApproved.isApproved, true);

  const legacyMismatch = reconcileWorkflowFields({ status: "approved", isApproved: false });
  assert.equal(legacyMismatch.status, "approved");
  assert.equal(legacyMismatch.isApproved, true);

  const legacyCompleted = reconcileWorkflowFields({
    status: "completed",
    isApproved: true,
    completedAt: new Date("2026-07-17T10:00:00.000Z"),
  });
  assert.equal(legacyCompleted.profileRequestStatus, "approved");
  assert.equal(legacyCompleted.profileApprovedAt, null);
  assert.equal(legacyCompleted.profileSubmittedAt, null);

  const legacyWithUntrackedDocuments = reconcileWorkflowFields({
    status: "approved",
    isApproved: true,
    passportCopyUrl: "legacy.pdf",
  });
  assert.equal(legacyWithUntrackedDocuments.profileRequestStatus, "not_submitted");
});

test("request audit schema is immutable and registers mutation guards", () => {
  for (const path of ["requestId", "requestStage", "action", "oldStatus", "newStatus", "actorId", "occurredAt"]) {
    assert.equal(RequestAudit.schema.path(path).options.immutable, true);
  }
  assert.equal(RequestAudit.schema.s.hooks.hasHooks("deleteOne"), true);
  assert.equal(RequestAudit.schema.s.hooks.hasHooks("findOneAndUpdate"), true);
});

test("admin request endpoints require authentication and admin role", () => {
  for (const [path, method] of [
    ["/requests", "get"],
    ["/requests/:id", "get"],
    ["/requests/:id/documents/:documentKey", "get"],
    ["/requests/:id/approve", "patch"],
    ["/requests/:id/reopen", "patch"],
    ["/requests/:id/approve", "put"],
    ["/requests/:id/reopen", "put"],
    ["/requests/:id/history", "get"],
    ["/requests/:id/profile/approve", "patch"],
    ["/requests/:id/profile/reject", "patch"],
    ["/requests/:id/profile/reopen", "patch"],
    ["/requests/:id/profile/approve", "put"],
    ["/requests/:id/profile/reject", "put"],
    ["/requests/:id/profile/reopen", "put"],
    ["/driver/:id/status", "put"],
  ]) {
    const layer = routeLayer(path, method);
    assert.ok(layer, `${method.toUpperCase()} ${path} should exist`);
    assert.deepEqual(layer.route.stack.slice(0, 2).map((handler) => handler.handle.name), [
      "requireSignIn",
      "isAdmin",
    ]);
  }
});

test("admin request projections use allowlists that exclude authentication secrets", () => {
  for (const projection of [ADMIN_REQUEST_DRIVER_FIELDS, ADMIN_REQUEST_LOG_FIELDS]) {
    const fields = new Set(projection.split(/\s+/));
    for (const secret of ["otpCode", "password", "token", "refreshToken", "secret"]) {
      assert.equal(fields.has(secret), false);
    }
  }
});

test("request details merge current driver data with newest non-empty legacy values", () => {
  const driver = {
    _id: "69ca8d07657eef3a66dd6a11",
    firstName: "Current",
    lastName: "Driver",
    carLicenseFrontUrl: "current-license.jpg",
    idProofFrontUrl: "",
    passportCopyUrl: "",
  };
  const logsNewestFirst = [
    {
      fullName: "Legacy name must not replace current names",
      idProofFrontUrl: "new-id.pdf",
      passportCopyUrl: "",
      otpCode: "should-never-be-copied",
    },
    {
      idProofFrontUrl: "old-id.pdf",
      passportCopyUrl: "passport.pdf",
    },
  ];

  const merged = mergeDriverWithLegacyLogs(driver, logsNewestFirst);
  assert.equal(merged.carLicenseFrontUrl, "current-license.jpg");
  assert.equal(merged.licenseCarUrl, "current-license.jpg");
  assert.equal(merged.idDocumentUrl, "new-id.pdf");
  assert.equal(merged.passportCopyUrl, "passport.pdf");
  assert.equal(merged.otpCode, undefined);
});

test("request detail DTO exposes normalized document routes without storage values or secrets", () => {
  const dto = buildAdminRequestDetailsDto({
    _id: "69ca8d07657eef3a66dd6a11",
    firstName: "Jane",
    lastName: "Doe",
    status: "approved",
    approvedBy: { _id: "69ca8d07657eef3a66dd6a12", fullName: "Admin", email: "admin@example.com", password: "hash" },
    idDocumentUrl: "https://old.example/api/users/get-image/private-id.pdf",
    otpCode: "9999",
    password: "hash",
  }, 1);

  assert.equal(dto.documents.length, Object.keys(ADMIN_REQUEST_DOCUMENTS).length);
  const identity = dto.documents.find((document) => document.key === "identityFront");
  assert.equal(identity.available, true);
  assert.equal(
    identity.viewUrl,
    "/api/admin/requests/69ca8d07657eef3a66dd6a11/documents/identityFront"
  );
  const serialized = JSON.stringify(dto);
  assert.doesNotMatch(serialized, /private-id\.pdf|9999|hash/);
  assert.equal(dto.documentSummary.includesLegacyData, true);
});

test("request detail DTO exposes both approval stages without conflating statuses", () => {
  const dto = buildAdminRequestDetailsDto({
    _id: "69ca8d07657eef3a66dd6a11",
    firstName: "Jane",
    lastName: "Doe",
    status: "completed",
    approvedAt: new Date("2026-07-17T08:00:00.000Z"),
    profileRequestStatus: "approved",
    profileSubmittedAt: new Date("2026-07-17T09:00:00.000Z"),
    profileApprovedAt: new Date("2026-07-17T10:00:00.000Z"),
    profileApprovedBy: {
      _id: "69ca8d07657eef3a66dd6a12",
      fullName: "Profile Admin",
      email: "profile@example.com",
    },
  });
  assert.equal(dto.status, "completed");
  assert.equal(dto.isFullyApproved, true);
  assert.equal(dto.stages.basic.status, "approved");
  assert.equal(dto.stages.profile.status, "approved");
  assert.equal(dto.profileApprovedBy.fullName, "Profile Admin");
});

test("document resolver uses an exact allowlist and rejects paths or external URLs", () => {
  assert.equal(
    getDocumentStorageValue({ idProofFrontUrl: "identity.pdf" }, "identityFront"),
    "identity.pdf"
  );
  assert.equal(getDocumentStorageValue({ idProofFrontUrl: "identity.pdf" }, "unknown"), null);
  assert.equal(getSafeStoredDocumentFileName("identity.pdf"), "identity.pdf");
  assert.equal(
    getSafeStoredDocumentFileName("https://legacy.test/api/users/get-image/identity.pdf"),
    "identity.pdf"
  );
  assert.equal(getSafeStoredDocumentFileName("https://evil.test/identity.pdf"), null);
  assert.equal(
    getSafeStoredDocumentFileName(
      "https://legacy.test/api/users/get-image/..%2Fother-request.pdf"
    ),
    null
  );
  assert.equal(getSafeStoredDocumentFileName("../identity.pdf"), null);
  assert.equal(getSafeStoredDocumentFileName("..%2Fidentity.pdf"), null);
  assert.equal(getSafeStoredDocumentFileName("C:\\private\\identity.pdf"), null);
  assert.equal(getSafeStoredDocumentFileName("identity.svg"), null);
});
