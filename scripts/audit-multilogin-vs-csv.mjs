/* global process */
import fs from "node:fs";
import path from "node:path";

const API_BASE = process.env.API_BASE || "https://7or34.space";
const CSV_FILE = process.env.CSV_FILE || "ready-profiles.csv";

const BROWSER_IDS = [
  "29a7a26a-7b5c-44cf-833c-74324f8a9415",
  "6ab65757-ce6d-4dc0-b392-a806f4960216",
  "cc2197ac-4fcd-451c-9723-0f0a8398cdcb",
  "10d8df74-05ae-4607-a866-c8c5b9041980",
  "8db9a436-7c0c-4e9c-94a6-ae86527700f3",
  "038c4b92-218b-4061-a26b-faf626c9057a",
  "fbd3bcee-da6c-4b58-9bcd-0beedf993fa7",
  "7cc6a6e3-91ef-44a6-8dd7-7a22991d9db4",
  "4bd853d5-efcc-4500-8e66-5dc8b210ca0f",
  "d76e917f-bff9-492a-9d5f-bf6f4cf453db",
  "b976a3c2-e08f-4f89-93b3-504fbf841771",
  "72d49b90-61ea-42c5-bb98-8df0efc21d09",
  "d00571ba-7cff-4f51-b167-102b8a5b42e2",
  "e3b397b6-74a3-4125-b67d-db281145ab90",
  "0414b128-ed00-4c79-a3f4-6edb9ca5e6ad",
  "34af0792-6658-46ae-bf4d-9044dc66e0d0",
  "2b99cb03-c616-4364-82e9-482fd1deb13a",
  "09488094-082d-484e-9a24-b2828a8afb74",
  "3563b8b6-70f6-4098-8f91-200b4444fc50",
  "d7a8c455-94f7-4750-a6eb-fb04da42a1c1",
  "ebff3cff-345a-4a55-8aad-9df71ad15559",
  "889870e3-06a4-42f8-ae65-6a3a4911c4c6",
  "c9a7abe3-ab9a-45d6-9bed-d8653c1aa8bf",
  "222d8495-7469-497c-82ce-b32bf9067b09",
  "35ea2055-d8f1-4a1d-81a6-d7509e83cd17",
  "4a9ea96f-b9e2-4483-ab7a-081597efff7a",
  "59480e4b-a6f3-4fe2-bd47-2e3f7e1fc1fb",
  "b027ed24-366d-40bf-b33b-964d9405a552",
  "22b431cc-a057-4a45-9130-4475e94f473c",
  "8644881e-3cd5-4077-a13b-2faf042546eb",
  "44be6896-b432-4618-952a-fe45206e0d45",
  "92562148-2a0b-4836-bc0f-bb18cf2b3b19",
  "ab97ab03-0592-4c35-b638-1f0e5db889ca",
  "aac89090-308b-4341-a001-dee0c2c4014c",
  "bb6c5584-077d-4a8b-a5e1-dfa5e0862dd8",
  "874f8cd8-cef0-474c-8bff-7cc9fc4cbc5b",
  "f115d2e0-49b5-48e2-93f1-4d4eb090b375",
  "8b369557-b5cc-4736-9dbe-fb3561b2af2d",
  "ae4ff720-08f0-46e9-bd02-7834e73a94eb",
  "7a32a6d7-ffa2-4ed5-94cd-eb43ed1689f7",
  "426822df-9c63-40e0-bbf0-cb844cfb7ea4",
  "a3d734e3-bc71-4a8b-941b-a448cc77a45e",
  "20ce60df-0636-4e34-b16e-fdf93a5c8040",
  "f3e0d5a4-a97f-4f3b-9be9-e2f4c4e198d6",
  "526e286c-9e27-4551-89b8-57701a9fad85",
  "371ae105-d08e-42ea-9436-2e1cb7d1ab23",
  "14323d61-f97d-4039-a9b9-659a1e8104e0",
  "bdd322c9-e338-4c2a-a223-3f16b9b847eb",
];

const targetSet = new Set(BROWSER_IDS.map((id) => id.toLowerCase()));
console.log(`Browser IDs provided: ${BROWSER_IDS.length}`);

const res = await fetch(`${API_BASE}/api/profiles`);
if (!res.ok) {
  console.error(`GET /api/profiles failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const profiles = await res.json();
console.log(`Profiles fetched from API: ${profiles.length}`);

const idToProfile = new Map();
const matched = [];
for (const p of profiles) {
  for (const b of p.browsers || []) {
    const bid = String(b?.browserId || "").toLowerCase();
    const provider = String(b?.provider || "").toLowerCase();
    if (!bid) continue;
    if (provider !== "multilogin") continue;
    if (targetSet.has(bid)) {
      idToProfile.set(bid, p);
      matched.push({ browserId: bid, profile: p });
    }
  }
}

const missingIds = BROWSER_IDS.filter((id) => !idToProfile.has(id.toLowerCase()));

console.log(`Matched profiles (multilogin + in list): ${idToProfile.size}`);
console.log(`Browser IDs with no matching multilogin profile: ${missingIds.length}`);

const csvPath = path.resolve(process.cwd(), CSV_FILE);
const csv = fs.readFileSync(csvPath, "utf8");
const csvLines = csv.split(/\r?\n/).filter(Boolean);
const csvEmails = new Set(
  csvLines.slice(1).map((line) => {
    const firstCol = line.split(",")[0];
    return firstCol.replace(/^"|"$/g, "").toLowerCase();
  }),
);
console.log(`CSV rows (excl header): ${csvLines.length - 1}`);

const inListNotInCsv = [];
for (const { browserId, profile } of matched) {
  const email =
    (profile.emails || []).find((e) => e?.selected)?.address ||
    profile.emails?.[0]?.address ||
    "";
  if (!csvEmails.has(email.toLowerCase())) {
    inListNotInCsv.push({
      browserId,
      name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim(),
      email,
      status: profile.status,
      profileUrl: profile.profileUrl || "",
    });
  }
}

console.log(`\n--- In your folder (multilogin) but NOT in CSV: ${inListNotInCsv.length} ---`);
for (const row of inListNotInCsv) {
  console.log(
    `  ${row.name.padEnd(28)} | ${row.email.padEnd(40)} | status=${row.status} | ${row.browserId}`,
  );
}

if (missingIds.length) {
  console.log(`\n--- Browser IDs with NO matching multilogin profile in DB (${missingIds.length}) ---`);
  for (const id of missingIds) {
    // Look for it under any provider as a hint
    const anyProvider = profiles.find((p) =>
      (p.browsers || []).some(
        (b) => String(b?.browserId || "").toLowerCase() === id.toLowerCase(),
      ),
    );
    if (anyProvider) {
      const otherProvider = (anyProvider.browsers || []).find(
        (b) => String(b?.browserId || "").toLowerCase() === id.toLowerCase(),
      )?.provider;
      console.log(
        `  ${id}  -> found on ${anyProvider.firstName} ${anyProvider.lastName} but provider="${otherProvider}"`,
      );
    } else {
      console.log(`  ${id}  -> not on ANY profile in the DB`);
    }
  }
}
