/* global Buffer, process */
/**
 * OpenAI image generation service.
 *
 * Given a brand brief in the format produced by `generatePagePersonalityPrompt`
 * (see src/generator/pages.js), generate a matched pair of images:
 *   - profile: 1024×1024 brand emblem / logo mark
 *   - cover:   1536×1024 photorealistic environmental scene
 *
 * The brief is parsed into a "brand" preamble plus per-image sections. Killer
 * phrases that push the model toward flat stock-vector output ("readable at
 * small sizes", service-list enumerations, "no text-heavy layout") are
 * stripped from the profile prompt; style/constraint footers are appended.
 *
 * Env:
 *   OPENAI_API_KEY        — required
 *   OPENAI_IMAGE_MODEL    — default "gpt-image-1"
 *   OPENAI_IMAGE_QUALITY  — default "medium" (low | medium | high)
 */

const API_URL = "https://api.openai.com/v1/images/generations";

export const PROFILE_SIZE = "1024x1024";
export const COVER_SIZE = "1536x1024";

// Approximate per-image pricing for gpt-image-1 (USD). Source: OpenAI's
// pricing page — flat per-image estimates that abstract over the underlying
// token billing. Treat as ballpark, not invoice.
const PRICING = {
  low: { "1024x1024": 0.011, "1024x1536": 0.016, "1536x1024": 0.016 },
  medium: { "1024x1024": 0.042, "1024x1536": 0.063, "1536x1024": 0.063 },
  high: { "1024x1024": 0.167, "1024x1536": 0.25, "1536x1024": 0.25 },
};

export function costFor(size, quality) {
  return PRICING[quality]?.[size] ?? 0;
}

const SECTION_HEADERS = [
  "Post creation personality",
  "Profile picture prompt",
  "Cover picture prompt",
];

export function parseBrief(text) {
  const t = String(text || "").trim();
  if (!t) throw new Error("Brief is empty");

  const headerRegex = new RegExp(
    `\\n\\s*(${SECTION_HEADERS.join("|")})\\s*:\\s*`,
    "gi",
  );
  const firstHeader = t.search(headerRegex);
  const brand = (firstHeader === -1 ? t : t.slice(0, firstHeader)).trim();

  function grab(label) {
    const re = new RegExp(
      `${label}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${SECTION_HEADERS.join("|")})\\s*:|$)`,
      "i",
    );
    const m = t.match(re);
    return m ? m[1].trim() : "";
  }

  const profile = grab("Profile picture prompt");
  const cover = grab("Cover picture prompt");

  if (!profile)
    throw new Error('Brief is missing "Profile picture prompt:" section');
  if (!cover)
    throw new Error('Brief is missing "Cover picture prompt:" section');

  return { brand, profile, cover, brandName: extractBrandName(brand) };
}

function extractBrandName(brandBlock) {
  const m = String(brandBlock || "").match(
    /brand AI for\s+["“']?([^"”'\n,]+?)["”']?\s*[,.\n]/i,
  );
  return m ? m[1].trim() : "";
}

// Rewrite chat-system framing into a plain visual subject line.
export function cleanBrandBlock(brand) {
  return String(brand || "")
    .replace(
      /^\s*You are the brand AI for\s+(?:["“']([^"”'\n]+)["”']|([^,\n]+?))\s*,\s*(?:an?\s+)?([^\n.]+)\.?/i,
      (_m, quoted, unquoted, vertical) => {
        const name = (quoted || unquoted || "").trim();
        return `Subject: ${name} — ${(vertical || "").trim()}.`;
      },
    )
    .replace(/^\s*Bio context:\s*/im, "About: ")
    .replace(/^\s*Business focus:\s*/im, "Focus: ")
    .replace(/\ba\s+(Art|Architecture|Athletic|Eco|Indie|Open|Urban)\b/gi, "an $1")
    .trim();
}

// The brief's profile section contains two phrases that pull strongly toward
// flat-vector-icon land: "readable at small sizes" and the service
// enumeration "represents <A>, <B>, and <C>" (which forces a montage).
// Strip them for the profile call only.
export function cleanProfilePrompt(profileSection) {
  return String(profileSection || "")
    .replace(
      /Use\s+bold\s+composition[^.]*readability\s+at\s+small\s+sizes\.?/gi,
      "",
    )
    .replace(/No\s+text-heavy\s+layout\.?/gi, "")
    .replace(
      /represents?\s+[^.]+\./gi,
      "captures the brand's overall essence and mood.",
    )
    .replace(/\s+/g, " ")
    .trim();
}

const PROFILE_STYLE = `STYLE & CONSTRAINTS:
- This is a PREMIUM BRAND EMBLEM — think high-end brand-book identity mark, NOT a flat vector clip-art icon
- Render as a polished circular badge, sculpted monogram, or abstract emblem WITH visible depth, soft shading, subtle texture or gradient — NEVER as a flat SVG silhouette
- MUST sit on a rich solid-color or subtly textured background (brand hues, jewel tones, warm metallics, gradients) — NEVER on plain white or transparent
- ONE single unified abstract mark — NOT a montage of services, NOT multiple icons grouped, NOT a scene
- ABSOLUTELY NO rendered text, NO letters, NO words, NO typography, NO wordmark
- Use the brand context ONLY as thematic inspiration; do NOT render the brand name in the image
- Modern, polished, professional, premium-brand-identity quality
- Centered, balanced composition that reads cleanly when cropped to a circle for a social-media avatar
- Forbidden: flat clip-art, sticker aesthetics, stock-SVG logos, black silhouettes on white, transparent backgrounds, montage compositions`;

const COVER_STYLE = `STYLE & CONSTRAINTS:
- ABSOLUTELY NO rendered text, NO letters, NO words, NO typography, NO captions, NO signage, NO storefront writing
- Use the brand context ONLY as visual/thematic inspiration; do NOT render the brand name as text in the image
- Wide cinematic landscape composition with environmental / lifestyle context appropriate to the brand
- Photorealistic or editorial commercial style: natural lighting, true-to-life textures, depth of field
- Leave clean breathing room in the upper third where a headline could later sit, but DO NOT render any words there
- Avoid poster, advertisement, banner, or flat-graphic aesthetics`;

export function buildPrompts(parsed) {
  const cleanBrand = cleanBrandBlock(parsed.brand);
  return {
    profile: `${cleanBrand}\n\n${cleanProfilePrompt(parsed.profile)}\n\n${PROFILE_STYLE}`,
    cover: `${cleanBrand}\n\n${parsed.cover}\n\n${COVER_STYLE}`,
  };
}

async function callOpenAI({ prompt, size, model, quality, apiKey }) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`OpenAI returned non-JSON (HTTP ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data in OpenAI response");

  return {
    bytes: Buffer.from(b64, "base64"),
    revisedPrompt: data?.data?.[0]?.revised_prompt || null,
  };
}

/**
 * Generate a profile + cover image pair from a brand brief.
 *
 * @param {string} brief - Raw brief text (see generatePagePersonalityPrompt).
 * @param {object} [opts]
 * @param {string} [opts.apiKey]   - Override env OPENAI_API_KEY
 * @param {string} [opts.model]    - Override env OPENAI_IMAGE_MODEL (default "gpt-image-1")
 * @param {string} [opts.quality]  - Override env OPENAI_IMAGE_QUALITY (default "medium")
 * @returns {Promise<{
 *   brandName: string,
 *   profile: { bytes: Buffer, prompt: string, revised: string|null, size: string, costEstimate: number },
 *   cover:   { bytes: Buffer, prompt: string, revised: string|null, size: string, costEstimate: number },
 *   subtotalEstimate: number,
 *   model: string,
 *   quality: string,
 * }>}
 */
export async function generateBrandImages(brief, opts = {}) {
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in server environment.");
  }

  const model = opts.model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const quality =
    opts.quality || process.env.OPENAI_IMAGE_QUALITY || "medium";

  const parsed = parseBrief(brief);
  const { profile: profilePrompt, cover: coverPrompt } = buildPrompts(parsed);

  const profile = await callOpenAI({
    prompt: profilePrompt,
    size: PROFILE_SIZE,
    model,
    quality,
    apiKey,
  });
  const cover = await callOpenAI({
    prompt: coverPrompt,
    size: COVER_SIZE,
    model,
    quality,
    apiKey,
  });

  const profileCost = costFor(PROFILE_SIZE, quality);
  const coverCost = costFor(COVER_SIZE, quality);

  return {
    brandName: parsed.brandName,
    profile: {
      bytes: profile.bytes,
      prompt: profilePrompt,
      revised: profile.revisedPrompt,
      size: PROFILE_SIZE,
      costEstimate: profileCost,
    },
    cover: {
      bytes: cover.bytes,
      prompt: coverPrompt,
      revised: cover.revisedPrompt,
      size: COVER_SIZE,
      costEstimate: coverCost,
    },
    subtotalEstimate: profileCost + coverCost,
    model,
    quality,
  };
}
