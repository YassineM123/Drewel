export const AVAILABLE_DRIVER_FIELDS =
  "firstName lastName fullName phone whatsappNumber profileImageUrl city vehicleType lat long isOnline status updatedAt";

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
