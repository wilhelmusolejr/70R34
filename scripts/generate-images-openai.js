/* global process */
/**
 * OpenAI Image Generator — CLI wrapper around the server-side service.
 *
 * For each entry in BRIEFS, generates a profile + cover pair and saves them
 * to ./generated-images-openai/<brand-slug>/. The actual prompt assembly and
 * API calls live in server/src/services/openaiImages.js so the CLI and the
 * server route POST /api/pages/:id/generate-images stay in lockstep.
 *
 * Usage:
 *   node scripts/generate-images-openai.js
 *
 * Env (read via dotenv):
 *   OPENAI_API_KEY        — required
 *   OPENAI_IMAGE_MODEL    — default "gpt-image-1"
 *   OPENAI_IMAGE_QUALITY  — default "medium" (low | medium | high)
 *   USD_TO_PHP            — display-only PHP conversion rate (default 60)
 */

import fs from "fs";
import path from "path";
import "dotenv/config";
import {
  generateBrandImages,
  costFor,
  PROFILE_SIZE,
  COVER_SIZE,
} from "../server/src/services/openaiImages.js";

const QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";
const MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const USD_TO_PHP = Number(process.env.USD_TO_PHP || 60);

const OUTPUT_DIR = "./generated-images-openai";
const DELAY_MS = 1500;

const fmtUSD = (n) => `$${n.toFixed(3)}`;
const fmtPHP = (n) => `₱${(n * USD_TO_PHP).toFixed(2)}`;
const fmtMoney = (usd) => `${fmtUSD(usd)} (${fmtPHP(usd)})`;
const indent = (text, prefix = "  > ") =>
  String(text)
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");

const RUN_TIMESTAMP = new Date()
  .toISOString()
  .replace(/[:.]/g, "-")
  .slice(0, 19);
let LOG_FILE = null;

function log(...args) {
  const line = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
  console.log(line);
  if (LOG_FILE) {
    try {
      fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {
      // never let logging crash the run
    }
  }
}

function slugify(s) {
  return (
    String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brand"
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// Paste a brief from your API into BRIEFS and run the script.
// -----------------------------------------------------------------------------
const BRIEFS = [
  `You are the brand AI for "Bella Giardino Kids Co.", a Childcare Center.
Business focus: preschool curriculum, art, and outdoor exploration.
Bio context: Da Bella Giardino Kids Co. crediamo che il vero apprendimento nasca da preschool curriculum, art, and outdoor exploration. La pagina racconta progressi e suggerimenti di studio.

Post creation personality:
Create platform-ready posts in a encouraging, clear, and student-first tone. Mix educational, promotional, and community posts. Keep captions clear, believable, and aligned with Childcare Center audiences.

Profile picture prompt:
Design a clean, memorable profile image for "Bella Giardino Kids Co." that represents preschool curriculum, art, and outdoor exploration. Use bold composition, high contrast, and strong readability at small sizes. No text-heavy layout.

Cover picture prompt:
Create a wide cover image for "Bella Giardino Kids Co." featuring preschool curriculum, art, and outdoor exploration. Include brand atmosphere, lifestyle context, and space for optional headline overlay. Use polished, realistic lighting and commercial quality framing.`,
];

async function runOne(brief, index) {
  const result = await generateBrandImages(brief);
  const slug =
    slugify(result.brandName) || `brand-${String(index + 1).padStart(3, "0")}`;
  const dir = path.join(OUTPUT_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });

  log(`\n── brief #${index + 1}: ${result.brandName || slug}`);
  log(`   raw brief (${brief.length} chars):`);
  log(indent(brief));

  // ---- profile ----
  log(
    `\n  → profile.png  ${result.profile.size}  quality=${result.quality}  est ${fmtMoney(result.profile.costEstimate)}`,
  );
  log(`  prompt:`);
  log(indent(result.profile.prompt));
  fs.writeFileSync(path.join(dir, "profile.png"), result.profile.bytes);
  log(`  ✓ saved profile.png  (${fmtMoney(result.profile.costEstimate)})`);

  // ---- cover ----
  log(
    `\n  → cover.png    ${result.cover.size}  quality=${result.quality}  est ${fmtMoney(result.cover.costEstimate)}`,
  );
  log(`  prompt:`);
  log(indent(result.cover.prompt));
  fs.writeFileSync(path.join(dir, "cover.png"), result.cover.bytes);
  log(`  ✓ saved cover.png    (${fmtMoney(result.cover.costEstimate)})`);

  log(`  subtotal for ${result.brandName || slug}: ${fmtMoney(result.subtotalEstimate)}`);

  fs.writeFileSync(path.join(dir, "brief.txt"), brief);
  fs.writeFileSync(
    path.join(dir, "prompts.json"),
    JSON.stringify(
      {
        brandName: result.brandName,
        model: result.model,
        quality: result.quality,
        profile: {
          prompt: result.profile.prompt,
          size: result.profile.size,
          costEstimate: result.profile.costEstimate,
          revised: result.profile.revised,
        },
        cover: {
          prompt: result.cover.prompt,
          size: result.cover.size,
          costEstimate: result.cover.costEstimate,
          revised: result.cover.revised,
        },
        subtotalEstimate: result.subtotalEstimate,
      },
      null,
      2,
    ),
  );

  return { slug, brandName: result.brandName, cost: result.subtotalEstimate };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Please set OPENAI_API_KEY before running.");
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  LOG_FILE = path.join(OUTPUT_DIR, `run-${RUN_TIMESTAMP}.txt`);

  const perBriefCost = costFor(PROFILE_SIZE, QUALITY) + costFor(COVER_SIZE, QUALITY);
  const estimatedTotal = perBriefCost * BRIEFS.length;

  log(`\nOpenAI Image Generator — run ${RUN_TIMESTAMP}`);
  log(`   Model    : ${MODEL}`);
  log(`   Quality  : ${QUALITY}`);
  log(`   Briefs   : ${BRIEFS.length}  (×2 images = ${BRIEFS.length * 2} API calls)`);
  log(`   Profile  : ${PROFILE_SIZE}  (est ${fmtMoney(costFor(PROFILE_SIZE, QUALITY))} ea)`);
  log(`   Cover    : ${COVER_SIZE}  (est ${fmtMoney(costFor(COVER_SIZE, QUALITY))} ea)`);
  log(`   Per brief: ~${fmtMoney(perBriefCost)}`);
  log(`   Estimate : ~${fmtMoney(estimatedTotal)} total`);
  log(`   FX rate  : 1 USD = ${USD_TO_PHP} PHP`);
  log(`   Output   : ${path.resolve(OUTPUT_DIR)}`);
  log(`   Log file : ${path.resolve(LOG_FILE)}`);
  log(`   Delay    : ${DELAY_MS}ms`);

  let failed = 0;
  let runningCost = 0;
  const errors = [];

  for (let i = 0; i < BRIEFS.length; i++) {
    try {
      const result = await runOne(BRIEFS[i], i);
      runningCost += result.cost;
    } catch (err) {
      failed++;
      errors.push({ index: i + 1, error: err.message });
      log(`\n  ✗ brief #${i + 1} FAILED: ${err.message}`);
    }
    if (i < BRIEFS.length - 1) await sleep(DELAY_MS);
  }

  log(`\n──────────────────────────────────────────────`);
  log(`Done: ${BRIEFS.length - failed}/${BRIEFS.length} brands → ${path.resolve(OUTPUT_DIR)}`);
  log(`Total spend (est): ${fmtMoney(runningCost)}`);

  if (errors.length > 0) {
    log(`\nFailed briefs (${errors.length}):`);
    errors.forEach(({ index, error }) => log(`   #${index}: ${error}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
