/* global process */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { connectToDatabase } from "../config/db.js";
import { Profile } from "../models/Profile.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../../../profile_data.json");
const APPLY = process.argv.includes("--apply");
const PROVIDER = "multilogin";

const entries = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

// Two name-split strategies — first wins. Handles "Gregory S. Vance" either as
// firstName "Gregory" / lastName "S. Vance" or firstName "Gregory S." / lastName "Vance".
function nameCandidates(fullName) {
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length < 2) return [];
  const first = parts[0];
  const restAsLast = parts.slice(1).join(" ");
  const lead = parts.slice(0, -1).join(" ");
  const tail = parts[parts.length - 1];
  const seen = new Set();
  const out = [];
  for (const c of [
    { firstName: first, lastName: restAsLast },
    { firstName: lead, lastName: tail },
  ]) {
    const key = `${c.firstName}|${c.lastName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

await connectToDatabase(process.env.MONGODB_URI);

const summary = {
  matched: 0,
  added: 0,
  alreadyHad: 0,
  ambiguous: [],
  notFound: [],
};

for (const entry of entries) {
  const { fullName, profile_id: browserId } = entry;
  if (!fullName || !browserId) continue;

  let matches = [];
  for (const { firstName, lastName } of nameCandidates(fullName)) {
    matches = await Profile.find({
      firstName: new RegExp(`^${firstName}$`, "i"),
      lastName: new RegExp(`^${lastName}$`, "i"),
    });
    if (matches.length) break;
  }

  if (matches.length === 0) {
    summary.notFound.push(fullName);
    continue;
  }
  if (matches.length > 1) {
    summary.ambiguous.push({
      fullName,
      ids: matches.map((m) => String(m._id)),
    });
    continue;
  }

  const profile = matches[0];
  summary.matched += 1;

  const already = profile.browsers.some(
    (b) => b.browserId === browserId && b.provider === PROVIDER,
  );
  if (already) {
    summary.alreadyHad += 1;
    console.log(`= ${fullName} (${profile._id}) already has ${browserId}`);
    continue;
  }

  if (APPLY) {
    profile.browsers.push({ browserId, provider: PROVIDER });
    await profile.save();
  }
  summary.added += 1;
  console.log(
    `${APPLY ? "+" : "~"} ${fullName} (${profile._id}) <- ${browserId}`,
  );
}

console.log("\n--- Summary ---");
console.log(`Mode:        ${APPLY ? "APPLY" : "DRY-RUN (pass --apply to write)"}`);
console.log(`Matched:     ${summary.matched}`);
console.log(`Added:       ${summary.added}`);
console.log(`Already had: ${summary.alreadyHad}`);
console.log(`Not found:   ${summary.notFound.length}`);
if (summary.notFound.length) console.log("  ", summary.notFound.join(", "));
console.log(`Ambiguous:   ${summary.ambiguous.length}`);
if (summary.ambiguous.length) console.log(JSON.stringify(summary.ambiguous, null, 2));

process.exit(0);
