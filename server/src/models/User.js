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

const USER_DEFAULT_COUNTRIES = ["US", "IT"];

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "maker", "guest"],
      default: "guest",
    },
    defaultCountry: {
      type: String,
      enum: USER_DEFAULT_COUNTRIES,
      default: "US",
    },
    profiles: { type: [UserProfileSchema], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export { USER_DEFAULT_COUNTRIES };
export const User = model("User", UserSchema);
