import mongoose from "mongoose";
import Driver from "../src/models/Driver.js";
import connectDB from "../src/connection.js";
import { loadEnv } from "../src/utils/loadEnv.js";

const dryRun = process.argv.includes("--dry-run");

const hasRequiredDocs = (driver) =>
  Boolean(
    (driver.licenseCarUrl || driver.carLicenseFrontUrl) &&
      (driver.licenseDriverUrl || driver.drivingLicenseFrontUrl) &&
      driver.profileImageUrl &&
      (driver.idDocumentUrl || driver.idProofFrontUrl) &&
      driver.passportCopyUrl
  );

export const reconcileWorkflowFields = (driver) => {
  const currentStatus = driver.status || "pending";
  let status = currentStatus;

  // Old releases sometimes only flipped isApproved. Preserve that approval
  // signal and infer completed only when the full legacy document set exists.
  if (driver.isApproved && !["approved", "completed"].includes(status)) {
    status = hasRequiredDocs(driver) ? "completed" : "approved";
  }

  const isApproved = ["approved", "completed"].includes(status);
  const pendingSince =
    status === "pending"
      ? driver.pendingSince || driver.basicRequestSubmittedAt || driver.createdAt || null
      : driver.pendingSince || null;

  const validProfileStatuses = new Set(["not_submitted", "pending", "approved", "rejected"]);
  const profileRequestStatus = validProfileStatuses.has(driver.profileRequestStatus)
    ? driver.profileRequestStatus
    : status === "completed"
      ? "approved"
      : "not_submitted";
  // Grandfather legacy completed drivers without fabricating stage-specific
  // dates or actors. Existing completedAt remains the only historical signal.
  const profileSubmittedAt = driver.profileSubmittedAt || null;
  const profileApprovedAt = driver.profileApprovedAt || null;

  return {
    status,
    isApproved,
    pendingSince,
    profileRequestStatus,
    profileSubmittedAt,
    profileApprovedAt,
  };
};

const run = async () => {
  loadEnv();
  await connectDB();

  // Use the raw collection so Mongoose defaults do not hide fields that are
  // physically missing from legacy documents.
  const drivers = await Driver.collection.find({}, {
    projection: {
      status: 1, isApproved: 1, pendingSince: 1, basicRequestSubmittedAt: 1,
      approvedAt: 1, completedAt: 1, createdAt: 1, updatedAt: 1,
      profileRequestStatus: 1, profileSubmittedAt: 1, profileApprovedAt: 1,
      licenseCarUrl: 1, carLicenseFrontUrl: 1, licenseDriverUrl: 1,
      drivingLicenseFrontUrl: 1, profileImageUrl: 1, idDocumentUrl: 1,
      idProofFrontUrl: 1, passportCopyUrl: 1,
    },
  }).toArray();
  let inconsistentBefore = 0;
  let inconsistentAfterDryRun = 0;
  let changed = 0;

  for (const driver of drivers) {
    const expected = reconcileWorkflowFields(driver);
    const wasConsistent =
      driver.isApproved === ["approved", "completed"].includes(driver.status);
    if (!wasConsistent) inconsistentBefore += 1;
    const willBeConsistent =
      expected.isApproved === ["approved", "completed"].includes(expected.status);
    if (!willBeConsistent) inconsistentAfterDryRun += 1;

    const needsChange =
      driver.status !== expected.status ||
      driver.isApproved !== expected.isApproved ||
      String(driver.pendingSince || "") !== String(expected.pendingSince || "") ||
      driver.profileRequestStatus !== expected.profileRequestStatus ||
      String(driver.profileSubmittedAt || "") !== String(expected.profileSubmittedAt || "") ||
      String(driver.profileApprovedAt || "") !== String(expected.profileApprovedAt || "");
    if (!needsChange) continue;

    changed += 1;
    if (!dryRun) {
      await Driver.updateOne(
        { _id: driver._id },
        {
          $set: {
            status: expected.status,
            isApproved: expected.isApproved,
            pendingSince: expected.pendingSince,
            profileRequestStatus: expected.profileRequestStatus,
            profileSubmittedAt: expected.profileSubmittedAt,
            profileApprovedAt: expected.profileApprovedAt,
          },
        },
        { runValidators: true }
      );
    }
  }

  const inconsistentAfter = dryRun
    ? inconsistentAfterDryRun
    : await Driver.countDocuments({
        $expr: {
          $ne: ["$isApproved", { $in: ["$status", ["approved", "completed"]] }],
        },
      });

  console.log(
    `Request workflow ${dryRun ? "dry-run" : "backfill"} complete. ` +
      `Scanned: ${drivers.length}, inconsistent before: ${inconsistentBefore}, ` +
      `would change/changed: ${changed}, inconsistent after: ${inconsistentAfter}`
  );
  console.log("Historical approvedBy and audit actors were intentionally not invented.");
  await mongoose.connection.close();
};

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  run().catch(async (error) => {
    console.error("Request workflow backfill failed:", error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
    process.exit(1);
  });
}
