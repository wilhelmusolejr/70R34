/* global process */
import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.API_BASE || "https://7or34.space";
const OUTPUT_FILE = process.env.OUTPUT_FILE || "ready-profiles.csv";

const TARGET_NAMES = [
  "Magnolia Crowe",
  "Kayla Hoffman",
  "Patrick Doyle",
  "Gregory Patton",
  "Jessica Payne",
  "Persephone Nair",
  "Lavinia Goode",
  "Preston Gamble",
  "Mitchell Kirby",
  "Danielle Bennett",
  "Robert Miller",
  "Marcus Chen",
  "Henry Estaben",
  "Jefferson Smithen",
];

const norm = (s) => String(s || "").trim().toLowerCase();
const targets = new Set(TARGET_NAMES.map(norm));

const res = await fetch(`${API_BASE}/api/profiles`);
if (!res.ok) {
  console.error(`GET /api/profiles failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const profiles = await res.json();

const matches = [];
const matchedTargets = new Set();
for (const p of profiles) {
  const full = norm(`${p.firstName || ""} ${p.lastName || ""}`);
  if (targets.has(full)) {
    matches.push(p);
    matchedTargets.add(full);
  }
}

const missing = TARGET_NAMES.filter((n) => !matchedTargets.has(norm(n)));

const rows = matches.map((p) => ({
  email:
    (p.emails || []).find((e) => e?.selected)?.address ||
    p.emails?.[0]?.address ||
    "",
  emailPassword: p.emailPassword || "",
  facebookPassword: p.facebookPassword || "",
  profileUrl: p.profileUrl || "",
  friends: p.friends || 0,
}));

const columns = [
  ["email", "Email"],
  ["emailPassword", "Email Password"],
  ["facebookPassword", "Facebook Password"],
  ["profileUrl", "Profile URL"],
  ["friends", "Friends"],
];

function csvCell(value) {
  const str = value === undefined || value === null ? "" : String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const outputPath = path.resolve(process.cwd(), OUTPUT_FILE);
const exists = fs.existsSync(outputPath);

let out = "";
if (!exists) {
  out += columns.map(([, label]) => csvCell(label)).join(",") + "\n";
}
for (const row of rows) {
  out += columns.map(([key]) => csvCell(row[key])).join(",") + "\n";
}

fs.appendFileSync(outputPath, out, "utf8");

console.log(`Appended ${rows.length} profile(s) to ${outputPath}`);
if (missing.length) {
  console.log(`Not found (${missing.length}): ${missing.join(", ")}`);
}
