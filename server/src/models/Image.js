import mongoose from "mongoose";

const { Schema, model } = mongoose;

const IMAGE_TYPES = ["profile", "cover", "post", "document"];
const IMAGE_SOURCE_TYPES = ["generated", "scraped", "stock", "real"];

const ImageUsageSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
    },
  },
  { _id: false },
);

const ImageSchema = new Schema(
  {
    filename: { type: String, required: true, trim: true },
    annotation: { type: String, default: "", trim: true },
    type: {
      type: String,
      enum: IMAGE_TYPES,
      required: true,
    },
    sourceType: {
      type: String,
      enum: IMAGE_SOURCE_TYPES,
      required: true,
    },
    aiGenerated: { type: Boolean, default: false },
    generationModel: { type: String, default: null },
    usedBy: { type: [ImageUsageSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ImageSchema.index({ filename: 1 }, { unique: true });
ImageSchema.index({ type: 1, sourceType: 1 });

export { IMAGE_TYPES, IMAGE_SOURCE_TYPES };
export const Image = model("Image", ImageSchema);
