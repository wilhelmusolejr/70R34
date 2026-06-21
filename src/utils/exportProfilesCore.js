// Pure, environment-agnostic profile-export logic shared by the in-app export
// (src/components/ExportProfilesModal.jsx via src/utils/exportProfiles.js) and
// the CLI export (server/src/scripts/export-ready-profiles.js). Keep this file
// free of browser/Node-only APIs (no DOM, no fs) so both can import it.

export const EXPORT_COLUMNS = [
  ["country", "Country"],
  ["name", "First Name Last Name"],
  ["email", "Email"],
  ["emailPassword", "Email Password"],
  ["facebookPassword", "Facebook Password"],
  ["profileUrl", "Profile URL"],
  ["friends", "Friends"],
];

function getSelectedEmail(profile) {
  return (
    (profile?.emails || []).find((entry) => entry?.selected)?.address ||
    profile?.emails?.[0]?.address ||
    ""
  );
}

// Friends: if below 30, replace with a random integer 30-40 (inclusive).
export function normalizeFriends(value, boost = true) {
  const friends = Number(value) || 0;
  if (boost && friends < 30) {
    return Math.floor(Math.random() * 11) + 30;
  }
  return friends;
}

export function buildExportRows(profiles, { boostFriends = true } = {}) {
  return profiles.map((profile) => ({
    country: profile.country || "",
    name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
    email: getSelectedEmail(profile),
    emailPassword: profile.emailPassword || "",
    facebookPassword: profile.facebookPassword || "",
    profileUrl: profile.profileUrl || "",
    friends: normalizeFriends(profile.friends, boostFriends),
  }));
}

function csvCell(value) {
  const str = value === undefined || value === null ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows) {
  const header = EXPORT_COLUMNS.map(([, label]) => csvCell(label)).join(",");
  const body = rows.map((row) =>
    EXPORT_COLUMNS.map(([key]) => csvCell(row[key])).join(","),
  );
  return [header, ...body].join("\n") + "\n";
}

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

// Slug for a filename part: lowercase, spaces/punctuation → "-", "+" preserved
// (so a multi-status scope like "Available+Ready" stays readable).
function slugifyScope(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Builds the COUNT-STATUS-DATE base name (no extension) shared by both export
// paths, e.g. exportFileBaseName({ count: 42, scope: "Available", date:
// "2026-06-22" }) -> "42-available-2026-06-22".
export function exportFileBaseName({ count, scope, date }) {
  return `${count}-${slugifyScope(scope) || "profiles"}-${date}`;
}

// SpreadsheetML 2003 XML — opens natively in Excel as .xls.
export function rowsToXls(rows) {
  const headerRow = xmlRow(EXPORT_COLUMNS.map(([, label]) => xmlCell(label)));
  const dataRows = rows.map((row) =>
    xmlRow(EXPORT_COLUMNS.map(([key]) => xmlCell(row[key]))),
  );
  return (
    `<?xml version="1.0"?>\n` +
    `<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n` +
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n` +
    `<Worksheet ss:Name="Profiles"><Table>\n` +
    [headerRow, ...dataRows].join("\n") +
    `\n</Table></Worksheet>\n</Workbook>\n`
  );
}
