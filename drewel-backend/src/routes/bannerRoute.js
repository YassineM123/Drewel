import express from "express";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";
import {
  addBanner,
  deleteBanner,
  getAllBanners,
  getBannerById,
  getBannerImage,
  updateBanner,
} from "../controllers/bannerController.js";
import { generateStorage } from "../utils/multerFunction.js";
import multer from "multer";
import mongoose from "mongoose";

const destination = "public/banner-images";
const storage = generateStorage(destination);
const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      const error = new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
      error.statusCode = 415;
      return callback(error);
    }
    callback(null, true);
  },
});
const router = express.Router();

const validateBannerId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid banner id" });
  }
  next();
};

const uploadBannerImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    const isTooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
    const status = isTooLarge ? 413 : error.statusCode || 400;
    const message = isTooLarge ? "Banner image must not exceed 5 MB" : error.message;
    return res.status(status).json({ success: false, message });
  });
};

router.post("/add-banner", requireSignIn, isAdmin, uploadBannerImage, addBanner);

router.get("/get-all", getAllBanners);
router.put(
  "/update/:id",
  requireSignIn,
  isAdmin,
  validateBannerId,
  uploadBannerImage,
  updateBanner
);
router.delete("/delete/:id", requireSignIn, isAdmin, validateBannerId, deleteBanner);
router.get("/get-image/:fileName", getBannerImage);
router.get("/:id", validateBannerId, getBannerById);
export default router;
