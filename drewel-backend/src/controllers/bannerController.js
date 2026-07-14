import Banner from "../models/Banner.js";
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

export const addBanner = async (req, res) => {
  const file = req.file;
  let assetCommitted = false;
  try {
    if (!file) {
      return res
        .status(400)
        .send({ success: false, message: "Please provide image for banner" });
    }
    const imageUrl = buildPublicAssetUrl(req, "/api/banner/get-image/", file.filename);

    const banner = new Banner({ imageUrl, ...getUploadedFileMetadata(file) });
    await banner.save();
    assetCommitted = true;

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
    res
      .status(500)
      .json({ success: false, message: "Unable to create banner" });
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

    // Editing metadata currently has no additional fields, but accepting an
    // empty multipart update lets the admin retain the existing banner image.
    if (!file) {
      return res.status(200).json({
        success: true,
        message: "Banner unchanged",
        banner: serializeBanner(req, existingBanner),
      });
    }

    const imageUrl = buildPublicAssetUrl(req, "/api/banner/get-image/", file.filename);

    const banner = await Banner.findByIdAndUpdate(
      id,
      { imageUrl, ...getUploadedFileMetadata(file) },
      { new: true, runValidators: true }
    );

    if (!banner) {
      await removeUploadedFile(file);
      return res.status(404).json({ success: false, message: "Banner not found" });
    }
    assetCommitted = true;

    try {
      await removeBannerAsset(existingBanner);
    } catch (cleanupError) {
      // The database already references the new image. Do not turn a successful
      // update into a client retry that could create another upload.
      console.error("Update Banner Old Asset Cleanup Error:", cleanupError);
    }

    res.status(200).json({
      success: true,
      message: "Banner updated",
      banner: serializeBanner(req, banner),
    });
  } catch (error) {
    if (!assetCommitted) {
      try {
        await removeUploadedFile(file);
      } catch (cleanupError) {
        console.error("Update Banner New Asset Cleanup Error:", cleanupError);
      }
    }
    console.error("Update Banner Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to update banner" });
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
