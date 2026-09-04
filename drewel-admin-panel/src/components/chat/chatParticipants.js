export const participantId = (participant) =>
  String(participant?._id || participant?.id || participant || "");

export const getOtherParticipant = (conversation, currentUserId) => {
  if (!conversation) return null;
  return participantId(conversation.sender) === String(currentUserId || "")
    ? conversation.receiver
    : conversation.sender;
};

export const getOtherParticipantRole = (conversation, currentUserId) => {
  if (!conversation) return "user";
  const reference = participantId(conversation.sender) === String(currentUserId || "")
    ? conversation.receiverReference
    : conversation.senderReference;
  const participant = getOtherParticipant(conversation, currentUserId);
  const value = String(reference || participant?.role || "User").toLowerCase();
  return value === "driver" ? "driver" : value === "admin" ? "admin" : "user";
};

export const participantProfilePath = (participant, role) => {
  const id = participantId(participant);
  if (!id) return "";
  return String(role || participant?.role || "user").toLowerCase() === "driver"
    ? `/driver-detail/${encodeURIComponent(id)}`
    : `/users/${encodeURIComponent(id)}`;
};

export const participantPhone = (participant) => {
  const countryCode = String(participant?.countryCode || "").trim();
  const phone = String(participant?.phone || "").trim();
  return [countryCode, phone].filter(Boolean).join(" ") || "Phone not available";
};
