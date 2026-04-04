/**
 * Batch Image Generator
 * Supports Gemini and Hugging Face based on key/model.
 */

import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import "dotenv/config";

const API_KEY =
  process.env.IMAGE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";
const MODEL = process.env.IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
const OUTPUT_DIR = "./generated-images";
const TOTAL_IMAGES = 1; // Temporary test setting
const DELAY_MS = 4500;

const BASE_PROMPT =
  "Professional business photo, corporate style, high quality, 4k";
const CUSTOM_PROMPTS = [];

const STYLE_VARIATIONS = [
  "warm natural lighting, shallow depth of field",
  "clean white background, studio lighting",
  "modern minimalist setting, soft shadows",
  "golden hour lighting, outdoor urban environment",
  "dramatic side lighting, dark background",
  "bright airy atmosphere, Scandinavian aesthetic",
  "cinematic wide shot, corporate environment",
  "close-up detail shot, sharp focus",
  "overhead flat lay composition, clean desk",
  "candid documentary style, authentic feel",
];

const IS_HF = API_KEY.startsWith("hf_") || MODEL.includes("/");
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL}`;

function getPrompt(index) {
  if (CUSTOM_PROMPTS.length > 0) {
    return CUSTOM_PROMPTS[index % CUSTOM_PROMPTS.length];
  }
  const variation = STYLE_VARIATIONS[index % STYLE_VARIATIONS.length];
  return `${BASE_PROMPT}, ${variation}, image ${index + 1} of ${TOTAL_IMAGES}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveImageBuffer(index, bytes, mimeType = "image/png") {
  const ext = mimeType.split("/")[1] || "png";
  const filename = `image_${String(index + 1).padStart(3, "0")}.${ext}`;
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, bytes);
  return filename;
}

async function generateImageWithGemini(prompt, index) {
  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `Gemini returned non-JSON response (HTTP ${response.status})`,
    );
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) =>
    p.inlineData?.mimeType?.startsWith("image/"),
  );
  if (!imagePart) throw new Error("No image returned in Gemini response");

  return saveImageBuffer(
    index,
    Buffer.from(imagePart.inlineData.data, "base64"),
    imagePart.inlineData.mimeType,
  );
}

async function generateImageWithHuggingFace(prompt, index) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true, use_cache: false },
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.startsWith("image/")) {
      const bytes = Buffer.from(await response.arrayBuffer());
      return saveImageBuffer(index, bytes, contentType);
    }

    const raw = await response.text();
    let errJson = {};
    try {
      errJson = raw ? JSON.parse(raw) : {};
    } catch {
      errJson = {};
    }

    if (response.status === 503 && attempt < 2) {
      const waitSeconds = Number(errJson?.estimated_time || 5);
      await sleep(Math.ceil(waitSeconds * 1000));
      continue;
    }

    const message =
      errJson?.error ||
      errJson?.message ||
      `Hugging Face HTTP ${response.status}${raw ? `: ${raw.slice(0, 200)}` : ""}`;
    throw new Error(message);
  }

  throw new Error("Hugging Face model did not become ready after retries");
}

async function generateImage(prompt, index) {
  if (IS_HF) return generateImageWithHuggingFace(prompt, index);
  return generateImageWithGemini(prompt, index);
}

function printProgress(current, total, filename, failed) {
  const pct = Math.round((current / total) * 100);
  const doneBlocks = Math.floor(pct / 5);
  const bar = "#".repeat(doneBlocks) + "-".repeat(20 - doneBlocks);
  process.stdout.write(
    `\r[${bar}] ${pct}% | ${current}/${total} | ok ${current - failed} | fail ${failed} | Last: ${filename}`,
  );
}

async function main() {
  if (!API_KEY || API_KEY === "YOUR_API_KEY_HERE") {
    console.error(
      "Please set IMAGE_API_KEY (or GEMINI_API_KEY) before running.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("\nBatch Image Generator");
  console.log(`   Provider: ${IS_HF ? "Hugging Face" : "Gemini"}`);
  console.log(`   Model   : ${MODEL}`);
  console.log(`   Images  : ${TOTAL_IMAGES}`);
  console.log(`   Output  : ${path.resolve(OUTPUT_DIR)}`);
  console.log(`   Delay   : ${DELAY_MS}ms\n`);

  let failed = 0;
  const errors = [];

  for (let i = 0; i < TOTAL_IMAGES; i++) {
    const prompt = `A wide Facebook cover photo for a business page called "Ross Creative Agency". 
Reflect the type of business and brand personality suggested by the name. 
Choose an appropriate visual style and color palette. Include subtle design 
elements, textures, or imagery relevant to the business niche. The layout 
should have visual breathing room on the left side for the overlapping profile 
picture. Optionally include the business name as stylized text. 
Professional, eye-catching, high quality. 16:9 aspect ratio, 820x312px..`;
    try {
      const filename = await generateImage(prompt, i);
      printProgress(i + 1, TOTAL_IMAGES, filename, failed);
    } catch (err) {
      failed++;
      errors.push({ index: i + 1, error: err.message });
      printProgress(i + 1, TOTAL_IMAGES, `FAILED #${i + 1}`, failed);
    }

    if (i < TOTAL_IMAGES - 1) await sleep(DELAY_MS);
  }

  console.log(
    `\n\nDone: ${TOTAL_IMAGES - failed}/${TOTAL_IMAGES} images saved to ${path.resolve(OUTPUT_DIR)}`,
  );

  if (errors.length > 0) {
    console.log(`\nFailed images (${errors.length}):`);
    errors.forEach(({ index, error }) => console.log(`   #${index}: ${error}`));
    process.exitCode = 1;
  }
}

main();
