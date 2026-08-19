import { describe, expect, it } from "vitest";
import { getPointsAccess } from "./pointsPermissions";

describe("Driver Points role access", () => {
  it("allows the Owner to manage all point features", () => {
    expect(getPointsAccess({ role: "owner" })).toMatchObject({
      canRead: true, canAdjust: true, canManageRequests: true,
      canManagePacks: true, canManageSettings: true,
    });
  });

  it("allows Finance Admin adjustments but not owner configuration", () => {
    expect(getPointsAccess({ role: "finance_admin" })).toMatchObject({
      canRead: true, canAdjust: true, canManageRequests: true,
      canManagePacks: false, canManageSettings: false,
    });
  });

  it("allows a general Admin to read and adjust points but not manage requests/packs/settings", () => {
    expect(getPointsAccess({ role: "admin" })).toMatchObject({
      canRead: true, canAdjust: true, canManageRequests: false,
      canManagePacks: false, canManageSettings: false,
    });
  });
});
