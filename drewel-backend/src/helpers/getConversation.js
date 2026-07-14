import {
  ConversationModel,
  MessageModel,
} from "../models/ConversationModel.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

export const getConversation = async (currentUserId, page = 1, limit = 10) => {
  console.log("currentUserId: ", currentUserId);
  if (!currentUserId) return [];
  console.log('currentUserId: ', currentUserId);
  let currentUserConversation = (currentUserId == "6861224ceac0edaf19ffa056"
    ? await getConversationWithPopulate(currentUserId, page, limit)
    : await getConversationWithPopulate(currentUserId));

  let conversations = [];

  if (currentUserId == "6861224ceac0edaf19ffa056") {
    let idx = 0;

    conversations = currentUserConversation.map(async (conv) => {
      let sender = conv.sender;
      let receiver = conv.receiver;
      idx++;
      // Count unseen messages
      const countUnseenMsg = countUnseenMessages(conv?.messages, currentUserId);
      return {
        _id: conv?._id,
        sender,
        receiver,
        unseenMsg: countUnseenMsg,
        senderReference: conv?.senderReference,
        receiverReference: conv?.receiverReference,
        lastMsg: conv.messages[conv?.messages?.length - 1],
      };
    });
    
    
  } else {
    const filteredConversations = currentUserConversation.filter(
   
      (conv) =>
        conv.sender &&
        conv.receiver &&
        conv.sender?.role !== "admin" &&
        conv.receiver?.role !== "admin"
    );
    let idx = 0;
    conversations = filteredConversations.map(async (conv) => {
      let sender = conv.sender;
      let receiver = conv.receiver;
      idx++;
      const countUnseenMsg = countUnseenMessages(conv?.messages, currentUserId);
      return {
        _id: conv?._id,
        sender,
        receiver,
        senderReference: conv?.senderReference,
        receiverReference: conv?.receiverReference,
        unseenMsg: countUnseenMsg,
        lastMsg: conv.messages[conv?.messages?.length - 1],
      };
    });

    console.log('conversations: in else condition ', );
  }

  // Wait for all promises to resolve
  const finalConversations = await Promise.all(conversations);

  return finalConversations;
};



const getConversationWithPopulate = async (currentUserId, page, limit) => {
  const query = {
    $or: [{ sender: currentUserId }, { receiver: currentUserId }],
  };

  const baseQuery = ConversationModel.find(query)
    .sort({ updatedAt: -1 })
    .populate([
      { path: 'messages', options: { sort: { createdAt: 1 } } },
      { path: 'sender', select: 'fullName email profilePicture role phone countryCode' },
      { path: 'receiver', select: 'fullName email profilePicture role phone countryCode' },
    ])
    .select('senderReference receiverReference sender receiver messages updatedAt');

  if (page && limit) {
    const skip = (page - 1) * limit;
    baseQuery.skip(skip).limit(limit);
  }

  const conversations = await baseQuery;

  // Add computed fields
  const result = conversations.map((conv) => {
    const lastMsg = conv.messages[conv.messages.length - 1] || null;
    const unseenMsg = conv.messages.filter(
      (msg) => !msg.seen && msg.msgByUserId !== currentUserId
    ).length;

    return {
      ...conv.toObject(),
      lastMsg,
      unseenMsg,
    };
  });

  return result;
};


const getConversationWithoutPopulate = async (currentUserId) => {
  return await ConversationModel.find({
    $or: [{ sender: currentUserId }, { receiver: currentUserId }],
  }).sort({ updatedAt: -1 });
};
const countUnseenMessages = (messages, currentUserId) => {
  return messages.reduce((prev, curr) => {
    const messageSender = curr?.msgByUserId?.toString();
    if (messageSender !== currentUserId) {
      return prev + (curr?.seen ? 0 : 1);
    } else {
      return prev;
    }
  }, 0);
};
const getUserOrAdminById = async (userId) => {
  if (!userId) return null;

  const admin = await Admin
    .findById(userId)
    .select("firstName lastName winStreak userName avatarUrl fcmTokens");
  if (admin) {
    admin.fcmTokens = admin.fcmTokens || [];
    return admin;
  }

  const user = await User
    .findById(userId)
    .select("firstName lastName winStreak userName avatarUrl fcmTokens");
  return user;
};

export default getConversation;
