import fs from "node:fs";
import path from "node:path";

const DEFAULT_MODEL = "gemini-2.5-flash-image-preview";
const ENDPOINT_TEMPLATE = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const COST_PER_IMAGE_USD = 0.039;
const PHP_PER_USD = 58;

function loadEnvFile(filename) {
  try {
    const content = fs.readFileSync(filename, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      const value = rawValue.replace(/^["']|["']$/g, "");
      process.env[key] = value;
    }
  } catch {
    // .env not present; ignore
  }
}

loadEnvFile(".env");

const DEFAULT_PAGE = {
  pageName: "Paws & Polish Groomery",
  category: "Pet Grooming",
  focus: "gentle pet grooming, de-shedding, and coat care",
  bio: "Paws & Polish Groomery is a Pet Grooming focused on gentle pet grooming, de-shedding, and coat care. We share daily tips, behind-the-scenes moments, and real customer stories.",
};

function parseArgs(argv) {
  const args = {
    pageName: DEFAULT_PAGE.pageName,
    category: DEFAULT_PAGE.category,
    focus: DEFAULT_PAGE.focus,
    bio: DEFAULT_PAGE.bio,
    apiKey: process.env.GEMINI_API_KEY || "",
    model: DEFAULT_MODEL,
    outDir: "scripts/output",
    skipCover: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--name") {
      args.pageName = next;
      i += 1;
    } else if (arg === "--category") {
      args.category = next;
      i += 1;
    } else if (arg === "--focus") {
      args.focus = next;
      i += 1;
    } else if (arg === "--bio") {
      args.bio = next;
      i += 1;
    } else if (arg === "--key") {
      args.apiKey = next;
      i += 1;
    } else if (arg === "--model") {
      args.model = next;
      i += 1;
    } else if (arg === "--out") {
      args.outDir = next;
      i += 1;
    } else if (arg === "--profile-only") {
      args.skipCover = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/test-gemini-image.js [options]

Options:
  --name           Page name      (default: "${DEFAULT_PAGE.pageName}")
  --category       Page category  (default: "${DEFAULT_PAGE.category}")
  --focus          Business focus (default: "${DEFAULT_PAGE.focus}")
  --bio            Bio context    (default: see Paws & Polish example)
  --key            Gemini API key (or set GEMINI_API_KEY in .env)
  --model          Model id       (default: ${DEFAULT_MODEL})
  --out            Output dir     (default: scripts/output)
  --profile-only   Skip cover image, only generate profile
  -h, --help       Show this help`);
}

function buildProfilePrompt({ pageName, category, focus, bio }) {
  return [
    `You are the brand AI for "${pageName}", a ${category}.`,
    `Business focus: ${focus}.`,
    `Bio context: ${bio}`,
    `Profile picture prompt:`,
    `Design a clean, memorable profile image for "${pageName}" that represents ${focus}. Use bold composition, high contrast, and strong readability at small sizes. No text-heavy layout.`,
  ].join("\n");
}

function buildCoverPrompt({ pageName, category, focus, bio }) {
  return [
    `You are the brand AI for "${pageName}", a ${category}.`,
    `Business focus: ${focus}.`,
    `Bio context: ${bio}`,
    `Cover picture prompt:`,
    `Create a wide cover image for "${pageName}" featuring ${focus}. Include brand atmosphere, lifestyle context, and space for optional headline overlay. Use polished, realistic lighting and commercial quality framing.`,
  ].join("\n");
}

async function generateImage({ prompt, apiKey, model }) {
  const url = `${ENDPOINT_TEMPLATE(model)}?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  const json = await response.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart) {
    const finishReason = json?.candidates?.[0]?.finishReason || "unknown";
    throw new Error(
      `No image returned (finishReason=${finishReason}). Response: ${JSON.stringify(json).slice(0, 500)}`,
    );
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

function slugify(value) {
  return String(value || "page")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function extFromMime(mime) {
  if (!mime) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.apiKey) {
    console.error("Missing API key. Set GEMINI_API_KEY in .env or pass --key <your-key>.");
    process.exit(1);
  }

  fs.mkdirSync(args.outDir, { recursive: true });

  const slug = slugify(args.pageName);

  console.log(`Generating images for "${args.pageName}" (${args.category})`);
  console.log(`Model: ${args.model}`);
  console.log(`Output: ${path.resolve(args.outDir)}`);

  const totalStart = Date.now();
  let generatedCount = 0;

  console.log("\n[1] Profile image...");
  const profilePrompt = buildProfilePrompt(args);
  console.log("  prompt:");
  console.log(profilePrompt.split("\n").map((l) => `    ${l}`).join("\n"));
  const t1 = Date.now();
  const profile = await generateImage({
    prompt: profilePrompt,
    apiKey: args.apiKey,
    model: args.model,
  });
  const profilePath = path.join(args.outDir, `${slug}-profile.${extFromMime(profile.mimeType)}`);
  fs.writeFileSync(profilePath, profile.buffer);
  console.log(`  saved ${profilePath} (${(profile.buffer.length / 1024).toFixed(1)} KB) in ${Date.now() - t1} ms`);
  generatedCount += 1;

  if (!args.skipCover) {
    console.log("\n[2] Cover image...");
    const coverPrompt = buildCoverPrompt(args);
    console.log("  prompt:");
    console.log(coverPrompt.split("\n").map((l) => `    ${l}`).join("\n"));
    const t2 = Date.now();
    const cover = await generateImage({
      prompt: coverPrompt,
      apiKey: args.apiKey,
      model: args.model,
    });
    const coverPath = path.join(args.outDir, `${slug}-cover.${extFromMime(cover.mimeType)}`);
    fs.writeFileSync(coverPath, cover.buffer);
    console.log(`  saved ${coverPath} (${(cover.buffer.length / 1024).toFixed(1)} KB) in ${Date.now() - t2} ms`);
    generatedCount += 1;
  }

  const totalUsd = COST_PER_IMAGE_USD * generatedCount;
  const totalPhp = totalUsd * PHP_PER_USD;
  console.log(`\nDone in ${Date.now() - totalStart} ms.`);
  console.log(`Approx cost: ${generatedCount} image(s) x $${COST_PER_IMAGE_USD.toFixed(3)} = $${totalUsd.toFixed(3)} USD (~PHP ${totalPhp.toFixed(2)})`);
}

main().catch((error) => {
  console.error("\nError:", error.message);
  process.exit(1);
});
