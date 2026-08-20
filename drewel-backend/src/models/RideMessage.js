import mongoose from "mongoose";

const rideMessageSchema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    senderRole: { type: String, enum: ["passenger", "driver"], required: true },
    // Voice messages carry no text; the field stays nullable so historical
    // text rows are untouched. Emptiness is enforced per message type in the
    // controllers, not here.
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    messageType: {
      type: String,
      enum: ["text", "trip_request", "voice"],
      default: "text",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Voice audio metadata. Only the storage reference lives in MongoDB —
    // bytes always live in the configured object/local storage driver.
    audioUrl: { type: String, default: null }, // Playback path served by this API (participant-gated).
    audioKey: { type: String, default: null }, // Storage key (S3) or file name (local).
    audioStorage: { type: String, enum: [null, "s3", "local"], default: null },
    audioMimeType: { type: String, default: null },
    audioDuration: { type: Number, default: null, min: 0 }, // Seconds.
    audioSize: { type: Number, default: null, min: 0 }, // Bytes.
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
