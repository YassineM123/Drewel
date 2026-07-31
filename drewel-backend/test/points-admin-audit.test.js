import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import PointsAdminAudit from "../src/models/PointsAdminAudit.js";
import {
  paymentReferenceAuditFields,
  pointsAuditRequestContext,
} from "../src/services/pointsAdminAuditService.js";

const objectId = () => new mongoose.Types.ObjectId();

test("points admin audit masks and hashes payment references", () => {
  const fields = paymentReferenceAuditFields("PAYMENT-SECRET-1234");
  assert.notEqual(fields.paymentReferenceMasked, "PAYMENT-SECRET-1234");
  assert.match(fields.paymentReferenceMasked, /1234$/);
  assert.match(fields.paymentReferenceHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(paymentReferenceAuditFields(""), {
    paymentReferenceMasked: "",
    paymentReferenceHash: "",
  });
});

test("points admin audit request context bounds request metadata", () => {
  const context = pointsAuditRequestContext({
    id: "request-1",
    ip: "127.0.0.1",
    get: () => "test-agent",
    headers: {},
  });
  assert.deepEqual(context, {
    requestId: "request-1",
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  });
});

test("points admin audit validates immutable balance evidence", async () => {
  const audit = new PointsAdminAudit({
    action: "POINTS_CREDIT",
    adminId: objectId(),
    adminRole: "owner",
    driverId: objectId(),
    previousAvailableBalance: 100,
    newAvailableBalance: 120,
    pointsChange: 20,
    reason: "Verified purchase",
    idempotencyKey: "audit:test:credit:1",
  });
  await audit.validate();
  assert.equal(audit.createdAt, undefined);

  audit.pointsChange = 1.5;
  await assert.rejects(
    audit.validate(),
    /pointsChange must be a safe integer/
  );
});

test("points admin audit rejects balance evidence that does not reconcile", async () => {
  const audit = new PointsAdminAudit({
    action: "POINTS_DEBIT",
    adminId: objectId(),
    adminRole: "finance_admin",
    driverId: objectId(),
    previousAvailableBalance: 100,
    newAvailableBalance: 80,
    pointsChange: -10,
    reason: "Correction approved by finance",
    idempotencyKey: "audit:test:debit:1",
  });
  await assert.rejects(
    audit.validate(),
    /pointsChange must match the recorded balance difference/
  );
});
