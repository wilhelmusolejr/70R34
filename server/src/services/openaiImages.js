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

// Mutually-distinct visual territories. We randomly pick one per call so two
// adjacent generations land in genuinely different aesthetic worlds rather
// than all converging to the model's default "embossed-relief on green"
// brand-emblem look.
//
// Organized loosely by category (material, era, hand-rendered, geometric,
// digital, ornamental) so even if a few adjacent picks land in the same
// neighborhood the overall pool stays diverse.
const PROFILE_VARIATIONS = [
  // ── Material / technique ────────────────────────────────────────────────
  { style: "embossed metallic relief emblem — a sculpted brand mark with raised gold, bronze, copper, or silver elements casting subtle shadows on a rich textured background; tactile premium brand-book quality", palette: "warm metallics (gold / bronze / copper) on a deep jewel-toned background" },
  { style: "letterpress impression on heavy cotton paper — pressed ink leaving a tactile debossed shape, with visible paper grain and slight ink-soak edges", palette: "single dark ink (deep navy, forest, oxblood, charcoal) on cream or ecru paper" },
  { style: "embroidered patch with visible stitched threads, fabric weave background, and a crisp stitched border ring", palette: "saturated thread colors on a contrasting fabric backdrop (cobalt, scarlet, mustard, ivory)" },
  { style: "glazed ceramic tile emblem with subtle surface irregularities, hand-painted brush variation, and reflective glaze highlights", palette: "Mediterranean blue-and-white, terracotta-and-cream, or moss-and-sand" },
  { style: "wax seal stamped into deep colored wax on aged parchment, raised relief with sharp edges and slight wax drip imperfections", palette: "deep red, wine, forest, or midnight wax on parchment cream" },
  { style: "holographic foil emblem with iridescent rainbow shimmer that shifts across the mark, on a dark backdrop", palette: "iridescent rainbow on near-black or deep midnight" },
  { style: "liquid chrome metal rendering with mirror-like reflections, soft studio gradient reflections, and crisp edge highlights", palette: "polished silver / chrome on a soft pastel gradient backdrop" },
  { style: "neon tube glow emblem — the mark drawn as a single luminous neon line on a dark wall, with realistic bloom and reflection", palette: "saturated neon (electric pink, cyan, magenta, lime, amber) on dark slate or brick" },
  { style: "frosted etched glass mark — the symbol etched into smoked or frosted glass with soft diffused light passing through", palette: "muted translucent whites and pale greys with one accent backlight color" },
  { style: "spray-paint stencil aesthetic with slight overspray fuzz, drip details, and a torn-cardboard stencil edge", palette: "bold high-contrast (black + neon, white + arterial red, cream + ultramarine)" },
  { style: "luxurious velvet or felt textile emblem with rich nap, subtle directional sheen, and embroidered metallic trim", palette: "jewel velvet (sapphire, emerald, ruby, plum) with gold thread accents" },
  { style: "Carrara marble emblem with veining flowing through the mark, polished surface, and luxurious cool light", palette: "white marble with grey veining, OR green marble with gold veining, OR pink marble with white veining" },
  { style: "raw concrete / brutalist mark with cast-in relief, visible aggregate texture, and dramatic side lighting", palette: "concrete greys with a single saturated accent (safety orange, mustard, cobalt)" },
  { style: "layered cut-paper collage emblem — multiple paper layers cut and stacked with visible edges and soft drop shadows between layers", palette: "playful paired pastels with one rich saturated layer for contrast" },
  { style: "stained-glass cathedral panel — rich saturated jewel-toned panels separated by thick dark leading, soft backlit glow", palette: "deep sapphire, emerald, ruby, amber separated by black leading" },

  // ── Era / design movement ───────────────────────────────────────────────
  { style: "Art Deco emblem with strong vertical symmetry, sunburst rays, and ornamental geometric detail — Gatsby-era luxury", palette: "deep monochrome with a single metallic accent (navy + gold, charcoal + copper, forest + silver)" },
  { style: "Bauhaus emblem using primary-color geometric forms (circle, square, triangle) in flat composition with confident grid layout", palette: "primary red / yellow / blue plus black on off-white" },
  { style: "mid-century modern minimal mark in the style of Saul Bass — flat, slightly distressed paper-cut shapes with playful negative space", palette: "muted retro palette (avocado, mustard, burnt orange, cream) or limited two-tone" },
  { style: "Memphis Group 80s aesthetic — playful jumbled shapes, polka dots, squiggles, primary brights, and ironic geometry", palette: "hot pink + electric blue + lemon + black-and-white scatter" },
  { style: "60s Op-Art emblem with bold optical-illusion striping and high-contrast geometric distortion", palette: "stark black-and-white with one accent (or two-tone in a saturated complementary pair)" },
  { style: "70s psychedelic flowing organic forms with melting curves, swirling color bleeds, and groovy hand-lettering vibes (but no actual letters)", palette: "warm 70s spectrum (avocado, ochre, burnt sienna, mustard, rust)" },
  { style: "80s synthwave emblem set against a chrome grid horizon with sunset gradient sky and chrome / outline-glow treatment", palette: "magenta-to-purple sunset gradient with cyan and chrome accents" },
  { style: "Y2K chrome-and-jelly bubble graphic — glossy 3D bubble text-free icon, jelly translucency, soft chrome highlights", palette: "candy pastels with chrome reflections (bubblegum pink, mint, lavender, baby blue)" },
  { style: "vaporwave aesthetic emblem — pastel gradients, classical statue fragment, soft grid, dreamy lo-fi atmosphere", palette: "soft pastel pink + lavender + mint + cream with chrome accents" },
  { style: "William Morris vintage botanical pattern emblem — intricate Arts-and-Crafts foliage and vines forming the mark", palette: "rich Victorian (forest + cream, oxblood + mustard, navy + ochre)" },

  // ── Hand-rendered ───────────────────────────────────────────────────────
  { style: "soft watercolor wash emblem with visible pigment pooling, gentle bleeds at edges, and a hand-painted feel", palette: "muted earth tones with one saturated accent (terracotta, sage, ochre + indigo)" },
  { style: "gouache-painted matte emblem with confident opaque brush strokes, slightly imperfect edges, and modern-illustration feel", palette: "muted modern palette (dusty rose, sage, terracotta, sand, slate)" },
  { style: "sumi-e Japanese ink-wash emblem — confident single-stroke brushwork, gradient ink tones from deep black to grey, on rice-paper backdrop", palette: "black ink with cream or warm-white paper, optionally one vermillion accent" },
  { style: "pen-and-ink stippling emblem composed entirely of dots in varying density, building tonal form like scientific botanical illustration", palette: "black ink on cream with optional warm sepia tone" },
  { style: "loose charcoal sketch emblem with smudged shading, expressive line weight, and visible newsprint texture", palette: "charcoal grays on warm off-white newsprint" },
  { style: "linocut / woodblock print emblem with bold confident carved-out shapes, organic edge imperfections, and high contrast", palette: "single saturated ink (deep red, navy, forest, black) on textured cream" },
  { style: "Risograph print emblem with slight color-channel misalignment, grainy spot-color overlay, and zine aesthetic", palette: "duotone Risograph (fluorescent pink + teal, mint + violet, yellow + bright blue)" },
  { style: "soft pastel chalk emblem with powdery edges, gentle color gradients, and a slightly dusted backdrop", palette: "dusty pastels (peach, lavender, sage, butter, blush) on warm cream" },

  // ── Geometric / modernist ───────────────────────────────────────────────
  { style: "modern flat geometric mark using bold color blocks and clean shapes; editorial top-studio identity design", palette: "two confident contrasting colors (coral + navy, mustard + teal, magenta + cream, lime + plum)" },
  { style: "Scandinavian flat-design emblem with generous negative space, restrained shape language, and serene composition", palette: "soft Nordic (cloud white, slate, sage, dusty blue, with one warm accent)" },
  { style: "single-line continuous-stroke emblem — the entire mark drawn as one elegant unbroken line with confident curves", palette: "single bold line (black, gold, deep navy) on a clean solid color field" },
  { style: "low-poly geometric crystal-facet emblem with sharp triangular facets and a faceted gemstone feel", palette: "jewel facets shifting from a deep base to a bright highlight (sapphire, emerald, amethyst, citrine)" },
  { style: "isometric architectural mini-composition forming the brand mark — clean axonometric lines, soft shadows", palette: "muted architectural (warm grey, oat, sage, terracotta, with one saturated accent)" },
  { style: "modernist heraldic crest / shield with simplified geometric heraldry — clean lines, no fussy ornament", palette: "deep two-tone heraldry (navy + gold, oxblood + ivory, forest + cream)" },
  { style: "Swiss-style international-typographic emblem — pure geometric grid composition, ruthless minimalism", palette: "monochrome with one saturated grid-accent color (red, cobalt, or yellow)" },

  // ── 3D / digital ────────────────────────────────────────────────────────
  { style: "modern 3D-rendered emblem with smooth gradient surfaces, soft studio lighting, and subtle ambient occlusion", palette: "vibrant gradient (sunset orange-to-pink, ocean teal-to-purple, peach-to-magenta)" },
  { style: "voxel / pixelated 3D emblem built from chunky cubes with isometric perspective and playful retro-game feel", palette: "saturated game-art palette (turquoise, magenta, lemon, royal blue)" },
  { style: "gradient-mesh fluid abstract emblem with smooth flowing color blends forming organic abstract forms", palette: "iridescent gradient (oil-slick, aurora, dawn sky)" },
  { style: "glitch-art emblem with duotone displacement, RGB channel split, and scan-line interference", palette: "duotone glitch (cyan + magenta, lime + violet) on near-black" },
  { style: "cyberpunk neon dystopian emblem — sharp angular brand mark with chromatic aberration, rain-soaked reflection, and dense atmosphere", palette: "neon magenta + cyan + electric blue against deep blacks" },

  // ── Ornamental / pattern ────────────────────────────────────────────────
  { style: "mandala radial-pattern emblem with concentric ornamental rings of fine detail building toward the center", palette: "rich symmetrical palette (gold + indigo, copper + plum, sage + ochre)" },
  { style: "Celtic knotwork interlace emblem with woven over-under bands forming the symbol, fine traditional detail", palette: "deep green + gold, or oxblood + cream, or navy + brass" },
  { style: "classical heraldic crest with full mantling, supporters implied, and traditional shield form — heritage-brand quality", palette: "deep heraldic (royal blue + gold, crimson + ivory, forest + silver)" },
  { style: "mosaic tessellation emblem made from tiny irregular tiles forming the mark, with visible grout lines", palette: "Byzantine palette (cobalt, gold tesserae, deep red, off-white)" },
  { style: "tarot-card illustrated frame style — ornamental border, central symbolic figure, mystical line work", palette: "deep midnight + gold + ivory with one saturated accent (ruby, emerald, amethyst)" },
];

function pickProfileVariation() {
  return PROFILE_VARIATIONS[
    Math.floor(Math.random() * PROFILE_VARIATIONS.length)
  ];
}

function buildProfileStyle(variation) {
  return `STYLE & CONSTRAINTS:
- This is a PREMIUM BRAND EMBLEM / profile avatar — a brand-book-quality identity mark, NOT flat vector clip-art
- VISUAL STYLE for this specific brand: ${variation.style}
- COLOR PALETTE: ${variation.palette}
- ONE single unified mark — NOT a montage of services, NOT multiple icons grouped, NOT a scene
- ABSOLUTELY NO rendered text, NO letters, NO words, NO typography, NO wordmark
- Use the brand context ONLY as thematic inspiration; do NOT render the brand name in the image
- MUST sit on a rich background (solid color, gradient, or subtle texture) — NEVER on plain white or transparent
- Centered, balanced composition that reads cleanly when cropped to a circle for a social-media avatar
- Forbidden: flat clip-art, sticker aesthetics, stock-SVG logos, black silhouettes on white, transparent backgrounds, montage compositions`;
}

const COVER_STYLE = `STYLE & CONSTRAINTS:
- ABSOLUTELY NO rendered text, NO letters, NO words, NO typography, NO captions, NO signage, NO storefront writing
- Use the brand context ONLY as visual/thematic inspiration; do NOT render the brand name as text in the image
- Wide cinematic landscape composition with environmental / lifestyle context appropriate to the brand AND the stated country/market — pick architecture, interiors, light quality, fashion, and street furniture that match that country
- Photorealistic or editorial commercial style: natural lighting, true-to-life textures, depth of field
- Leave clean breathing room in the upper third where a headline could later sit, but DO NOT render any words there
- Avoid poster, advertisement, banner, or flat-graphic aesthetics`;

const COUNTRY_NAMES = {
  US: "United States",
  IT: "Italy",
};

function countryLine(code) {
  const raw = String(code || "").trim();
  if (!raw) return "";
  const name = COUNTRY_NAMES[raw.toUpperCase()] || raw;
  return `Country / market: ${name} — render this image with cultural and visual cues that fit ${name}.`;
}

export function buildPrompts(parsed, opts = {}) {
  const cleanBrand = cleanBrandBlock(parsed.brand);
  const country = countryLine(opts.country);
  const brandWithCountry = country ? `${cleanBrand}\n${country}` : cleanBrand;
  const variation = opts.profileVariation || pickProfileVariation();
  return {
    profile: `${brandWithCountry}\n\n${cleanProfilePrompt(parsed.profile)}\n\n${buildProfileStyle(variation)}`,
    cover: `${brandWithCountry}\n\n${parsed.cover}\n\n${COVER_STYLE}`,
    profileVariation: variation,
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
  const {
    profile: profilePrompt,
    cover: coverPrompt,
    profileVariation,
  } = buildPrompts(parsed, {
    profileVariation: opts.profileVariation,
    country: opts.country,
  });

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
      variation: profileVariation,
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
