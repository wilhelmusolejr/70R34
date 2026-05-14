/* global process, fetch */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = process.env.API_BASE || "https://7or34.space";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");
const inputFile = path.resolve(projectRoot, "friendRequest.json");

const norm = (value) => String(value || "").trim().toLowerCase();
const fullName = (p) => `${p?.firstName || ""} ${p?.lastName || ""}`.trim();

const raw = JSON.parse(readFileSync(inputFile, "utf8"));
const senderId = String(raw?.senderId || "").trim();
const receivers = Array.isArray(raw?.receiverId) ? raw.receiverId : [];

if (!senderId) {
  console.error(`senderId is empty in ${inputFile}. Fill it in first.`);
  process.exit(1);
}
if (!/^[0-9a-fA-F]{24}$/.test(senderId)) {
  console.error(`senderId is not a 24-char ObjectId: "${senderId}"`);
  process.exit(1);
}
if (!receivers.length) {
  console.error(`receiverId list is empty in ${inputFile}.`);
  process.exit(1);
}

const listRes = await fetch(`${API_BASE}/api/profiles`);
if (!listRes.ok) {
  console.error(`GET /api/profiles failed: ${listRes.status} ${listRes.statusText}`);
  process.exit(1);
}
const profiles = await listRes.json();
console.log(`Fetched ${profiles.length} profiles from ${API_BASE}`);

const sender = profiles.find((p) => String(p._id) === senderId);
if (!sender) {
  console.error(`senderId ${senderId} does not match any profile.`);
  process.exit(1);
}
console.log(`Sender: ${sender._id}  ${fullName(sender) || "(no name)"}\n`);

const added = [];
const duplicate = [];
const notFound = [];
const ambiguous = [];
const failed = [];

for (const name of receivers) {
  const target = norm(name);
  if (!target) continue;

  const matches = profiles.filter((p) => norm(fullName(p)) === target);

  if (matches.length === 0) {
    notFound.push(name);
    console.log(`NOT FOUND: ${name}`);
    continue;
  }
  if (matches.length > 1) {
    ambiguous.push({ name, ids: matches.map((m) => String(m._id)) });
    console.log(
      `AMBIGUOUS: ${name} -> ${matches.length} matches [${matches.map((m) => m._id).join(", ")}]`,
    );
    continue;
  }

  const receiver = matches[0];
  if (String(receiver._id) === senderId) {
    failed.push({ name, status: 0, text: "receiver equals sender" });
    console.log(`SKIPPED (self): ${name}  ${receiver._id}`);
    continue;
  }

  const postRes = await fetch(
    `${API_BASE}/api/profiles/${receiver._id}/friend-requests`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderProfileId: senderId }),
    },
  );

  if (postRes.status === 409) {
    duplicate.push({ name, id: String(receiver._id) });
    console.log(`DUPLICATE: ${name}  ${receiver._id}  (already has request from sender)`);
    continue;
  }

  if (!postRes.ok) {
    const text = await postRes.text();
    failed.push({ name, status: postRes.status, text });
    console.error(
      `FAILED ${name} (${receiver._id}): ${postRes.status} ${postRes.statusText} - ${text}`,
    );
    continue;
  }

  added.push({ name, id: String(receiver._id) });
  console.log(`ADDED: ${receiver._id}  ${name}  <- ${senderId}  (Pending)`);
}

console.log("\n=== SUMMARY ===");
console.log(`Added:     ${added.length}/${receivers.length}`);
console.log(`Duplicate: ${duplicate.length}`);
console.log(`Not found: ${notFound.length}`);
console.log(`Ambiguous: ${ambiguous.length}`);
console.log(`Failed:    ${failed.length}`);

if (notFound.length) {
  console.log("\nNOT FOUND (no profile matched this full name):");
  notFound.forEach((n) => console.log(`  - ${n}`));
}
if (ambiguous.length) {
  console.log("\nAMBIGUOUS (multiple profiles share this full name):");
  ambiguous.forEach((a) => console.log(`  - ${a.name}  [${a.ids.join(", ")}]`));
}
if (failed.length) {
  console.log("\nFAILED (POST errored):");
  failed.forEach((f) => console.log(`  - ${f.name}  [${f.status}] ${f.text}`));
}

process.exit(0);
