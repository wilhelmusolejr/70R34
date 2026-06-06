// Simulation seed: drops realistic-looking activity across the last 7 days so
// the Dashboard has something to show. Creates sim maker users, profiles with
// staggered createdAt timestamps, tracker entries, and maker assignments with
// submittedAt values spread through the week.
//
// All inserted docs are tagged so --clean can remove only what this script made:
//   - User.username prefix: "sim_"
//   - Profile.tags includes "sim"
//
// Dry-run by default. Pass --apply to actually write.
//
//   cd server && node scripts/seed-simulation.mjs                # preview
//   cd server && node scripts/seed-simulation.mjs --apply        # execute
//   cd server && node scripts/seed-simulation.mjs --clean --apply  # wipe sim data + reseed
//   cd server && node scripts/seed-simulation.mjs --uri mongodb://... --apply
//
// Idempotent: re-running without --clean adds more sim profiles each time.

import mongoose from "mongoose";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { randomBytes, scryptSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

import { Profile } from "../src/models/Profile.js";
import { User } from "../src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

function parseArgs(argv) {
  const args = {
    uri: process.env.MONGODB_URI || "",
    apply: false,
    clean: false,
    profiles: 30,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--clean") args.clean = true;
    else if (a === "--uri") {
      args.uri = argv[i + 1] || args.uri;
      i += 1;
    } else if (a === "--profiles") {
      args.profiles = Number.parseInt(argv[i + 1], 10) || args.profiles;
      i += 1;
    }
  }
  return args;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomTimeInDay(daysAgo) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);
  return d;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const SIM_MAKERS = [
  { username: "sim_maker_alice", defaultCountry: "US" },
  { username: "sim_maker_bob", defaultCountry: "US" },
  { username: "sim_maker_chiara", defaultCountry: "IT" },
  { username: "sim_maker_dario", defaultCountry: "IT" },
];

const FIRST_NAMES_US = [
  "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "Lucas", "Mia", "Logan", "Charlotte", "Aiden", "Amelia",
];
const FIRST_NAMES_IT = [
  "Giulia", "Marco", "Sofia", "Lorenzo", "Aurora", "Leonardo", "Ginevra",
  "Tommaso", "Alice", "Francesco", "Beatrice", "Andrea", "Chiara", "Matteo",
];
const LAST_NAMES_US = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Taylor",
];
const LAST_NAMES_IT = [
  "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo",
  "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti",
];

const STATUSES = [
  "Available", "Need Setup", "Need Checking", "Pending Profile",
  "Active", "Ready", "Delivered",
];
const COUNTRIES = ["US", "IT"];
const GENDERS = ["male", "female"];

async function ensureMakers(apply) {
  const out = [];
  for (const maker of SIM_MAKERS) {
    const existing = await User.findOne({ username: maker.username }).lean();
    if (existing) {
      out.push(existing);
      continue;
    }
    if (!apply) {
      out.push({ ...maker, _id: new mongoose.Types.ObjectId(), profiles: [] });
      continue;
    }
    const created = await User.create({
      username: maker.username,
      passwordHash: hashPassword("simpassword"),
      role: "maker",
      defaultCountry: maker.defaultCountry,
      profiles: [],
    });
    out.push(created.toObject());
  }
  return out;
}

function buildProfilePayload(country, makerIds) {
  const firstName =
    country === "IT" ? pick(FIRST_NAMES_IT) : pick(FIRST_NAMES_US);
  const lastName =
    country === "IT" ? pick(LAST_NAMES_IT) : pick(LAST_NAMES_US);
  const status = pick(STATUSES);
  const gender = pick(GENDERS);
  const createdDaysAgo = randInt(0, 6);
  const createdAt = randomTimeInDay(createdDaysAgo);

  const trackerCount = randInt(0, 3);
  const trackerLog = Array.from({ length: trackerCount }).map(() => {
    const daysAgo = randInt(0, 6);
    return {
      date: dateKey(randomTimeInDay(daysAgo)),
      note: pick([
        "Logged in OK",
        "Posted update",
        "Friend request accepted",
        "Profile photo refreshed",
        "Cover image updated",
        "Looks healthy",
      ]),
    };
  });

  // ~50% get an assigned maker recorded as createdBy
  const assignedMakerId =
    Math.random() < 0.5 ? pick(makerIds) : null;

  // ~55% have the Set Page onboarding step stamped within the last 7 days.
  // Of those, ~65% "passed" (a pageUrl was written back) and ~35% "failed"
  // (page step stamped but no pageUrl) — drives the Dashboard "Set Page" chart.
  const onboarding = {};
  let pageUrl = "";
  if (Math.random() < 0.55) {
    const pageSetDaysAgo = randInt(0, 6);
    onboarding.pageSetAt = randomTimeInDay(pageSetDaysAgo);
    if (Math.random() < 0.65) {
      pageUrl = `https://www.facebook.com/profile.php?id=${randInt(
        61500000000000,
        61599999999999,
      )}`;
    }
  }

  return {
    payload: {
      firstName,
      lastName,
      country,
      status,
      gender,
      tags: ["sim"],
      city: country === "IT" ? pick(["Milan", "Rome", "Florence", "Turin"]) : pick(["NYC", "Boston", "LA", "Chicago"]),
      createdBy: assignedMakerId || undefined,
      trackerLog,
      onboarding,
      pageUrl,
    },
    createdAt,
    assignedMakerId,
  };
}

async function clean(apply) {
  const usersRes = apply
    ? await User.deleteMany({ username: /^sim_/ })
    : { deletedCount: await User.countDocuments({ username: /^sim_/ }) };
  const profilesRes = apply
    ? await Profile.deleteMany({ tags: "sim" })
    : { deletedCount: await Profile.countDocuments({ tags: "sim" }) };
  return {
    users: usersRes.deletedCount || 0,
    profiles: profilesRes.deletedCount || 0,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.uri) {
    console.error("MONGODB_URI not set. Pass --uri or define it in server/.env.");
    process.exit(1);
  }

  console.log(args.apply ? "[apply mode] writing changes" : "[dry-run] no changes will be written");
  await mongoose.connect(args.uri);

  if (args.clean) {
    const removed = await clean(args.apply);
    console.log(
      `${args.apply ? "removed" : "would remove"}: ${removed.users} sim users, ${removed.profiles} sim profiles`,
    );
  }

  const makers = await ensureMakers(args.apply);
  console.log(`makers ready: ${makers.length} (${makers.map((m) => m.username).join(", ")})`);
  const makerIds = makers.map((m) => String(m._id));

  const created = [];
  const dayCounts = {};
  for (let i = 0; i < args.profiles; i += 1) {
    const country = pick(COUNTRIES);
    const built = buildProfilePayload(country, makerIds);
    const key = dateKey(built.createdAt);
    dayCounts[key] = (dayCounts[key] || 0) + 1;
    if (!args.apply) {
      created.push(built);
      continue;
    }
    // Override createdAt/updatedAt directly so Mongoose doesn't stamp now().
    const doc = new Profile(built.payload);
    doc.createdAt = built.createdAt;
    doc.updatedAt = built.createdAt;
    const saved = await doc.save({ timestamps: false });
    created.push({ ...built, _id: saved._id });
  }
  console.log(`profiles ${args.apply ? "created" : "would create"}: ${created.length}`);
  console.log("by day:", dayCounts);

  // Build assignments: ~70% of profiles get assigned to a maker; of those,
  // ~60% get marked completed with submittedAt spread across the past 7 days.
  const assignmentPlan = {};
  for (const maker of makers) assignmentPlan[String(maker._id)] = [];

  let assignedCount = 0;
  let submittedCount = 0;
  for (const entry of created) {
    if (Math.random() > 0.7) continue;
    const makerId = entry.assignedMakerId || pick(makerIds);
    const assignmentDaysAgo = randInt(0, 6);
    const assignedAt = randomTimeInDay(assignmentDaysAgo).toISOString();
    const isCompleted = Math.random() < 0.6;
    const submittedDaysAgo = randInt(0, assignmentDaysAgo);
    const submittedAt = isCompleted
      ? randomTimeInDay(submittedDaysAgo).toISOString()
      : "";
    assignmentPlan[makerId].push({
      profileId: entry._id || new mongoose.Types.ObjectId(),
      assignedAt,
      assignmentStatus: isCompleted ? "completed" : "pending",
      submittedAt,
    });
    assignedCount += 1;
    if (isCompleted) submittedCount += 1;
  }

  if (args.apply) {
    for (const maker of makers) {
      const additions = assignmentPlan[String(maker._id)];
      if (!additions.length) continue;
      await User.updateOne(
        { _id: maker._id },
        { $push: { profiles: { $each: additions } } },
      );
    }
  }

  console.log(
    `assignments ${args.apply ? "added" : "would add"}: ${assignedCount} total (${submittedCount} marked completed with submittedAt)`,
  );
  for (const maker of makers) {
    const list = assignmentPlan[String(maker._id)];
    const submitted = list.filter((a) => a.assignmentStatus === "completed").length;
    console.log(`  ${maker.username}: ${list.length} assigned, ${submitted} submitted`);
  }

  await mongoose.disconnect();
  console.log("done.");
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
