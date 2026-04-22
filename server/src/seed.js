/* global process */

import dotenv from "dotenv";
import { connectToDatabase } from "./config/db.js";
import { Profile, PROFILE_STATUSES } from "./models/Profile.js";
import { HumanAsset } from "./models/HumanAsset.js";
import { Image } from "./models/Image.js";
import { Proxy } from "./models/Proxy.js";
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

await Proxy.deleteMany({});
const seededProxies = await Proxy.insertMany([
  {
    host: "proxy-residential-01.iproyal.com",
    port: 12323,
    username: "loreauser",
    password: "lorea_pass_01",
    source: "IPRoyal",
    type: "residential",
    protocol: "http",
    label: "IPRoyal US Residential",
    status: "pending",
    country: "US",
    city: "New York",
    tags: ["us", "residential"],
  },
  {
    host: "isp.brightdata.com",
    port: 22225,
    username: "brd-customer-01",
    password: "brd_lorea_02",
    source: "Bright Data",
    type: "isp",
    protocol: "https",
    label: "BrightData ISP UK",
    status: "active",
    country: "UK",
    city: "London",
    lastCheckedAt: new Date(),
    lastKnownIp: "185.22.10.44",
    tags: ["uk", "isp"],
  },
  {
    host: "dc-pool.smartproxy.com",
    port: 7000,
    username: null,
    password: null,
    source: "Smartproxy",
    type: "datacenter",
    protocol: "socks5",
    label: "Smartproxy DC Pool",
    status: "inactive",
    country: "DE",
    city: null,
    tags: ["datacenter"],
  },
  {
    host: "mobile.soax.com",
    port: 9000,
    username: "soax_user",
    password: "soax_pass_03",
    source: "SOAX",
    type: "mobile",
    protocol: "http",
    label: "SOAX Mobile PH",
    status: "pending",
    country: "PH",
    city: "Manila",
    tags: ["ph", "mobile"],
  },
]);

console.log(`Seeded ${documents.length} profiles.`);
console.log(`Seeded ${seededImages.length} image.`);
console.log("Seeded 1 human asset.");
console.log(`Seeded ${seededProxies.length} proxies.`);
process.exit(0);
