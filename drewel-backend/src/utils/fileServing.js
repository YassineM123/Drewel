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

export const toStorageReadError = (error) => {
  const status = error?.$metadata?.httpStatusCode;
  const storageFailure =
    status === 403 ||
    ["AccessDenied", "ExpiredToken", "InvalidAccessKeyId", "CredentialsProviderError"]
      .includes(error?.name);
  if (!storageFailure) return error;

  return Object.assign(
    new Error("Document storage is temporarily unavailable. Please contact the system administrator."),
    {
      statusCode: 503,
      code: "DOCUMENT_STORAGE_UNAVAILABLE",
      cause: error,
    }
  );
};

const setContentHeaders = (
  res,
  fileName,
  contentType,
  { disposition = "inline", cacheControl } = {}
) => {
  const headerFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeDisposition = disposition === "attachment" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${safeDisposition}; filename="${headerFileName}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", contentType);
  if (cacheControl) res.setHeader("Cache-Control", cacheControl);
};

export const serveUploadedFile = async ({
  res,
  fileName,
  localPaths = [],
  s3Prefixes = [],
  disposition = "inline",
  cacheControl,
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

  let storageError;
  if (isS3StorageEnabled()) {
    let s3File;
    try {
      s3File = await getS3ObjectByFileName(s3Prefixes, safeFileName);
    } catch (error) {
      storageError = toStorageReadError(error);
    }
    if (s3File?.object?.Body) {
      setContentHeaders(res, safeFileName, contentType, { disposition, cacheControl });
      s3File.object.Body.pipe(res);
      return;
    }
  }

  const fileToServe = localPaths.find((candidate) => fs.existsSync(candidate));
  if (!fileToServe) {
    if (storageError) throw storageError;
    res.status(404).send("File not found");
    return;
  }

  setContentHeaders(res, safeFileName, contentType, { disposition, cacheControl });
  res.sendFile(fileToServe);
};
