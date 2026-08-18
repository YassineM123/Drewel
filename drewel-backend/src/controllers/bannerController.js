import Banner from "../models/Banner.js";
import ContentAudit from "../models/ContentAudit.js";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { serveUploadedFile } from "../utils/fileServing.js";
import {
  getUploadedFileMetadata,
  removeBannerAsset,
  removeUploadedFile,
} from "../utils/uploadedAsset.js";
import { buildPublicAssetUrl } from "../utils/publicAssets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLACEMENTS = ["home", "splash", "ride", "checkout", "promo"];

const getBannerFileName = (banner) => {
  if (banner?.imageFileName) return banner.imageFileName;
  try {
    return path.basename(decodeURIComponent(new URL(banner?.imageUrl).pathname));
  } catch {
    return path.basename(banner?.imageUrl || "");
  }
};

const serializeBanner = (req, banner) => {
  const value = banner.toJSON ? banner.toJSON() : { ...banner };
  const fileName = getBannerFileName(banner);
  if (fileName) {
    value.imageUrl = buildPublicAssetUrl(req, "/api/banner/get-image/", fileName);
  }
  return value;
};

const writeAudit = async (req, values) => {
  try {
    await ContentAudit.create({
      actorId: req.admin?._id || req.user?._id,
      actorName: req.admin?.fullName || req.admin?.name || "",
      actorEmail: req.admin?.email || "",
      ...values,
    });
  } catch (error) {
    console.error("Banner audit write failed", error.message);
  }
};

const toBoolean = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

/**
 * Reads and validates the editable banner metadata from a multipart or JSON
 * body. Image handling stays separate so the caller can decide whether a new
 * image was supplied.
 */
const readBannerMetadata = (body = {}) => {
  const values = {};

  if (body.title != null) {
    const title = String(body.title).trim();
    if (title.length > 120) {
      const error = new Error("Banner title must not exceed 120 characters");
      error.statusCode = 400;
      throw error;
    }
    values.title = title;
  }

  if (body.placement != null) {
    const placement = String(body.placement).trim();
    if (!PLACEMENTS.includes(placement)) {
      const error = new Error(`placement must be one of: ${PLACEMENTS.join(", ")}`);
      error.statusCode = 400;
      throw error;
    }
    values.placement = placement;
  }

  if (body.active != null) values.active = toBoolean(body.active);

  const parseDate = (value, label) => {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      const error = new Error(`${label} is invalid`);
      error.statusCode = 400;
      throw error;
    }
    return date;
  };

  if (body.startDate != null) values.startDate = parseDate(body.startDate, "startDate");
  if (body.endDate != null) values.endDate = parseDate(body.endDate, "endDate");

  if (values.startDate && values.endDate && values.startDate > values.endDate) {
    const error = new Error("startDate must not be after endDate");
    error.statusCode = 400;
    throw error;
  }

  return values;
};

export const addBanner = async (req, res) => {
  const file = req.file;
  let assetCommitted = false;
  try {
    if (!file) {
      return res
        .status(400)
        .send({ success: false, message: "Please provide image for banner" });
    }
    const metadata = readBannerMetadata(req.body || {});
    const imageUrl = buildPublicAssetUrl(req, "/api/banner/get-image/", file.filename);

    const banner = new Banner({ imageUrl, ...getUploadedFileMetadata(file), ...metadata });
    await banner.save();
    assetCommitted = true;

    try {
      await writeAudit(req, {
        entityType: "banner",
        entityId: String(banner._id),
        action: "created",
        changes: { title: metadata.title, placement: metadata.placement, active: metadata.active },
      });
    } catch (auditError) {
      // The content change itself succeeded; audit is best-effort.
      console.error("Banner create audit failed", auditError.message);
    }

    res.status(201).json({
      success: true,
      message: "Banner created",
      banner: serializeBanner(req, banner),
    });
  } catch (error) {
    if (!assetCommitted) {
      try {
        await removeUploadedFile(file);
      } catch (cleanupError) {
        console.error("Create Banner Cleanup Error:", cleanupError);
      }
    }
    console.error("Create Banner Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to create banner",
    });
  }
};

export const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      banners: banners.map((banner) => serializeBanner(req, banner)),
    });
  } catch (error) {
    console.error("Get Banners Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to fetch banners" });
  }
};

export const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid banner id" });
    }
    const banner = await Banner.findById(id);

    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }

    res.status(200).json({ success: true, banner: serializeBanner(req, banner) });
  } catch (error) {
    console.error("Get Banner Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to fetch banner" });
  }
};

export const updateBanner = async (req, res) => {
  const file = req.file;
  let assetCommitted = false;
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, message: "Please provide valid banner id" });
    }
    const existingBanner = await Banner.findById(id).select(
      "+imageFileName +imageStorage +imageKey"
    );
    if (!existingBanner) {
      await removeUploadedFile(file);
      return res.status(404).json({ success: false, message: "Banner not found" });
    }

    const metadata = readBannerMetadata(req.body || {});
    const updates = { ...metadata };
    if (file) {
      const imageUrl = buildPublicAssetUrl(req, "/api/banner/get-image/", file.filename);
      Object.assign(updates, { imageUrl, ...getUploadedFileMetadata(file) });
    }

    const banner = await Banner.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    if (!banner) {
      await removeUploadedFile(file);
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    assetCommitted = !!file;

    if (file) {
      try {
        await removeBannerAsset(existingBanner);
      } catch (cleanupError) {
        // The database already references the new image. Do not turn a successful
        // update into a client retry that could create another upload.
        console.error("Update Banner Old Asset Cleanup Error:", cleanupError);
      }
    }

    try {
      await writeAudit(req, {
        entityType: "banner",
        entityId: String(banner._id),
        action: "updated",
        changes: Object.fromEntries(
          Object.entries(updates).filter(([key]) => key !== "imageUrl")
        ),
      });
    } catch (auditError) {
      console.error("Banner update audit failed", auditError.message);
    }

    res.status(200).json({
      success: true,
      message: "Banner updated",
      banner: serializeBanner(req, banner),
    });
  } catch (error) {
    if (!assetCommitted && file) {
      try {
        await removeUploadedFile(file);
      } catch (cleanupError) {
        console.error("Update Banner New Asset Cleanup Error:", cleanupError);
      }
    }
    console.error("Update Banner Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to update banner",
    });
  }
};

export const toggleBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid banner id" });
    }
    const raw = req.body?.active;
    if (raw === undefined || raw === null || raw === "") {
      return res.status(400).json({ success: false, message: "active must be a boolean" });
    }
    const active = toBoolean(raw);
    const banner = await Banner.findByIdAndUpdate(
      id,
      { active },
      { new: true, runValidators: true }
    );
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    try {
      await writeAudit(req, {
        entityType: "banner",
        entityId: String(banner._id),
        action: active ? "activated" : "deactivated",
        changes: { active },
      });
    } catch (auditError) {
      console.error("Banner toggle audit failed", auditError.message);
    }
    res.status(200).json({
      success: true,
      message: active ? "Banner activated" : "Banner deactivated",
      banner: serializeBanner(req, banner),
    });
  } catch (error) {
    console.error("Toggle Banner Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to update banner status" });
  }
};

export const recordBannerImpression = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndUpdate(
      id,
      { $inc: { impressionCount: 1 } },
      { new: true, runValidators: true }
    );
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    res.status(200).json({
      success: true,
      bannerId: String(banner._id),
      impressionCount: banner.impressionCount,
    });
  } catch (error) {
    console.error("Banner impression error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to record banner impression" });
  }
};

export const recordBannerClick = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndUpdate(
      id,
      { $inc: { clickCount: 1 } },
      { new: true, runValidators: true }
    );
    if (!banner) {
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    res.status(200).json({
      success: true,
      bannerId: String(banner._id),
      clickCount: banner.clickCount,
    });
  } catch (error) {
    console.error("Banner click error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to record banner click" });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid banner id" });
    }

    const banner = await Banner.findByIdAndDelete(id).select(
      "+imageFileName +imageStorage +imageKey"
    );

    if (!banner) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }

    try {
      await writeAudit(req, {
        entityType: "banner",
        entityId: id,
        action: "deleted",
        changes: { title: banner.title, placement: banner.placement, active: banner.active },
      });
    } catch (auditError) {
      console.error("Banner delete audit failed", auditError.message);
    }

    try {
      await removeBannerAsset(banner);
    } catch (cleanupError) {
      // The logical delete succeeded. Log storage cleanup for operations rather
      // than returning an error that encourages a duplicate delete attempt.
      console.error("Delete Banner Asset Cleanup Error:", cleanupError);
    }

    res.status(200).json({ success: true, message: "Banner deleted" });
  } catch (error) {
    console.error("Delete Banner Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to delete banner" });
  }
};

export const getBannerImage = async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).send("File name is required");
    }

    const directoryPath = path.join(__dirname, "../../public/banner-images");
    await serveUploadedFile({
      res,
      fileName,
      localPaths: [path.join(directoryPath, path.basename(fileName))],
      s3Prefixes: ["banner-images"],
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).send("Internal Server Error");
  }
};