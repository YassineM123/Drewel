import mongoose from "mongoose";
import getConversation from "../helpers/getConversation.js";
import Admin from "../models/Admin.js";
import {
  ConversationModel,
  MessageModel,
  GlobalConversation,
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
  if (!userDetails) userDetails = await Driver.findById(userId).select("-otpCode -password");
  if (userDetails) {
    const payload = {
      _id: userDetails?._id,
      fullName: userDetails.fullName || userDetails.name || "",
      firstName: userDetails.firstName || "",
      lastName: userDetails.lastName || "",
      phone: userDetails.phone || "",
      countryCode: userDetails.countryCode || "",
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

export const newMessageHandler = async (socket, userId, data = {}) => {
  try {
    const {
      receiver,
      text,
      imageUrl,
      videoUrl,
    } = data;

    if (!mongoose.Types.ObjectId.isValid(receiver)) {
      throw new Error("Invalid message receiver");
    }
    const normalizedText = String(text || "").trim().slice(0, 4000);
    if (!normalizedText && !imageUrl && !videoUrl) {
      throw new Error("Message content is required");
    }
    const sender = userId.toString();
    const msgByUserId = userId;

    const receiverExists =
      (await Admin.exists({ _id: receiver })) ||
      (await Driver.exists({ _id: receiver })) ||
      (await User.exists({ _id: receiver }));
    if (!receiverExists) throw new Error("Message receiver not found");

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
      text: normalizedText,
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

export const messageSeenHandler = async (socket, currentUserId, otherUserId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) return;
    const conversation = await ConversationModel.findOne({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    });

    if (!conversation) return;

    const conversationMessageId = conversation?.messages || [];

    await MessageModel.updateMany(
      { _id: { $in: conversationMessageId }, msgByUserId: otherUserId },
      { $set: { seen: true } }
    );

    const currentConversationList = await getConversation(currentUserId);
    const otherConversationList = await getConversation(otherUserId);
    io.to(currentUserId.toString()).emit("conversation", currentConversationList);
    io.to(otherUserId.toString()).emit("conversation", otherConversationList);
  } catch (error) {
    console.error("Error marking messages as seen:", error);
    socket.emit("error", { message: "Unable to mark messages as seen" });
  }
};

export const sidebarHandler = async (socket, currentUserId, page, limit) => {
  const conversation = await getConversation(currentUserId, page, limit);
  socket.emit("conversation", conversation);
};
export const globalMessagePageHandler = async (socket) => {
  const getConversationMessage = await GlobalConversation.findOne()
    .populate({
      path: "messages",
      populate: { path: "msgByUserId", select: "fullName firstName lastName userName profilePicture profileImageUrl role" },
    })
    .sort({ updatedAt: -1 });

  console.log("getConversationMessage: ", getConversationMessage);
  socket.emit("globalMessages", getConversationMessage);
};

export const newGlobalMessageHandler = async (io, socket, currentUserId, data = {}) => {
  try {
    const { imageUrl, videoUrl } = data;
    const text = String(data.text || "").trim().slice(0, 4000);
    const msgByUserId = currentUserId;
    if (!text && !imageUrl && !videoUrl) {
      throw new Error("Message content is required");
    }

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
        select: "fullName firstName lastName userName profilePicture profileImageUrl role",
      }, // to show sender info
    });

    // Emit to all connected clients
    io.emit("globalMessages", populatedConversation);
  } catch (error) {
    console.error("Error in newGlobalMessageHandler:", error);
    io.emit("error", { message: "Error while sending global message." });
  }
};
