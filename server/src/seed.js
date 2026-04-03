/* global process */

import dotenv from "dotenv";
import { connectToDatabase } from "./config/db.js";
import { Profile, PROFILE_STATUSES } from "./models/Profile.js";
import { HumanAsset } from "./models/HumanAsset.js";
import { Image } from "./models/Image.js";
import { profiles } from "../../src/data.js";

dotenv.config();

function normalizeStatus(status) {
  if (status === "Pending Review") return "Pending Profile";
  if (PROFILE_STATUSES.includes(status)) return status;
  return "Available";
}

await connectToDatabase(process.env.MONGODB_URI);

const documents = profiles.map((profile) => ({
  ...profile,
  status: normalizeStatus(profile.status),
}));

// Drop the problematic email index if it exists
try {
  await Profile.collection.dropIndex("email_1");
  console.log("Dropped old email index");
} catch {
  // Index might not exist, which is fine
  console.log("Email index not found or already dropped");
}

await Profile.deleteMany({});
await Profile.insertMany(documents);
await Image.deleteMany({});
const seededImages = await Image.insertMany([
  {
    filename: "/images/jerome-hamoep-dummy.svg",
    annotation: "jerome_hamoep_placeholder_portrait",
    type: "profile",
    sourceType: "generated",
    aiGenerated: true,
    generationModel: "local-dummy-svg",
    usedBy: [],
  },
]);
await HumanAsset.deleteMany({});
await HumanAsset.insertMany([
  {
    name: "Jerome Hamoep",
    numberPossibleProfile: 3,
    numberProfileUsing: [],
    images: [seededImages[0]._id],
  },
]);

console.log(`Seeded ${documents.length} profiles.`);
console.log(`Seeded ${seededImages.length} image.`);
console.log("Seeded 1 human asset.");
process.exit(0);
