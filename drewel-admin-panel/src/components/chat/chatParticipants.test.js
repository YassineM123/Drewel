import { describe, expect, it } from "vitest";
import {
  getOtherParticipant,
  getOtherParticipantRole,
  participantPhone,
  participantProfilePath,
} from "./chatParticipants";

describe("support-chat participant contracts", () => {
  const conversation = {
    sender: { _id: "admin-1" },
    receiver: { _id: "driver-1", countryCode: "+971", phone: "501234567" },
    senderReference: "Admin",
    receiverReference: "Driver",
  };

  it("separates driver conversations from user conversations", () => {
    expect(getOtherParticipant(conversation, "admin-1")._id).toBe("driver-1");
    expect(getOtherParticipantRole(conversation, "admin-1")).toBe("driver");
  });

  it("routes avatars to the correct profile and preserves the full admin phone", () => {
    const participant = getOtherParticipant(conversation, "admin-1");
    expect(participantProfilePath(participant, "driver")).toBe("/driver-detail/driver-1");
    expect(participantPhone(participant)).toBe("+971 501234567");
  });
});
