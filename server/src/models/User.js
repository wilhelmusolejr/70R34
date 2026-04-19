import mongoose from "mongoose";

const { Schema, model } = mongoose;

const UserProfileSchema = new Schema(
  {
    profileId: { type: Schema.Types.ObjectId, required: true },
    assignedAt: { type: String, default: "" },
    assignmentStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "maker", "guest"],
      default: "guest",
    },
    profiles: { type: [UserProfileSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const User = model("User", UserSchema);
