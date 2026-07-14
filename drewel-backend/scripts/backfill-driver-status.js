import mongoose from "mongoose";
import Driver from "../src/models/Driver.js";

const uri =
  process.env.MONGO_URI || process.env.MONGODB_URI || "";
const dbName = process.env.MONGO_DB_NAME || "drewel-app";

const hasRequiredDocs = (driver) =>
  Boolean(
    (driver.licenseCarUrl || driver.carLicenseFrontUrl) &&
      (driver.licenseDriverUrl || driver.drivingLicenseFrontUrl) &&
      driver.profileImageUrl &&
      (driver.idDocumentUrl || driver.idProofFrontUrl) &&
      driver.passportCopyUrl
  );

const decideStatus = (driver) => {
  if (driver.status) {
    return driver.status;
  }
  if (driver.isApproved && hasRequiredDocs(driver)) {
    return "completed";
  }
  if (driver.isApproved) {
    return "approved";
  }
  return "pending";
};

const syncNames = (driver) => {
  if (!driver.firstName || !driver.lastName) {
    const fullName = String(driver.fullName || "").trim();
    if (fullName) {
      const parts = fullName.split(/\s+/);
      if (!driver.firstName) driver.firstName = parts[0] ?? "";
      if (!driver.lastName) driver.lastName = parts.slice(1).join(" ");
    }
  }
  driver.fullName = [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim();
};

const run = async () => {
  if (!uri) {
    throw new Error(
      "Missing MongoDB connection string. Set MONGO_URI (or MONGODB_URI) before running this script."
    );
  }
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 30000 });
  const drivers = await Driver.find({});
  let updatedCount = 0;

  for (const driver of drivers) {
    const previousStatus = driver.status;
    const nextStatus = decideStatus(driver);
    driver.status = nextStatus;

    if (!driver.basicRequestSubmittedAt) {
      driver.basicRequestSubmittedAt = driver.createdAt;
    }
    if ((nextStatus === "approved" || nextStatus === "completed") && !driver.approvedAt) {
      driver.approvedAt = driver.updatedAt || new Date();
    }
    if (nextStatus === "completed" && !driver.completedAt) {
      driver.completedAt = driver.updatedAt || new Date();
    }
    if (nextStatus !== "rejected") {
      driver.rejectionReason = driver.rejectionReason || "";
    }

    driver.isApproved = nextStatus === "approved" || nextStatus === "completed";
    syncNames(driver);

    if (
      previousStatus !== driver.status ||
      !driver.basicRequestSubmittedAt ||
      (driver.status === "approved" && !driver.approvedAt) ||
      (driver.status === "completed" && !driver.completedAt)
    ) {
      updatedCount += 1;
    }

    await driver.save();
  }

  console.log(`Backfill complete. Total drivers: ${drivers.length}, updated: ${updatedCount}`);
  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error("Backfill failed:", error);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  process.exit(1);
});
