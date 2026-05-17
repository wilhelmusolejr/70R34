/* global process, fetch */

const API_BASE = process.env.API_BASE || "https://7or34.space";

const updates = [
  { email: "jonathan92reed@outlook.com",       profileUrl: "https://www.facebook.com/profile.php?id=61589672670706" },
  { email: "steven88sullivan@outlook.com",     profileUrl: "https://www.facebook.com/profile.php?id=61589667691160" },
  { email: "carol97brown@outlook.com",         profileUrl: "https://www.facebook.com/profile.php?id=61589440210921" },
  { email: "nicholas2000thompson@outlook.com", profileUrl: "https://www.facebook.com/profile.php?id=61589264927885" },
  { email: "abigail92rivera@outlook.com",      profileUrl: "https://www.facebook.com/profile.php?id=61589715119075" },
  { email: "anthony83mitchell@outlook.com",    profileUrl: "https://www.facebook.com/profile.php?id=61589308756694" },
  { email: "natalie92gray@outlook.com",        profileUrl: "https://www.facebook.com/profile.php?id=61589771340793" },
  { email: "juan95stewart@outlook.com",        profileUrl: "https://www.facebook.com/profile.php?id=61589813909087" },
];

const norm = (value) => String(value || "").trim().toLowerCase();

const listRes = await fetch(`${API_BASE}/api/profiles`);
if (!listRes.ok) {
  console.error(`GET /api/profiles failed: ${listRes.status} ${listRes.statusText}`);
  process.exit(1);
}
const profiles = await listRes.json();
console.log(`Fetched ${profiles.length} profiles from ${API_BASE}\n`);

const notFound = [];
const failed = [];
const updated = [];

for (const entry of updates) {
  const target = norm(entry.email);
  const match = profiles.find((p) =>
    (p.emails || []).some((e) => norm(e?.address) === target),
  );

  if (!match) {
    notFound.push(entry.email);
    console.log(`NOT FOUND: ${entry.email}`);
    continue;
  }

  const currentEmails = Array.isArray(match.emails) ? match.emails : [];
  const matchedEmail = currentEmails.find((e) => norm(e?.address) === target);
  const wasAlreadySelected = Boolean(matchedEmail?.selected);

  // Rebuild emails: target one selected, all others unselected. Preserve other fields.
  const nextEmails = currentEmails.map((e) => ({
    ...e,
    selected: norm(e?.address) === target,
  }));

  const body = {
    status: "Flagged",
    profileUrl: entry.profileUrl,
    emails: nextEmails,
  };
  if (entry.emailPassword) body.emailPassword = entry.emailPassword;

  const patchRes = await fetch(`${API_BASE}/api/profiles/${match._id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!patchRes.ok) {
    const text = await patchRes.text();
    failed.push({ email: entry.email, status: patchRes.status, text });
    console.error(`FAILED ${entry.email}: ${patchRes.status} ${patchRes.statusText} - ${text}`);
    continue;
  }

  updated.push(entry.email);
  console.log(
    `UPDATED: ${match._id}  ${match.firstName} ${match.lastName}  <${entry.email}>` +
      `  emailSelected:${wasAlreadySelected ? "was-true" : "set-true"}` +
      (entry.emailPassword ? `  emailPassword:set` : "") +
      `  -> Flagged`,
  );
}

console.log("\n=== SUMMARY ===");
console.log(`Updated:   ${updated.length}/${updates.length}`);
console.log(`Not found: ${notFound.length}`);
console.log(`Failed:    ${failed.length}`);

if (notFound.length) {
  console.log("\nNOT FOUND (no profile contained this email):");
  notFound.forEach((e) => console.log(`  - ${e}`));
}
if (failed.length) {
  console.log("\nFAILED (PATCH errored):");
  failed.forEach((f) => console.log(`  - ${f.email}  [${f.status}] ${f.text}`));
}

process.exit(0);
