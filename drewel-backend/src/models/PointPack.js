import mongoose from "mongoose";

const pointPackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    points: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/,
    },
    active: { type: Boolean, default: false, index: true },
    displayOrder: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false }
);

pointPackSchema.pre("validate", function validatePackNumbers() {
  if (!Number.isSafeInteger(this.points)) {
    throw new Error("points must be a positive safe integer");
  }
  if (!Number.isSafeInteger(this.displayOrder)) {
    throw new Error("displayOrder must be a non-negative safe integer");
  }
  if (!Number.isFinite(this.price)) {
    throw new Error("price must be a finite number");
  }
});

pointPackSchema.index({ active: 1, displayOrder: 1, _id: 1 });
pointPackSchema.index({ name: 1, currency: 1 }, { unique: true });

export default mongoose.model("PointPack", pointPackSchema);
