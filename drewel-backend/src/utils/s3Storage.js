import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import path from "path";

let client;

export const isS3StorageEnabled = () =>
  String(process.env.STORAGE_DRIVER || "").toLowerCase() === "s3";

export const getS3Bucket = () => {
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is required when STORAGE_DRIVER=s3");
  }
  return bucket;
};

export const getS3Region = () => process.env.AWS_REGION || "us-east-1";

export const getS3Client = () => {
  if (client) return client;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const credentials =
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined;

  client = new S3Client({
    region: getS3Region(),
    credentials,
  });

  return client;
};

export const getUploadPrefix = (destination = "") =>
  String(destination)
    .replace(/\\/g, "/")
    .replace(/^public\//, "")
    .replace(/^\/+|\/+$/g, "");

const SAFE_EXTENSIONS_BY_MIME = new Map([
  ["image/jpeg", ".jpg"], ["image/png", ".png"],
  ["image/webp", ".webp"], ["image/gif", ".gif"],
  ["application/pdf", ".pdf"],
]);

export const makeSafeFileName = (originalName = "upload", contentType = "") => {
  const originalExtension = path.extname(originalName || "");
  const extension = SAFE_EXTENSIONS_BY_MIME.get(contentType) || originalExtension;
  const baseName = path
    .basename(originalName || "upload", originalExtension)
    .replace(/[^a-zA-Z0-9-_]/g, "-");
  return `${Date.now()}-${baseName || "upload"}${extension}`;
};

export const makeS3Key = (destination, fileName) => {
  const prefix = getUploadPrefix(destination);
  return prefix ? `${prefix}/${fileName}` : fileName;
};

export const uploadStreamToS3 = async ({ destination, fileName, stream, contentType }) => {
  const bucket = getS3Bucket();
  const key = makeS3Key(destination, fileName);

  // Multer provides an unknown-length stream. Upload buffers it into known-size
  // parts before issuing S3 requests, avoiding an undefined decoded-length
  // header while retaining streaming/backpressure for larger route limits.
  const upload = new Upload({
    client: getS3Client(),
    leavePartsOnError: false,
    params: {
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: contentType || "application/octet-stream",
    },
  });

  await upload.done();

  return { bucket, key };
};

export const deleteS3Object = async (key) => {
  if (!key) return;

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
    })
  );
};

export const s3ObjectExists = async (key) => {
  try {
    await getS3Client().send(
      new HeadObjectCommand({ Bucket: getS3Bucket(), Key: key })
    );
    return true;
  } catch (error) {
    const notFound =
      error?.name === "NotFound" ||
      error?.name === "NoSuchKey" ||
      error?.$metadata?.httpStatusCode === 404;
    if (notFound) return false;
    throw error;
  }
};

export const getS3ObjectByFileName = async (prefixes, fileName) => {
  const safeFileName = path.basename(fileName || "");
  if (!safeFileName) return null;

  for (const prefix of prefixes) {
    const normalizedPrefix = getUploadPrefix(prefix);
    const key = normalizedPrefix ? `${normalizedPrefix}/${safeFileName}` : safeFileName;

    try {
      const object = await getS3Client().send(
        new GetObjectCommand({
          Bucket: getS3Bucket(),
          Key: key,
        })
      );
      return { key, object };
    } catch (error) {
      const notFound =
        error?.name === "NoSuchKey" ||
        error?.name === "NotFound" ||
        error?.$metadata?.httpStatusCode === 404;
      if (!notFound) throw error;
    }
  }

  return null;
};
