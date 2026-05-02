import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PROFILE_STATUSES = [
  "Available",
  "Need Setup",
  "Pending Profile",
  "Active",
  "Flagged",
  "Banned",
  "Ready",
  "Delivered",
];

const RELATIONSHIP_STATUSES = [
  "",
  "Single",
  "In a Relationship",
  "Engaged",
  "Married",
  "In a civil union",
  "In a domestic partnership",
  "In an open relationship",
  "It's Complicated",
  "Separated",
  "Divorced",
  "Widowed",
];

const WorkSchema = new Schema(
  {
    company: { type: String, default: "" },
    position: { type: String, default: "" },
    from: { type: String, default: "" },
    current: { type: Boolean, default: false },
    to: { type: String, default: "" },
    city: { type: String, default: "" },
  },
  { _id: false },
);

const TravelSchema = new Schema(
  {
    place: { type: String, default: "" },
    date: { type: String, default: "" },
  },
  { _id: false },
);

const EducationEntrySchema = new Schema(
  {
    name: { type: String, default: "" },
    from: { type: String, default: "" },
    to: { type: String, default: "" },
    graduated: { type: Boolean, default: false },
    degree: { type: String, default: "" },
  },
  { _id: false },
);

const SocialLinkSchema = new Schema(
  {
    platform: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { _id: false },
);

const EmailSchema = new Schema(
  {
    address: { type: String, default: "" },
    selected: { type: Boolean, default: false },
  },
  { _id: false },
);

const BrowserSchema = new Schema(
  {
    browserId: { type: String, default: "" },
    provider: { type: String, default: "" },
  },
  { _id: false },
);

const ProxyAssignmentSchema = new Schema(
  {
    proxyId: {
      type: Schema.Types.ObjectId,
      ref: "Proxy",
      required: true,
    },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ProxyLogSchema = new Schema(
  {
    ip: { type: String, default: "" },
    city: { type: String, default: "" },
    region: { type: String, default: "" },
    country: { type: String, default: "" },
    loc: { type: String, default: "" },
    org: { type: String, default: "" },
    postal: { type: String, default: "" },
    timezone: { type: String, default: "" },
    checkedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const TrackerLogSchema = new Schema(
  {
    date: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const ProfileImageAssignmentSchema = new Schema(
  {
    imageId: {
      type: Schema.Types.ObjectId,
      ref: "Image",
      required: true,
    },
    assignedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const PersonalSchema = new Schema(
  {
    relationshipStatus: {
      type: String,
      enum: RELATIONSHIP_STATUSES,
      default: "",
    },
    relationshipStatusSince: { type: String, default: "" },
    languages: { type: [String], default: [] },
  },
  { _id: false },
);

const ProfileSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dob: { type: String, default: "" },
    gender: { type: String, default: "" },
    emails: { type: [EmailSchema], default: [] },
    emailPassword: { type: String, default: "" },
    facebookPassword: { type: String, default: "" },
    proxy: { type: String, default: "" },
    proxyLocation: { type: String, default: "" },
    proxies: { type: [ProxyAssignmentSchema], default: [] },
    proxyLog: { type: [ProxyLogSchema], default: [] },
    city: { type: String, default: "" },
    hometown: { type: String, default: "" },
    bio: { type: String, default: "" },
    status: {
      type: String,
      enum: PROFILE_STATUSES,
      default: "Available",
    },
    tags: { type: [String], default: [] },
    profileUrl: { type: String, default: "" },
    pageUrl: { type: String, default: "" },
    pageId: {
      type: Schema.Types.ObjectId,
      ref: "Page",
      default: null,
    },
    proxyId: {
      type: Schema.Types.ObjectId,
      ref: "Proxy",
      default: null,
    },
    profileCreated: { type: String, default: "" },
    accountCreated: { type: String, default: "" },
    friends: { type: Number, default: 0 },
    has2FA: { type: Boolean, default: false },
    hasPage: { type: Boolean, default: false },
    profileSetup: { type: Boolean, default: false },
    recoveryEmail: { type: String, default: "" },
    phone: { type: String, default: "" },
    notes: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    coverPhotoUrl: { type: String, default: "" },
    websites: { type: [String], default: [] },
    socialLinks: { type: [SocialLinkSchema], default: [] },
    images: { type: [ProfileImageAssignmentSchema], default: [] },
    trackerLog: { type: [TrackerLogSchema], default: [] },
    personal: { type: PersonalSchema, default: () => ({}) },
    work: { type: [WorkSchema], default: [] },
    education: {
      college: { type: EducationEntrySchema, default: () => ({}) },
      highSchool: { type: EducationEntrySchema, default: () => ({}) },
    },
    hobbies: { type: [String], default: [] },
    interests: {
      music: { type: [String], default: [] },
      tvShows: { type: [String], default: [] },
      movies: { type: [String], default: [] },
      games: { type: [String], default: [] },
      sportsTeams: { type: [String], default: [] },
    },
    travel: { type: [TravelSchema], default: [] },
    otherNames: { type: [String], default: [] },
    browsers: { type: [BrowserSchema], default: [] },
    identityPrompt: { type: String, default: "" },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ProfileSchema.index({ status: 1 });
ProfileSchema.index({ profileCreated: 1 });

export { PROFILE_STATUSES, RELATIONSHIP_STATUSES };
export const Profile = model("Profile", ProfileSchema);
