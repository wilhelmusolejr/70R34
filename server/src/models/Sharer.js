import mongoose from "mongoose";

const { Schema, model } = mongoose;

const SHARER_TYPES = ["profile", "page", "group", "unknown"];
const SHARER_STATUSES = ["active", "inactive", "dead"];

const SharerSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    country: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 2,
    },
    type: {
      type: String,
      enum: SHARER_TYPES,
      default: "profile",
    },
    status: {
      type: String,
      enum: SHARER_STATUSES,
      default: "active",
    },
    label: { type: String, default: null, trim: true },
    notes: { type: String, default: null },
    tags: { type: [String], default: [] },
    lastUsedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

SharerSchema.index({ url: 1 }, { unique: true });
SharerSchema.index({ country: 1 });
SharerSchema.index({ status: 1 });
SharerSchema.index({ type: 1 });

export { SHARER_TYPES, SHARER_STATUSES };
export const Sharer = model("Sharer", SharerSchema);
