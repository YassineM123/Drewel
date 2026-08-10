import { describe, expect, it } from "vitest";
import {
  applyPresence,
  normalizeDriverPresence,
  mergePresenceSnapshot,
  shouldApplyPresence,
} from "./driverPresence";

describe("driver presence event ordering", () => {
  it("rejects duplicate and out-of-order versions", () => {
    expect(shouldApplyPresence(7, { version: 7 })).toBe(false);
    expect(shouldApplyPresence(7, { version: 6 })).toBe(false);
    expect(shouldApplyPresence(7, { version: 8 })).toBe(true);
  });

  it("updates presence without overwriting availability or GPS freshness", () => {
    const driver = { availabilityStatus: "Busy", locationUpdatedAt: "gps-time" };
    const next = applyPresence(driver, {
      version: 2,
      status: "Offline",
      updatedAt: "presence-time",
    });
    expect(next).toMatchObject({
      presenceStatus: "Offline",
      isOnline: false,
      availabilityStatus: "Busy",
      locationUpdatedAt: "gps-time",
      presenceUpdatedAt: "presence-time",
    });
  });

  it("normalizes REST snapshots", () => {
    expect(normalizeDriverPresence({ isOnline: true }).presenceStatus).toBe("Online");
  });

  it("keeps a newer socket presence while accepting snapshot profile data", () => {
    const next = mergePresenceSnapshot(
      { presenceStatus: "Offline", isOnline: false, presenceVersion: 6 },
      { fullName: "Yassine", isOnline: true, presenceVersion: 5 },
      6
    );
    expect(next).toMatchObject({
      fullName: "Yassine",
      presenceStatus: "Offline",
      isOnline: false,
      presenceVersion: 6,
    });
  });
});
