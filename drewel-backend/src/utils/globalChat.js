import mongoose from "mongoose";
import getConversation from "../helpers/getConversation.js";
import Admin from "../models/Admin.js";
import {
  ConversationModel,
  MessageModel,
} from "../models/ConversationModel.js";
import User from "../models/User.js";
import { io } from "../socket/index.js";
import Driver from "../models/Driver.js";

export const messagePageHandler = async (
  socket,
  userId,
  user,
  onlineUser,
  blockedUsers = []
) => {
  let userDetails = await User.findById(userId).select("-password");
  if (!userDetails) userDetails = await Admin.findById(userId);
  if (userDetails) {
    const payload = {
      _id: userDetails?._id,
      name: userDetails.fullName || userDetails.name || "",
      profile_pic: userDetails?.profilePicture || userDetails.profileImageUrl,
      online: onlineUser.has(userId),
    };

    socket.emit("message-user", payload);
    // console.log("payload: ", payload);
  }

  // Get previous message
  const getConversationMessage = await ConversationModel.findOne({
    $or: [
      { sender: user._id, receiver: userId },
      { sender: userId, receiver: user._id },
    ],
  })
    .populate("messages")
    .sort({ updatedAt: -1 });
  // console.log('getConversationMessage', getConversationMessage)

  // const messages = {
  //   ...getConversationMessage.toObject(),
  //   messages:getConversationMessage.messages.find(
  //     (message) => {
  //       return !Array.isArray(message);
  //     }
  //   ),
  // }
  socket.emit("message", getConversationMessage);
};

export const newMessageHandler = async (socket, userId, user, data) => {
  try {
    const {
      sender,
      receiver,
      text,
      imageUrl,
      videoUrl,
      msgByUserId,
      chatType,
    } = data;

    let conversation = await ConversationModel.findOne({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    });

    // Resolve sender/receiver type
    const senderReference = (await Admin.findById(sender))
      ? "Admin"
      : (await Driver.findById(sender))
      ? "Driver"
      : "User";

    const receiverReference = (await Admin.findById(receiver))
      ? "Admin"
      : (await Driver.findById(receiver))
      ? "Driver"
      : "User";

    // Create conversation if not exists
    if (!conversation) {
      const newConversation = new ConversationModel({
        sender,
        receiver,
        senderReference,
        receiverReference,
      });
      conversation = await newConversation.save();
    }

    // Create and save message
    const message = new MessageModel({
      text,
      imageUrl,
      videoUrl,
      msgByUserId,
      userReference: senderReference,
    });
    const saveMessage = await message.save();

    // Add message to conversation
    await ConversationModel.updateOne(
      { _id: conversation._id },
      { $push: { messages: saveMessage._id } }
    );

    // Get updated conversation with messages
    const getConversationMessage = await ConversationModel.findOne({
      _id: conversation._id,
    })
      .populate("messages")
      .sort({ updatedAt: -1 });

    // Emit message to both users
    io.to(sender).emit("message", getConversationMessage);
    io.to(receiver).emit("message", getConversationMessage);

    // Emit updated conversation list
    const conversationSender = await getConversation(sender);
    const conversationReceiver = await getConversation(receiver);
    io.to(sender).emit("conversation", conversationSender);
    io.to(receiver).emit("conversation", conversationReceiver);
  } catch (error) {
    console.error("Error in newMessageHandler:", error);
    socket.emit("error", {
      message: "An error occurred while processing the message.",
    });
  }
};

export const messageSeenHandler = async (msgByUserId) => {
  try {
    msgByUserId = new mongoose.Types.ObjectId(msgByUserId);
    let conversation = await ConversationModel.findOne({
      $or: [
        { sender: user._id, receiver: msgByUserId },
        { sender: msgByUserId, receiver: user._id },
      ],
    });

    const conversationMessageId = conversation?.messages || [];

    await MessageModel.updateMany(
      { _id: { $in: conversationMessageId }, msgByUserId: msgByUserId },
      { $set: { seen: true } }
    );
    // Send conversation
    const conversationSender = await getConversation(userIdString);
    const conversationReceiver = await getConversation(msgByUserId);

    io.to(userIdString).emit("conversation", conversationSender);
    io.to(msgByUserId).emit("conversation", conversationReceiver);

    const receiver = user?._id;
    const chatNotification = await ChatNotifications.findOne({
      sender: msgByUserId,
      receiver: receiver,
    });
    if (chatNotification) {
      chatNotification.unreadCount = 0;
      chatNotification.isRead = true;
      await chatNotification.save();
      const chatNotifications = await getUsersChatNotifications(receiver);
      io.to(receiver?.toString()).emit("chat-notifications", {
        chatNotifications,
      });
    }
  } catch (error) {}
};

export const sidebarHandler = async (socket, currentUserId, page, limit) => {
  console.log("currentUserId: ", currentUserId);
  const conversation = await getConversation(currentUserId, page, limit);

  if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
    const user = await Admin.findById(currentUserId);
  }
  console.log("conversation: ", conversation);
  socket.emit("conversation", conversation);
};
export const globalMessagePageHandler = async (socket) => {
  const getConversationMessage = await GlobalConversation.findOne()
    .populate({
      path: "messages",
      populate: { path: "msgByUserId", select: "userName avatarUrl winStreak" }, // to show sender info
    })
    .sort({ updatedAt: -1 });

  console.log("getConversationMessage: ", getConversationMessage);
  socket.emit("globalMessages", getConversationMessage);
};

export const newGlobalMessageHandler = async (io, socket, data) => {
  try {
    const { text, imageUrl, videoUrl, msgByUserId } = data;
    console.log("data: ", data);

    // Always operate on the single global conversation
    let conversation = await GlobalConversation.findOne();

    // If conversation doesn't exist, create it
    if (!conversation) {
      conversation = new GlobalConversation({ messages: [] });
      await conversation.save();
    }
    let userReference = "User";
    const admin = await Admin.findById(msgByUserId);
    if (admin) {
      userReference = "Admin";
    }
    // Create and save new message
    const message = new MessageModel({
      text,
      imageUrl,
      videoUrl,
      msgByUserId,
      userReference,
    });

    const savedMessage = await message.save();

    // Add message to conversation
    conversation.messages.push(savedMessage._id);
    await conversation.save();

    // Get updated conversation with populated messages
    const populatedConversation = await GlobalConversation.findById(
      conversation._id
    ).populate({
      path: "messages",
      populate: {
        path: "msgByUserId",
        select: "userName avatarUrl winStreak role",
      }, // to show sender info
    });

    // Emit to all connected clients
    io.emit("globalMessages", populatedConversation);
  } catch (error) {
    console.error("Error in newGlobalMessageHandler:", error);
    io.emit("error", { message: "Error while sending global message." });
  }
};
