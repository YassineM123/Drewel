import mongoose from "mongoose";
import SavedPlace, { SAVED_PLACE_TYPES } from "../models/SavedPlace.js";
import UserPreference from "../models/UserPreference.js";
import SupportReport, { SUPPORT_REPORT_CATEGORIES } from "../models/SupportReport.js";
import { assertRideParticipant, resolvePrincipal } from "../services/rideCommunicationPolicy.js";

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({
    success: false,
    code: error.code || "INTERNAL_ERROR",
    message: error.statusCode ? error.message : "Internal server error",
  });

class AccountError extends Error {
  constructor(message, statusCode = 400, code = "ACCOUNT_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const requirePassenger = async (req) => {
  const principal = await resolvePrincipal(req.user?._id);
  if (principal.role !== "passenger") {
    throw new AccountError("Passenger account required", 403, "PASSENGER_REQUIRED");
  }
  return principal;
};

const requireAccountOwner = async (req) => {
  const principal = await resolvePrincipal(req.user?._id);
  if (!["passenger", "driver"].includes(principal.role)) {
    throw new AccountError("Passenger or driver account required", 403, "ACCOUNT_OWNER_REQUIRED");
  }
  return principal;
};

const placeDto = (place) => ({
  id: String(place._id),
  type: place.type,
  name: place.name,
  address: place.address,
  lat: place.lat,
  long: place.long,
  category: place.category || "",
  createdAt: place.createdAt,
  updatedAt: place.updatedAt,
});

const preferenceDto = (preference) => ({
  language: preference.language || "en",
  notifications: {
    rideUpdates: preference.notifications?.rideUpdates !== false,
    messages: preference.notifications?.messages !== false,
    calls: preference.notifications?.calls !== false,
    accountUpdates: preference.notifications?.accountUpdates !== false,
    sounds: preference.notifications?.sounds !== false,
    vibration: preference.notifications?.vibration !== false,
  },
});

const normalizePlaceInput = (body = {}) => {
  const type = String(body.type || "favorite").trim().toLowerCase();
  if (!SAVED_PLACE_TYPES.includes(type)) {
    throw new AccountError("Saved place type must be home, work, or favorite", 400, "INVALID_PLACE_TYPE");
  }
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  const address = String(body.address || "").trim().replace(/\s+/g, " ");
  const lat = Number(body.lat);
  const long = Number(body.long);
  const category = String(body.category || "").trim().slice(0, 40);
  if (!name) throw new AccountError("Place name is required", 400, "PLACE_NAME_REQUIRED");
  if (!address) throw new AccountError("Place address is required", 400, "PLACE_ADDRESS_REQUIRED");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new AccountError("Valid latitude is required", 400, "INVALID_LATITUDE");
  if (!Number.isFinite(long) || long < -180 || long > 180) throw new AccountError("Valid longitude is required", 400, "INVALID_LONGITUDE");
  return { type, name, address, lat, long, category };
};

export const listSavedPlaces = async (req, res) => {
  try {
    const principal = await requirePassenger(req);
    const places = await SavedPlace.find({ userId: principal.id }).sort({ type: 1, updatedAt: -1 });
    return res.json({ success: true, places: places.map(placeDto) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const upsertSavedPlace = async (req, res) => {
  try {
    const principal = await requirePassenger(req);
    const input = normalizePlaceInput(req.body);
    const filter = input.type === "favorite" && mongoose.isValidObjectId(req.params.placeId)
      ? { _id: req.params.placeId, userId: principal.id }
      : input.type === "favorite"
        ? { _id: new mongoose.Types.ObjectId(), userId: principal.id }
        : { userId: principal.id, type: input.type };
    const place = await SavedPlace.findOneAndUpdate(
      filter,
      { $set: { ...input, userId: principal.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ success: true, place: placeDto(place) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const deleteSavedPlace = async (req, res) => {
  try {
    const principal = await requirePassenger(req);
    if (!mongoose.isValidObjectId(req.params.placeId)) {
      throw new AccountError("Invalid saved place id", 400, "INVALID_PLACE_ID");
    }
    const deleted = await SavedPlace.findOneAndDelete({ _id: req.params.placeId, userId: principal.id });
    if (!deleted) throw new AccountError("Saved place not found", 404, "PLACE_NOT_FOUND");
    return res.json({ success: true, message: "Saved place deleted" });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getPreferences = async (req, res) => {
  try {
    const principal = await requireAccountOwner(req);
    const preference = await UserPreference.findOneAndUpdate(
      { userId: principal.id },
      { $setOnInsert: { userId: principal.id, actorRole: principal.role } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, preferences: preferenceDto(preference) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updatePreferences = async (req, res) => {
  try {
    const principal = await requireAccountOwner(req);
    const update = {};
    if (req.body?.language !== undefined) {
      const language = String(req.body.language).trim().toLowerCase();
      if (!["en", "ar"].includes(language)) {
        throw new AccountError("Unsupported language", 400, "INVALID_LANGUAGE");
      }
      update.language = language;
    }
    if (req.body?.notifications && typeof req.body.notifications === "object") {
      for (const key of ["rideUpdates", "messages", "calls", "accountUpdates", "sounds", "vibration"]) {
        if (req.body.notifications[key] !== undefined) {
          update[`notifications.${key}`] = req.body.notifications[key] === true;
        }
      }
      update["notifications.rideUpdates"] = true;
      update["notifications.calls"] = true;
    }
    const preference = await UserPreference.findOneAndUpdate(
      { userId: principal.id },
      { $set: update, $setOnInsert: { userId: principal.id, actorRole: principal.role } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, preferences: preferenceDto(preference) });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createSupportReport = async (req, res) => {
  try {
    const principal = await requireAccountOwner(req);
    const category = String(req.body?.category || "").trim().toLowerCase();
    if (!SUPPORT_REPORT_CATEGORIES.includes(category)) {
      throw new AccountError("Invalid issue category", 400, "INVALID_REPORT_CATEGORY");
    }
    const description = String(req.body?.description || "").trim().replace(/\s+/g, " ");
    if (description.length < 10) {
      throw new AccountError("Please describe the issue in at least 10 characters", 400, "REPORT_DESCRIPTION_TOO_SHORT");
    }
    let rideId = null;
    if (req.body?.rideId) {
      if (!mongoose.isValidObjectId(req.body.rideId)) {
        throw new AccountError("Invalid ride id", 400, "INVALID_RIDE_ID");
      }
      const { ride } = await assertRideParticipant(principal, req.body.rideId);
      rideId = ride._id;
    }
    const report = await SupportReport.create({
      userId: principal.id,
      actorRole: principal.role,
      rideId,
      category,
      description,
    });
    return res.status(201).json({
      success: true,
      report: {
        id: String(report._id),
        rideId: report.rideId ? String(report.rideId) : null,
        category: report.category,
        description: report.description,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getLegalContent = async (req, res) => {
  try {
    await requireAccountOwner(req);
    const type = String(req.params.type || "").trim().toLowerCase();
    if (!["privacy", "terms"].includes(type)) {
      throw new AccountError("Invalid legal document", 400, "INVALID_LEGAL_TYPE");
    }
    return res.json({
      success: true,
      legal: {
        type,
        title: type === "privacy" ? "Privacy" : "Terms & Conditions",
        lastUpdated: process.env.LEGAL_LAST_UPDATED || null,
        body: process.env[type === "privacy" ? "PRIVACY_CONTENT" : "TERMS_CONTENT"] || "",
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
