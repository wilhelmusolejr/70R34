import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PAGE_ASSET_TYPES = ["profile", "cover", "post", "reels"];

const PageAssetSchema = new Schema(
  {
    imageId: {
      type: Schema.Types.ObjectId,
      ref: "Image",
      required: true,
    },
    type: {
      type: String,
      enum: PAGE_ASSET_TYPES,
      required: true,
    },
    postDescription: { type: String, default: "" },
    postedAt: { type: Date, default: null },
    engagementScore: { type: Number, default: 0 },
  },
  { _id: false },
);

const PagePostSchema = new Schema(
  {
    post: { type: String, default: "" },
    images: [
      {
        type: Schema.Types.ObjectId,
        ref: "Image",
      },
    ],
  },
  {
    _id: true,
    timestamps: true,
  },
);

const PageSchema = new Schema(
  {
    schemaVersion: { type: String, default: "2.1" },
    pageName: { type: String, required: true, trim: true },
    pageId: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    followerCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    generationPrompt: { type: String, default: "" },
    linkedIdentities: [
      {
        type: Schema.Types.ObjectId,
        ref: "Profile",
      },
    ],
    assets: { type: [PageAssetSchema], default: [] },
    posts: { type: [PagePostSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

PageSchema.index({ pageName: 1 });
PageSchema.index({ pageId: 1 }, { sparse: true });

export { PAGE_ASSET_TYPES };
export const Page = model("Page", PageSchema);
