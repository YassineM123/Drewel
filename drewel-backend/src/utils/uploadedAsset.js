import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { deleteS3Object, isS3StorageEnabled, makeS3Key } from "./s3Storage.js";

const bannerDestination = "public/banner-images";
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const resolveBackendPath = (value) =>
  path.isAbsolute(value) ? value : path.join(backendRoot, value);

const safeFileName = (value = "") => {
  try {
    const parsed = new URL(value, "http://localhost");
    return path.basename(decodeURIComponent(parsed.pathname));
  } catch {
    return path.basename(String(value));
  }
};

const removeLocalFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(resolveBackendPath(filePath));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
};

export const getUploadedFileMetadata = (file) => ({
  imageFileName: file.filename,
  imageStorage: file.storage || (isS3StorageEnabled() ? "s3" : "local"),
  imageKey: file.key || null,
});

export const removeUploadedFile = async (file) => {
  if (!file) return;

  if (file.storage === "s3" || file.key) {
    await deleteS3Object(file.key || makeS3Key(bannerDestination, file.filename));
    return;
  }

  await removeLocalFile(file.path || path.join(bannerDestination, file.filename));
};

// Metadata is present on new records. The URL fallback keeps records created by
// older releases removable without requiring a data migration.
export const removeBannerAsset = async (banner) => {
  const fileName = banner?.imageFileName || safeFileName(banner?.imageUrl);
  if (!fileName) return;

  if (banner?.imageStorage === "s3") {
    await deleteS3Object(banner.imageKey || makeS3Key(bannerDestination, fileName));
    return;
  }

  if (banner?.imageStorage === "local") {
    await removeLocalFile(path.join(bannerDestination, fileName));
    return;
  }

  // Legacy records did not store their driver. Use the active driver, which is
  // where their get-image URL is currently resolved from as well.
  if (isS3StorageEnabled()) {
    await deleteS3Object(makeS3Key(bannerDestination, fileName));
  } else {
    await removeLocalFile(path.join(bannerDestination, fileName));
  }
};
