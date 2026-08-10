import mongoose from "mongoose";

export const CONVERSATION_STATUSES = ["active", "completed", "cancelled"];

const rideConversationSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      unique: true,
      index: true,
    },
    rideReference: { type: String, default: "" },
    passengerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },
    // Snapshots avoid per-row joins when rendering the participant inbox.
    passengerName: { type: String, default: "" },
    passengerImage: { type: String, default: "" },
    driverName: { type: String, default: "" },
    driverImage: { type: String, default: "" },
    driverVehicleType: { type: String, default: "" },
    driverVehicleModel: { type: String, default: "" },
    driverRegistration: { type: String, default: "" },
    driverRegistrationVisible: { type: Boolean, default: false },
    driverRating: { type: Number, default: null, min: 0, max: 5 },
    status: {
      type: String,
      enum: CONVERSATION_STATUSES,
      default: "active",
      index: true,
    },
    passengerUnreadCount: { type: Number, default: 0, min: 0 },
    driverUnreadCount: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, default: "" },
    lastMessageSenderRole: { type: String, default: "" },
    lastMessageStatus: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

rideConversationSchema.index({
  passengerId: 1,
  status: 1,
  lastMessageAt: -1,
});
rideConversationSchema.index({ driverId: 1, status: 1, lastMessageAt: -1 });

const RideConversation = mongoose.model(
  "RideConversation",
  rideConversationSchema
);

export default RideConversation;
