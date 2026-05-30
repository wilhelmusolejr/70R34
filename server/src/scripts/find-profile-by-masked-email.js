/* global process */

// Find which profile(s) a MASKED email hint belongs to.
//
// You paste a recovery hint like the ones Facebook / Google show during
// account recovery (e.g. "la**d@outlook.com") and this prints the matching
// profiles from your vault. Each wildcard char ( * • · ? ) stands for ONE
// hidden character.
//
//   node server/src/scripts/find-profile-by-masked-email.js "la**d@outlook.com"
//   node server/src/scripts/find-profile-by-masked-email.js            # then type it when prompted
//   node server/src/scripts/find-profile-by-masked-email.js "la**d@o***ok.com" --loose
//
//   API_BASE=http://localhost:4000 node server/src/scripts/find-profile-by-masked-email.js "la**d@outlook.com"

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const API_BASE = process.env.API_BASE || "https://7or34.space";
const WILDCARD = /[*•·?]/; // glyphs services use to hide characters

const norm = (value) => String(value || "").trim().toLowerCase();

// Strip trailing junk a copy-paste often carries (the example had a trailing ".").
function cleanPattern(raw) {
  return norm(raw).replace(/[\s.]+$/, "");
}

// Turn "la**d@outlook.com" into an anchored, case-insensitive RegExp.
// strict  : each wildcard = exactly one character  ->  la..d@outlook\.com
// loose   : a run of wildcards = one-or-more chars ->  la.+d@outlook\.com
function patternToRegex(pattern, { loose }) {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (WILDCARD.test(ch)) {
      if (loose) {
        // collapse a consecutive run of wildcards into a single .+
        while (i + 1 < pattern.length && WILDCARD.test(pattern[i + 1])) i += 1;
        out += ".+";
      } else {
        out += ".";
      }
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex specials
    }
  }
  return new RegExp(`^${out}$`, "i");
}

// Every email-ish address on a profile, tagged with where it came from.
function addressesOf(profile) {
  const out = [];
  for (const e of profile.emails || []) {
    if (e?.address) out.push({ field: e.selected ? "email*" : "email", value: e.address });
  }
  if (profile.recoveryEmail) out.push({ field: "recovery", value: profile.recoveryEmail });
  return out;
}

function search(profiles, regex) {
  const hits = [];
  for (const p of profiles) {
    for (const { field, value } of addressesOf(p)) {
      if (regex.test(norm(value))) {
        hits.push({ profile: p, field, value });
      }
    }
  }
  return hits;
}

function printHits(hits) {
  hits.forEach(({ profile, field, value }, i) => {
    const name = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || "(no name)";
    const status = profile.status || "?";
    const url = profile.profileUrl ? `  ${profile.profileUrl}` : "";
    console.log(
      `  ${String(i + 1).padStart(2)}. ${profile._id}  ${name}  [${status}]  <${value}> (${field})${url}`,
    );
  });
}

async function getPattern(argv) {
  const fromArg = argv.find((a) => !a.startsWith("--"));
  if (fromArg) return fromArg;
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question("Masked email (e.g. la**d@outlook.com): ");
  rl.close();
  return answer;
}

async function main() {
  const argv = process.argv.slice(2);
  const forceLoose = argv.includes("--loose");

  const raw = await getPattern(argv);
  const pattern = cleanPattern(raw);
  if (!pattern) {
    console.error("No pattern given. Example: la**d@outlook.com");
    process.exit(1);
  }
  if (!WILDCARD.test(pattern)) {
    console.log(`Note: "${pattern}" has no wildcard ( * • · ? ) — matching it literally.`);
  }

  const res = await fetch(`${API_BASE}/api/profiles`);
  if (!res.ok) {
    console.error(`GET /api/profiles failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const profiles = await res.json();
  console.log(`Searching ${profiles.length} profiles for "${pattern}" ...\n`);

  // strict first; fall back to loose unless the user pinned a mode.
  let mode = forceLoose ? "loose" : "strict";
  let hits = search(profiles, patternToRegex(pattern, { loose: forceLoose }));

  if (!hits.length && !forceLoose) {
    const looseHits = search(profiles, patternToRegex(pattern, { loose: true }));
    if (looseHits.length) {
      mode = "loose (strict found none)";
      hits = looseHits;
    }
  }

  if (!hits.length) {
    console.log("No matching profile found.");
    console.log("Tips: each * = one hidden char. If the hint hides a variable number, add --loose.");
    process.exit(0);
  }

  console.log(`Match mode: ${mode}`);
  console.log(`Found ${hits.length} match${hits.length === 1 ? "" : "es"}:`);
  printHits(hits);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
