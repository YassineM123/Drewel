import mongoose from "mongoose";

const rideMessageSchema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    senderRole: { type: String, enum: ["passenger", "driver"], required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    clientMessageId: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent", index: true },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

rideMessageSchema.index({ rideId: 1, createdAt: -1, _id: -1 });
rideMessageSchema.index({ rideId: 1, senderId: 1, clientMessageId: 1 }, { unique: true });

export default mongoose.model("RideMessage", rideMessageSchema);
