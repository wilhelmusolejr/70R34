/* global process */

import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.API_BASE || "https://7or34.space";
const OUTPUT_FILE = process.env.OUTPUT_FILE || "ready-profiles.xls";

const profileIds = [
  // Paste profile IDs here, one per line:
  // "6a01899c9ceed638ddd6abc6",
];

const selectedProfileIds = new Set(
  profileIds
    .map((id) => String(id || "").trim())
    .filter(Boolean),
);

const listRes = await fetch(`${API_BASE}/api/profiles`);
if (!listRes.ok) {
  console.error(`GET /api/profiles failed: ${listRes.status} ${listRes.statusText}`);
  process.exit(1);
}

const profiles = await listRes.json();
const result = profiles
  .filter((profile) => profile.status === "Ready")
  .filter((profile) => !selectedProfileIds.size || selectedProfileIds.has(String(profile._id || profile.id)))
  .map((profile) => ({
    email:
      (profile.emails || []).find((entry) => entry?.selected)?.address ||
      profile.emails?.[0]?.address ||
      "",
    emailPassword: profile.emailPassword || "",
    facebookPassword: profile.facebookPassword || "",
    friends: profile.friends || 0,
    profileUrl: profile.profileUrl || "",
  }));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const columns = [
  ["email", "Email"],
  ["emailPassword", "Email Password"],
  ["facebookPassword", "Facebook Password"],
  ["profileUrl", "Profile URL"],
  ["friends", "Friends"],
];

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    table { border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 6px 10px; white-space: nowrap; }
    th { font-weight: bold; background: #f2f2f2; }
  </style>
</head>
<body>
  <table>
    <thead>
      <tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${result
        .map(
          (row) =>
            `<tr>${columns
              .map(([key]) => `<td>${escapeHtml(row[key])}</td>`)
              .join("")}</tr>`,
        )
        .join("\n      ")}
    </tbody>
  </table>
</body>
</html>
`;

const outputPath = path.resolve(process.cwd(), OUTPUT_FILE);
fs.writeFileSync(outputPath, html, "utf8");

console.log(`Exported ${result.length} Ready profiles to ${outputPath}`);
process.exit(0);
