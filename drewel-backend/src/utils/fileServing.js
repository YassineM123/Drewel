import fs from "fs";
import path from "path";
import { getS3ObjectByFileName, isS3StorageEnabled } from "./s3Storage.js";

const SAFE_CONTENT_TYPES = new Map([
  [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".png", "image/png"], [".webp", "image/webp"],
  [".gif", "image/gif"], [".pdf", "application/pdf"],
]);

const getSafeContentType = (fileName) =>
  SAFE_CONTENT_TYPES.get(path.extname(fileName).toLowerCase());

const setContentHeaders = (res, fileName, contentType) => {
  const headerFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  res.setHeader("Content-Disposition", `inline; filename="${headerFileName}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", contentType);
};

export const serveUploadedFile = async ({
  res,
  fileName,
  localPaths = [],
  s3Prefixes = [],
}) => {
  const safeFileName = path.basename(fileName || "");
  if (!safeFileName) {
    res.status(400).send("File name is required");
    return;
  }
  const contentType = getSafeContentType(safeFileName);
  if (!contentType) {
    res.status(415).send("Unsupported file type");
    return;
  }

  if (isS3StorageEnabled()) {
    const s3File = await getS3ObjectByFileName(s3Prefixes, safeFileName);
    if (s3File?.object?.Body) {
      setContentHeaders(res, safeFileName, contentType);
      s3File.object.Body.pipe(res);
      return;
    }
  }

  const fileToServe = localPaths.find((candidate) => fs.existsSync(candidate));
  if (!fileToServe) {
    res.status(404).send("File not found");
    return;
  }

  setContentHeaders(res, safeFileName, contentType);
  res.sendFile(fileToServe);
};
