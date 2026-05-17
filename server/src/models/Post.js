import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PostSchema = new Schema(
  {
    images: [{ type: Schema.Types.ObjectId, ref: "Image", required: true }],
    caption: { type: String, default: "" },
    context: { type: String, default: "" },
    theme: { type: String, default: "" },
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", default: null },
    assignedAt: { type: Date, default: null },
    generatedBy: { type: String, default: "" },
    generationModel: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

PostSchema.index({ profileId: 1 });
PostSchema.index({ theme: 1 });
PostSchema.index({ images: 1 }, { unique: true });

export const Post = model("Post", PostSchema);
