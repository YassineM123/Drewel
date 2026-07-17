import {
  ConversationModel,
} from "../models/ConversationModel.js";

export const getConversation = async (currentUserId, page = 1, limit = 10) => {
  if (!currentUserId) return [];

  const normalizedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const normalizedLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
  const conversations = await getConversationWithPopulate(
    currentUserId,
    normalizedPage,
    normalizedLimit
  );

  return conversations
    .filter((conversation) => conversation.sender && conversation.receiver)
    .map((conversation) => ({
      _id: conversation._id,
      sender: conversation.sender,
      receiver: conversation.receiver,
      senderReference: conversation.senderReference,
      receiverReference: conversation.receiverReference,
      unseenMsg: countUnseenMessages(conversation.messages || [], currentUserId),
      lastMsg: conversation.messages?.[conversation.messages.length - 1] || null,
    }));
};



const getConversationWithPopulate = async (currentUserId, page, limit) => {
  const query = {
    $or: [{ sender: currentUserId }, { receiver: currentUserId }],
  };

  const baseQuery = ConversationModel.find(query)
    .sort({ updatedAt: -1 })
    .populate([
      { path: 'messages', options: { sort: { createdAt: 1 } } },
      { path: 'sender', select: 'fullName firstName lastName email profilePicture profileImageUrl role phone countryCode' },
      { path: 'receiver', select: 'fullName firstName lastName email profilePicture profileImageUrl role phone countryCode' },
    ])
    .select('senderReference receiverReference sender receiver messages updatedAt');

  if (page && limit) {
    const skip = (page - 1) * limit;
    baseQuery.skip(skip).limit(limit);
  }

  const conversations = await baseQuery;

  return conversations;
};
const countUnseenMessages = (messages, currentUserId) => {
  const normalizedCurrentUserId = String(currentUserId);
  return messages.reduce((prev, curr) => {
    const messageSender = curr?.msgByUserId?.toString();
    if (messageSender !== normalizedCurrentUserId) {
      return prev + (curr?.seen ? 0 : 1);
    } else {
      return prev;
    }
  }, 0);
};
export default getConversation;
