import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PROFILE_STATUSES = [
  "Available",
  "Need Setup",
  "Need Checking",
  "Pending Profile",
  "Active",
  "Flagged",
  "Banned",
  "Ready",
  "Delivered",
];

const FRIEND_REQUEST_STATUSES = ["Pending", "Accepted", "Declined"];

const PROFILE_COUNTRIES = ["US", "IT"];

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

// Append-only record of profile status transitions. Written by the
// findOneAndUpdate hook below whenever `status` actually changes, so the
// dashboard can answer "how many got banned today" and similar questions.
const StatusHistorySchema = new Schema(
  {
    from: { type: String, default: "" },
    to: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ProfileImageAssignmentSchema = new Schema(
  {
    humanAssetId: {
      type: Schema.Types.ObjectId,
      ref: "HumanAsset",
      default: null,
    },
    imageId: {
      type: Schema.Types.ObjectId,
      ref: "Image",
      required: true,
    },
    assignedAt: { type: Date, default: Date.now },
    tags: { type: [String], default: [] },
    postCaption: { type: String, default: "" },
  },
  { _id: false },
);

const FriendRequestSchema = new Schema(
  {
    senderProfileId: {
      type: Schema.Types.ObjectId,
      ref: "Profile",
      required: true,
    },
    status: {
      type: String,
      enum: FRIEND_REQUEST_STATUSES,
      default: "Pending",
    },
    receivedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ONBOARDING_KEYS = [
  "privacyPublicAt",
  "profileImageSetAt",
  "coverImageSetAt",
  "aboutSetAt",
  "marketplaceSetAt",
  "groupJoinedAt",
  "highlightsSetAt",
  "publishPostAt",
  "pageSetAt",
  "recoveryEmailSetAt",
  "lastSharedAt",
];

const OnboardingSchema = new Schema(
  ONBOARDING_KEYS.reduce((acc, key) => {
    acc[key] = { type: Date, default: null };
    return acc;
  }, {}),
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
    country: {
      type: String,
      enum: PROFILE_COUNTRIES,
      default: "US",
    },
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
    hasGoodImages: { type: Boolean, default: false },
    profileSetup: { type: Boolean, default: false },
    recoveryEmail: { type: String, default: "" },
    phone: { type: String, default: "" },
    notes: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    coverPhotoUrl: { type: String, default: "" },
    websites: { type: [String], default: [] },
    socialLinks: { type: [SocialLinkSchema], default: [] },
    images: { type: [ProfileImageAssignmentSchema], default: [] },
    posts: {
      type: [{ type: Schema.Types.ObjectId, ref: "Post" }],
      default: [],
    },
    friendRequests: { type: [FriendRequestSchema], default: [] },
    trackerLog: { type: [TrackerLogSchema], default: [] },
    statusHistory: { type: [StatusHistorySchema], default: [] },
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
    onboarding: { type: OnboardingSchema, default: () => ({}) },
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

// Record status transitions on any findOneAndUpdate-based update (PATCH /:id,
// PUT /:id, etc.). When the incoming update changes `status` to a different
// value, append { from, to, at } to statusHistory in the same write.
ProfileSchema.pre("findOneAndUpdate", async function recordStatusChange() {
  const update = this.getUpdate() || {};
  const nextStatus =
    update.status !== undefined ? update.status : update.$set?.status;
  if (nextStatus === undefined) return; // status not being touched

  const current = await this.model
    .findOne(this.getQuery())
    .select("status")
    .lean();
  if (!current || current.status === nextStatus) return; // no real change

  const entry = { from: current.status || "", to: nextStatus, at: new Date() };
  if (!update.$push) update.$push = {};
  update.$push.statusHistory = entry;
  this.setUpdate(update);
});

// Seed an initial statusHistory entry when a profile is first created, so the
// timeline starts at creation. `from` is empty because there's no prior status.
// Covers Profile.create() and new Profile().save(); the bulk insertMany path
// sets this itself since insertMany skips document middleware.
ProfileSchema.pre("save", function seedInitialStatusHistory(next) {
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [
      { from: "", to: this.status, at: this.createdAt || new Date() },
    ];
  }
  next();
});

export { PROFILE_STATUSES, RELATIONSHIP_STATUSES, FRIEND_REQUEST_STATUSES, PROFILE_COUNTRIES, ONBOARDING_KEYS };
export const Profile = model("Profile", ProfileSchema);
