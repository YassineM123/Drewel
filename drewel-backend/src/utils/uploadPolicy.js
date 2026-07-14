import multer from "multer";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, "application/pdf"]);

export const createRestrictedUpload = ({ storage, allowPdf = false }) => {
  const allowed = allowPdf ? DOCUMENT_MIME_TYPES : IMAGE_MIME_TYPES;
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
      if (!allowed.has(file.mimetype)) {
        const error = new Error(
          allowPdf
            ? "Only JPEG, PNG, WebP, and PDF files are allowed"
            : "Only JPEG, PNG, and WebP images are allowed"
        );
        error.statusCode = 415;
        return callback(error);
      }
      callback(null, true);
    },
  });
};

export const handleRestrictedUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : error.statusCode || 400).json({
      success: false,
      message: tooLarge ? "Uploaded file must not exceed 5 MB" : error.message,
    });
  });
};

