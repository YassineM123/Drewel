export const AVAILABLE_DRIVER_FIELDS =
  "firstName lastName fullName profileImageUrl city vehicleType lat long isOnline status updatedAt";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactCaseInsensitiveMatch = (value) => {
  const trimmed = String(value ?? "").trim();
  return trimmed ? { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") } : null;
};

export const buildAvailableDriverFilter = (query = {}) => {
  const filter = {
    isOnline: true,
    isApproved: true,
    isRestricted: false,
    isDeleted: { $ne: true },
    // Drivers created before the staged request workflow have neither status
    // field. Keep those already-approved accounts discoverable while explicit
    // pending/approved/rejected workflow records remain excluded.
    $or: [
      { status: "completed" },
      { status: null, profileRequestStatus: null },
    ],
  };

  const cityMatch = exactCaseInsensitiveMatch(query.city);
  if (cityMatch) filter.city = cityMatch;

  const vehicleTypeMatch = exactCaseInsensitiveMatch(query.vehicleType);
  if (vehicleTypeMatch) filter.vehicleType = vehicleTypeMatch;

  return filter;
};
