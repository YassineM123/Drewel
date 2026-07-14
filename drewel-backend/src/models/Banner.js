import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
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
