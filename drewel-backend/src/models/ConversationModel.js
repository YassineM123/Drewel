import mongoose from "mongoose";
import { Schema } from "mongoose";
const messageSchema = new mongoose.Schema(
  {
    messageType: {
      type: String,
      default: "chat",
    },
    text: {
      type: String,
      default: "",
    },
    arabicText: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    seen: {
      type: Boolean,
      default: false,
    },
    msgByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userReference", // dynamic reference
    },
    userReference: {
      type: String,
      // required: true,
      enum: ["User","Driver", "Admin"],
      default: "User", // possible models
    },
  },
  {
    timestamps: true,
  }
);

const conversationSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.ObjectId,
      required: true,
      refPath: "senderReference",
    },
    receiver: {
      type: mongoose.Schema.ObjectId,
      required: true,
      refPath: "receiverReference",
    },
    senderReference: {
      type: String,
      enum: ["User", "Driver", "Admin"],
      default: "User", // possible models
    },
    receiverReference: {
      type: String,
      enum: ["User","Driver", "Admin"],
      default: "User", // possible models
    },
    messages: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Message",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const globalConversationSchema = new mongoose.Schema(
  {
    messages: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Message",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const MessageModel = mongoose.model("Message", messageSchema);
const ConversationModel = mongoose.model("Conversation", conversationSchema);
const GlobalConversation = mongoose.model(
  "GlobalConversation",
  globalConversationSchema
);

export { MessageModel, ConversationModel, GlobalConversation };
