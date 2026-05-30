/* global process */

import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.API_BASE || "https://7or34.space";
const OUTPUT_FILE = process.env.OUTPUT_FILE || "ready-profiles.csv";

const listRes = await fetch(`${API_BASE}/api/profiles?status=Ready`);
if (!listRes.ok) {
  console.error(`GET /api/profiles failed: ${listRes.status} ${listRes.statusText}`);
  process.exit(1);
}

const profiles = await listRes.json();
const result = profiles
  .filter((profile) => profile.status === "Ready")
  .map((profile) => ({
    email:
      (profile.emails || []).find((entry) => entry?.selected)?.address ||
      profile.emails?.[0]?.address ||
      "",
    emailPassword: profile.emailPassword || "",
    facebookPassword: profile.facebookPassword || "",
    profileUrl: profile.profileUrl || "",
    friends: profile.friends || 0,
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
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const header = columns.map(([, label]) => csvCell(label)).join(",");
const rows = result.map((row) =>
  columns.map(([key]) => csvCell(row[key])).join(","),
);
const csv = [header, ...rows].join("\n") + "\n";

const outputPath = path.resolve(process.cwd(), OUTPUT_FILE);
fs.writeFileSync(outputPath, csv, "utf8");

console.log(`Exported ${result.length} Ready profiles to ${outputPath}`);
process.exit(0);
