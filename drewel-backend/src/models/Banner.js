import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    placement: {
      type: String,
      enum: ["home", "splash", "ride", "checkout", "promo"],
      default: "home",
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    clickCount: { type: Number, default: 0, min: 0 },
    impressionCount: { type: Number, default: 0, min: 0 },
    imageUrl: {
      type: String,
      required: true,
    },
    imageFileName: {
      type: String,
      select: false,
    },
    imageStorage: {
      type: String,
      enum: ["local", "s3"],
      select: false,
    },
    imageKey: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (document, result) => {
        delete result.imageFileName;
        delete result.imageStorage;
        delete result.imageKey;
        return result;
      },
    },
  }
);

export default mongoose.model('Banner', bannerSchema);
