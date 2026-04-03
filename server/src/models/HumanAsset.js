import mongoose from "mongoose";

const { Schema, model } = mongoose;

const HumanAssetSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    numberPossibleProfile: { type: Number, default: 0, min: 0 },
    numberProfileUsing: [
      {
        type: Schema.Types.ObjectId,
        ref: "Profile",
      },
    ],
    images: [
      {
        type: Schema.Types.ObjectId,
        ref: "Image",
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

HumanAssetSchema.index({ name: 1 });

export const HumanAsset = model("HumanAsset", HumanAssetSchema);
