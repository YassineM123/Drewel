export const presenceVersion = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : -1;
};

export const presenceIsOnline = (value) => {
  const status = value?.presenceStatus ?? value?.status;
  if (status != null && String(status).trim() !== "") {
    return String(status).toLowerCase() === "online";
  }
  return value?.isOnline === true;
};

export const shouldApplyPresence = (currentVersion, update) =>
  presenceVersion(update?.version) > presenceVersion(currentVersion);

export const applyPresence = (driver, update) => ({
  ...driver,
  presenceStatus: presenceIsOnline(update) ? "Online" : "Offline",
  isOnline: presenceIsOnline(update),
  presenceLeaseExpiresAt: update?.leaseExpiresAt ?? driver?.presenceLeaseExpiresAt,
  presenceLastHeartbeatAt: update?.lastHeartbeatAt ?? driver?.presenceLastHeartbeatAt,
  presenceVersion: presenceVersion(update?.version),
  presenceReason: update?.reason ?? driver?.presenceReason,
  presenceUpdatedAt: update?.updatedAt ?? driver?.presenceUpdatedAt,
});

export const normalizeDriverPresence = (driver) => ({
  ...driver,
  presenceStatus: presenceIsOnline(driver) ? "Online" : "Offline",
  presenceVersion: presenceVersion(driver?.presenceVersion ?? driver?.version),
});

export const mergePresenceSnapshot = (current, snapshot, latestVersion) => {
  const normalized = normalizeDriverPresence(snapshot);
  if (!current || presenceVersion(latestVersion) <= normalized.presenceVersion) {
    return normalized;
  }
  return {
    ...normalized,
    presenceStatus: current.presenceStatus,
    isOnline: current.isOnline,
    presenceLeaseExpiresAt: current.presenceLeaseExpiresAt,
    presenceLastHeartbeatAt: current.presenceLastHeartbeatAt,
    presenceVersion: presenceVersion(latestVersion),
    presenceReason: current.presenceReason,
    presenceUpdatedAt: current.presenceUpdatedAt,
  };
};
