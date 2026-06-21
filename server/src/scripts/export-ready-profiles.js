/* global process */

import fs from "node:fs";
import path from "node:path";

import {
  buildExportRows,
  exportFileBaseName,
  rowsToCsv,
  rowsToXls,
} from "../../../src/utils/exportProfilesCore.js";

const API_BASE = process.env.API_BASE || "https://7or34.space";

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

// When IDs are supplied we still need the full list (there is no bulk-by-id
// endpoint) and filter locally. Otherwise the API filters by status for us
// (GET /api/profiles?status=...).
const listUrl = idSet.size
  ? `${API_BASE}/api/profiles`
  : `${API_BASE}/api/profiles?status=${encodeURIComponent(STATUS)}`;

const listRes = await fetch(listUrl);
if (!listRes.ok) {
  console.error(
    `GET ${listUrl} failed: ${listRes.status} ${listRes.statusText}`,
  );
  process.exit(1);
}

const profiles = await listRes.json();

// If IDs were supplied, filter by them (order follows the supplied IDs).
// Otherwise the server already returned only the requested status.
let selected;
if (idSet.size) {
  const byId = new Map(profiles.map((p) => [String(p._id), p]));
  selected = [...idSet].map((id) => byId.get(id)).filter(Boolean);
  const missing = [...idSet].filter((id) => !byId.has(id));
  if (missing.length) {
    console.warn(
      `Warning: ${missing.length} id(s) not found:\n  ${missing.join("\n  ")}`,
    );
  }
} else {
  selected = profiles;
}

const rows = buildExportRows(selected);

// COUNT-STATUS-DATE base name, e.g. 42-available-2026-06-22. Override either
// file name explicitly with OUTPUT_FILE / XLS_FILE.
const baseName = exportFileBaseName({
  count: rows.length,
  scope: idSet.size ? "by-id" : STATUS,
  date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
});
const csvFile = process.env.OUTPUT_FILE || `${baseName}.csv`;
const xlsFile = process.env.XLS_FILE || csvFile.replace(/\.csv$/i, ".xls");

const outputPath = path.resolve(process.cwd(), csvFile);
fs.writeFileSync(outputPath, rowsToCsv(rows), "utf8");

const xlsPath = path.resolve(process.cwd(), xlsFile);
fs.writeFileSync(xlsPath, rowsToXls(rows), "utf8");

const mode = idSet.size
  ? `${rows.length} profile(s) by id`
  : `${rows.length} "${STATUS}" profile(s)`;
console.log(`Exported ${mode}:\n  ${outputPath}\n  ${xlsPath}`);
process.exit(0);
