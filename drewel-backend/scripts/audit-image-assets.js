import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import connectDB from "../src/connection.js";
import Banner from "../src/models/Banner.js";
import Driver from "../src/models/Driver.js";
import DriverLogs from "../src/models/Driverlogs.js";
import User from "../src/models/User.js";
import { loadEnv } from "../src/utils/loadEnv.js";
import {
  getPublicAssetReference,
  validatePublicAssetConfig,
} from "../src/utils/publicAssets.js";
import {
  isS3StorageEnabled,
  makeS3Key,
  s3ObjectExists,
} from "../src/utils/s3Storage.js";

const DRIVER_IMAGE_FIELDS = [
  "licenseCompanyUrl", "licenseCarUrl", "licenseDriverUrl", "idDocumentUrl",
  "carLicenseFrontUrl", "carLicenseBackUrl", "drivingLicenseFrontUrl",
  "drivingLicenseBackUrl", "idProofFrontUrl", "idProofBackUrl",
  "passportCopyUrl", "profileImageUrl",
];
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = new Map();

const localExists = async (prefix, fileName) => {
  try {
    await fs.access(path.join(backendRoot, "public", prefix, fileName));
    return true;
  } catch {
    return false;
  }
};

const checkReference = (reference) => {
  const prefixes = reference.type === "banner"
    ? ["banner-images"]
    : ["user-images", "driver-documents"];
  const cacheKey = `${reference.type}:${reference.fileName}`;
  if (checks.has(cacheKey)) return checks.get(cacheKey);

  const check = (async () => {
    for (const prefix of prefixes) {
      const exists = isS3StorageEnabled()
        ? await s3ObjectExists(makeS3Key(prefix, reference.fileName))
        : await localExists(prefix, reference.fileName);
      if (exists) return { exists: true, prefix };
    }
    return { exists: false, prefixes };
  })();
  checks.set(cacheKey, check);
  return check;
};

const main = async () => {
  loadEnv();
  validatePublicAssetConfig();
  await connectDB();
  const [banners, drivers, driverLogs, users] = await Promise.all([
    Banner.find().select("imageUrl").lean(),
    Driver.find().select(DRIVER_IMAGE_FIELDS.join(" ")).lean(),
    DriverLogs.find().select(DRIVER_IMAGE_FIELDS.join(" ")).lean(),
    User.find().select("profilePicture").lean(),
  ]);

  const records = banners.map((item) => ({
    model: "Banner", id: item._id, field: "imageUrl", value: item.imageUrl,
  }));
  for (const item of drivers) {
    for (const field of DRIVER_IMAGE_FIELDS) {
      if (item[field]) records.push({ model: "Driver", id: item._id, field, value: item[field] });
    }
  }
  for (const item of driverLogs) {
    for (const field of DRIVER_IMAGE_FIELDS) {
      if (item[field]) {
        records.push({ model: "DriverLogs", id: item._id, field, value: item[field] });
      }
    }
  }
  for (const item of users) {
    if (item.profilePicture) {
      records.push({ model: "User", id: item._id, field: "profilePicture", value: item.profilePicture });
    }
  }

  let checked = 0;
  let external = 0;
  const missing = [];
  const invalid = [];
  for (const record of records) {
    const reference = getPublicAssetReference(record.value);
    if (!reference) {
      try {
        const url = new URL(record.value);
        if (url.protocol === "http:" || url.protocol === "https:") external += 1;
        else invalid.push(record);
      } catch {
        invalid.push(record);
      }
      continue;
    }
    checked += 1;
    const result = await checkReference(reference);
    if (!result.exists) {
      missing.push({ ...record, fileName: reference.fileName, prefixes: result.prefixes });
    }
  }

  console.log(`Storage driver: ${isS3StorageEnabled() ? "s3" : "local"}`);
  console.log(`Database references: ${records.length}`);
  console.log(`Managed assets checked: ${checked}`);
  console.log(`External assets skipped: ${external}`);
  console.log(`Invalid references: ${invalid.length}`);
  console.log(`MISSING MANAGED FILES: ${missing.length}`);
  for (const item of missing) {
    console.log(`MISSING ${item.model} ${item.id} ${item.field} [${item.prefixes.join(", ")}]`);
  }
  for (const item of invalid) {
    console.log(`INVALID ${item.model} ${item.id} ${item.field}`);
  }
  if (missing.length) {
    console.log("Missing files cannot be reconstructed by this tool; check old upload directories, buckets, and backups.");
  }
  if (missing.length || invalid.length) process.exitCode = 2;
};

main()
  .catch((error) => {
    console.error("Image asset audit failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
