import mongoose from "mongoose";

const { Schema, model } = mongoose;

const HUMAN_ASSET_COUNTRIES = ["US", "IT"];

const HumanAssetSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    country: {
      type: String,
      enum: HUMAN_ASSET_COUNTRIES,
      default: "US",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

HumanAssetSchema.index({ name: 1 });
HumanAssetSchema.index({ country: 1 });

export { HUMAN_ASSET_COUNTRIES };
export const HumanAsset = model("HumanAsset", HumanAssetSchema);
