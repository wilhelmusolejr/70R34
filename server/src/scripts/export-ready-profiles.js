/* global process */

import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.API_BASE || "https://7or34.space";
const OUTPUT_FILE = process.env.OUTPUT_FILE || "ready-profiles.csv";
const XLS_FILE = process.env.XLS_FILE || OUTPUT_FILE.replace(/\.csv$/i, ".xls");

// Which status to export when no IDs are supplied. Change this string, or
// override at runtime with:  STATUS="Ready" node src/scripts/export-ready-profiles.js
// Valid: Available | Need Setup | Pending Profile | Active | Flagged | Banned | Ready | Delivered
const STATUS = process.env.STATUS || "Available";

// ---------------------------------------------------------------------------
// PUT YOUR PROFILE IDS HERE (MongoDB _id strings, one per line).
// Leave the array empty to fall back to the old behaviour (all "Available").
// You can also pass them at runtime instead of editing this file:
//   - env var:  PROFILE_IDS="id1,id2,id3"
//   - a file:   profile-ids.txt  (one id per line; # comments allowed)
// ---------------------------------------------------------------------------
const IDS = [
  // "665f0a1b2c3d4e5f6a7b8c9d",
  // "665f0a1b2c3d4e5f6a7b8c9e",
];

function loadIds() {
  const ids = new Set(IDS.map((s) => String(s).trim()).filter(Boolean));

  if (process.env.PROFILE_IDS) {
    for (const raw of process.env.PROFILE_IDS.split(/[\s,]+/)) {
      const id = raw.trim();
      if (id) ids.add(id);
    }
  }

  const idsFile = path.resolve(process.cwd(), "profile-ids.txt");
  if (fs.existsSync(idsFile)) {
    for (const line of fs.readFileSync(idsFile, "utf8").split(/\r?\n/)) {
      const id = line.replace(/#.*$/, "").trim();
      if (id) ids.add(id);
    }
  }

  return ids;
}

const idSet = loadIds();

// NOTE: the API does not support ?status= filtering (it returns an empty array),
// so we fetch the full list and filter client-side.
const listRes = await fetch(`${API_BASE}/api/profiles`);
if (!listRes.ok) {
  console.error(
    `GET /api/profiles failed: ${listRes.status} ${listRes.statusText}`,
  );
  process.exit(1);
}

const profiles = await listRes.json();

// Friends: if below 30, replace with a random integer 30-40 (inclusive).
function normalizeFriends(value) {
  const friends = Number(value) || 0;
  if (friends < 30) {
    return Math.floor(Math.random() * 11) + 30;
  }
  return friends;
}

// If IDs were supplied, filter by them (order follows the supplied IDs).
// Otherwise keep the original "Available" behaviour.
const selected = idSet.size
  ? profiles.filter((p) => idSet.has(String(p._id)))
  : profiles.filter((p) => p.status === STATUS);

if (idSet.size) {
  const found = new Set(selected.map((p) => String(p._id)));
  const missing = [...idSet].filter((id) => !found.has(id));
  if (missing.length) {
    console.warn(`Warning: ${missing.length} id(s) not found:\n  ${missing.join("\n  ")}`);
  }
}

const result = selected.map((profile) => ({
  country: profile.country || "",
  name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
  email:
    (profile.emails || []).find((entry) => entry?.selected)?.address ||
    profile.emails?.[0]?.address ||
    "",
  emailPassword: profile.emailPassword || "",
  facebookPassword: profile.facebookPassword || "",
  profileUrl: profile.profileUrl || "",
  friends: normalizeFriends(profile.friends),
}));

const columns = [
  ["country", "Country"],
  ["name", "First Name Last Name"],
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

// --- Excel (SpreadsheetML 2003 XML — opens natively in Excel as .xls) -------
function xmlCell(value) {
  const str = value === undefined || value === null ? "" : String(value);
  const escaped = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const isNumber = typeof value === "number" && Number.isFinite(value);
  const type = isNumber ? "Number" : "String";
  return `<Cell><Data ss:Type="${type}">${escaped}</Data></Cell>`;
}

function xmlRow(cells) {
  return `<Row>${cells.join("")}</Row>`;
}

const headerRow = xmlRow(columns.map(([, label]) => xmlCell(label)));
const dataRows = result.map((row) =>
  xmlRow(columns.map(([key]) => xmlCell(row[key]))),
);

const xls =
  `<?xml version="1.0"?>\n` +
  `<?mso-application progid="Excel.Sheet"?>\n` +
  `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n` +
  ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n` +
  `<Worksheet ss:Name="Profiles"><Table>\n` +
  [headerRow, ...dataRows].join("\n") +
  `\n</Table></Worksheet>\n</Workbook>\n`;

const xlsPath = path.resolve(process.cwd(), XLS_FILE);
fs.writeFileSync(xlsPath, xls, "utf8");

const mode = idSet.size ? `${result.length} profile(s) by id` : `${result.length} "${STATUS}" profile(s)`;
console.log(`Exported ${mode}:\n  ${outputPath}\n  ${xlsPath}`);
process.exit(0);
