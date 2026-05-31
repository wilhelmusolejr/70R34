import mongoose from "mongoose";

const { Schema, model } = mongoose;

const IMAGE_SOURCE_TYPES = ["generated", "scraped", "stock", "real"];

const ImageAnnotationSchema = new Schema(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
    },
    label: { type: String, required: true, trim: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ImageSchema = new Schema(
  {
    filename: { type: String, required: true, trim: true },
    humanAssetId: {
      type: Schema.Types.ObjectId,
      ref: "HumanAsset",
      default: null,
    },
    originalCaption: { type: String, default: "", trim: true },
    altText: { type: String, default: "", trim: true },
    tags: { type: [String], default: [] },
    sourceType: {
      type: String,
      enum: IMAGE_SOURCE_TYPES,
      required: true,
    },
    aiGenerated: { type: Boolean, default: false },
    generationModel: { type: String, default: null },
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    annotations: { type: [ImageAnnotationSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ImageSchema.index({ filename: 1 }, { unique: true });
ImageSchema.index({ humanAssetId: 1 });
ImageSchema.index({ tags: 1, sourceType: 1 });
ImageSchema.index({ tags: 1, postId: 1 });

export { IMAGE_SOURCE_TYPES };
export const Image = model("Image", ImageSchema);
