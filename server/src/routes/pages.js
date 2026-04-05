import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import multer from "multer";
import { Router } from "express";
import mongoose from "mongoose";
import { Image } from "../models/Image.js";
import { Page } from "../models/Page.js";
import { Profile } from "../models/Profile.js";
import { mapImageDoc } from "../utils/publicImageUrl.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");
const publicImagesDir = path.resolve(projectRoot, "public", "images");

fs.mkdirSync(publicImagesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, publicImagesDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${randomUUID()}${ext || ".png"}`);
  },
});

const upload = multer({ storage });

function slugify(value, fallback = "page") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function renameUploadedFile(file, nextBaseName) {
  const ext = path.extname(file.originalname || file.filename || "");
  const finalName = `${nextBaseName}${ext || ".png"}`;
  const nextAbsolutePath = path.resolve(publicImagesDir, finalName);

  fs.renameSync(file.path, nextAbsolutePath);

  return {
    ...file,
    filename: finalName,
    path: nextAbsolutePath,
  };
}

function getPageUploadBaseName(type) {
  return `page_${slugify(type || "post", "post")}_${randomUUID()}`;
}

function extractGeneratedText(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function extractJsonText(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

async function requestGitHubModels(messages, options = {}) {
  const token = String(process.env.GITHUB_MODELS_TOKEN || "").trim();
  const model = String(process.env.GITHUB_MODELS_MODEL || "openai/gpt-4.1").trim();
  const endpoint = String(
    process.env.GITHUB_MODELS_BASE_URL ||
      "https://models.github.ai/inference/chat/completions",
  ).trim();
  const apiVersion = String(
    process.env.GITHUB_MODELS_API_VERSION || "2026-03-10",
  ).trim();

  if (!token) {
    throw new Error("Missing GITHUB_MODELS_TOKEN in server environment.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": apiVersion,
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 220,
      response_format: options.responseFormat,
      messages,
    }),
  });

  if (!response.ok) {
    let errorMessage = "GitHub Models request failed.";
    try {
      const body = await response.json();
      errorMessage = body?.message || body?.error?.message || errorMessage;
    } catch {
      // Ignore body parse failures and keep the fallback message.
    }
    throw new Error(errorMessage);
  }

  return {
    model,
    payload: await response.json(),
  };
}

function buildPostPromptContext(page, userInstructions = "") {
  const pageProfile = page.linkedIdentities?.[0] || null;

  return [
    `Page name: ${page.pageName || "Unknown"}`,
    `Category: ${page.category || "Unknown"}`,
    `Bio: ${page.bio || "None"}`,
    `Saved generation prompt: ${page.generationPrompt || "None"}`,
    `Followers: ${page.followerCount || 0}`,
    `Likes: ${page.likeCount || 0}`,
    `Linked profile: ${
      pageProfile
        ? [pageProfile.firstName, pageProfile.lastName].filter(Boolean).join(" ")
        : "None"
    }`,
    `Recent post examples: ${
      (page.posts || [])
        .slice(-5)
        .map((post) => post.post)
        .filter(Boolean)
        .join(" | ") || "None"
    }`,
    `Extra instruction from user: ${userInstructions || "None"}`,
  ].join("\n");
}

function parseGeneratedPosts(payload) {
  const rawText = extractJsonText(payload);

  if (!rawText) {
    throw new Error("GitHub Models returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("GitHub Models returned invalid JSON.");
  }

  const posts = Array.isArray(parsed?.posts)
    ? parsed.posts.map((entry) => String(entry || "").trim()).filter(Boolean)
    : Array.isArray(parsed)
      ? parsed.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];

  if (!posts.length) {
    throw new Error("GitHub Models did not return any posts.");
  }

  return posts;
}

function splitCombinedBulkPosts(posts, expectedCount) {
  if (posts.length !== 1 || expectedCount <= 1) {
    return posts;
  }

  const lines = String(posts[0] || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const splitPosts = [];
  let currentPost = [];

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine && !currentPost.length) {
      return;
    }

    currentPost.push(line);

    if (trimmedLine.startsWith("#")) {
      const combined = currentPost.join("\n").trim();
      if (combined) {
        splitPosts.push(combined);
      }
      currentPost = [];
    }
  });

  if (currentPost.length) {
    const combined = currentPost.join("\n").trim();
    if (combined) {
      splitPosts.push(combined);
    }
  }

  return splitPosts.length > 1 ? splitPosts : posts;
}

function normalizeGeneratedPosts(posts, expectedCount) {
  const cleanedPosts = splitCombinedBulkPosts(posts, expectedCount)
    .map((post) => String(post || "").trim())
    .filter(Boolean);

  return cleanedPosts.slice(0, expectedCount);
}

function getStructuredPostFormatInstructions() {
  return `Use this post structure:
Line 1: A short title
Line 2: A hook
Line 3: Blank line
Line 4+: One main paragraph
Next line: Blank line
Next line: Optionally add one customer-facing question if it fits naturally
Next line: Blank line
Final line: Add 1 to 3 relevant hashtags

Formatting rules:
- The title and hook must be separate lines
- Keep one blank line before the paragraph
- Keep one blank line before the optional question when a question is present
- Keep one blank line before the hashtag line
- Keep the title short and natural, not clickbait spam
- The hook should make someone want to keep reading
- The paragraph should sound human and specific to the business
- The optional question should invite engagement from possible customers
- Hashtags should be simple and relevant, not stuffed
- Include appropriate emojis naturally in the title, hook, or paragraph when they fit the brand voice
- Do not add labels like Title:, Hook:, Paragraph:, Question:, or Hashtags:
- Return the completed post exactly as normal publish-ready text`;
}

async function generatePostCopy(page, userInstructions = "") {
  const promptContext = buildPostPromptContext(page, userInstructions);
  const { model, payload } = await requestGitHubModels(
    [
      {
        role: "system",
        content: `You write Facebook posts for business pages.
They must feel human, engaging, and ready to publish.
- Use enough appropriate emojis when they fit naturally and help the post feel native to social media

${getStructuredPostFormatInstructions()}`,
      },
      {
        role: "user",
        content: `Write one engaging Facebook post for this page.

${promptContext}`,
      },
    ],
    {
      maxTokens: 320,
      temperature: 0.8,
    },
  );

  const post = extractGeneratedText(payload);

  if (!post) {
    throw new Error("GitHub Models returned an empty response.");
  }

  return {
    post,
    model,
  };
}

async function generateBulkPostCopies(page, count, userInstructions = "") {
  const pageProfile = page.linkedIdentities?.[0] || null;
  const recentPosts =
    (page.posts || [])
      .slice(-5)
      .map((post, index) => `${index + 1}. ${post.post}`)
      .filter((post) => !post.endsWith(". "))
      .join("\n") || "None";
  const pageName = page.pageName || "Unknown";
  const category = page.category || "Unknown";
  const bio = page.bio || "None";
  const generationPrompt = page.generationPrompt || "None";
  const followers = page.followerCount || 0;
  const pageLikes = page.likeCount || 0;
  const extraInstructions = [
    userInstructions || "None",
    pageProfile
      ? `Linked profile context: ${[pageProfile.firstName, pageProfile.lastName].filter(Boolean).join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemMessage = `You are an expert social media copywriter for local businesses and brand pages.
Your job is to write Facebook posts that feel human, scroll-stopping, and authentic.

Rules:
- Each post should explore a different page-relevant topic, offer, tip, question, service, seasonal angle, customer concern, or community moment when possible
- Vary the format: some short punchy, some storytelling, some question-based, some visual-led
- Write in the brand's voice and tone, not generic AI copy
- Every post should include a short title, a hook, one main paragraph, an optional customer-facing question, and 1 to 3 relevant hashtags
- The question line is optional, but include it when it feels natural
- Hashtags should be relevant and not spammy
- No numbering, labels, or explanations
- Use enough appropriate emojis when they fit naturally and help the post feel native to Facebook
- Avoid making the batch feel repetitive, but do not fail to answer if some ideas naturally overlap
- Posts should feel like they were written by the page owner, not a robot
- Follow this exact internal post layout for every string:
  first line = title
  second line = hook
  blank line
  then the main paragraph
  blank line
  then optional question line
  blank line
  final line = hashtags
- Return ONLY valid JSON in this shape: {"posts":["post one","post two"]}

${getStructuredPostFormatInstructions()}`;

  const baseUserMessage = `Generate ${count} unique Facebook posts for this business page.

--- PAGE INFO ---
Page name: ${pageName}
Business category: ${category}
Bio: ${bio}
Brand voice & tone: ${generationPrompt}
Followers: ${followers}
Page likes: ${pageLikes}

--- RECENT POSTS (avoid repeating these angles) ---
${recentPosts}

--- EXTRA INSTRUCTIONS ---
${extraInstructions}

--- OUTPUT FORMAT ---
Return only valid JSON in this exact shape:
{"posts":["First post here","Second post here"]}
No markdown, no backticks, no explanation.
Each string inside "posts" is one complete ready-to-publish Facebook post following the required title, hook, paragraph, optional question, and hashtag structure.`;

  const { model, payload } = await requestGitHubModels(
    [
      {
        role: "system",
        content: systemMessage,
      },
      {
        role: "user",
        content: baseUserMessage,
      },
    ],
    {
      maxTokens: Math.max(520, count * 320),
      temperature: 0.95,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "bulk_page_posts",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["posts"],
            properties: {
              posts: {
                type: "array",
                minItems: 1,
                maxItems: count,
                items: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    },
  );

  const collectedPosts = normalizeGeneratedPosts(parseGeneratedPosts(payload), count);

  if (!collectedPosts.length) {
    throw new Error("GitHub Models did not return any usable posts.");
  }

  return {
    posts: collectedPosts,
    model,
    requestedCount: count,
    actualCount: collectedPosts.length,
  };
}

async function appendGeneratedPostsToPage(pageId, generatedPosts) {
  await Page.findByIdAndUpdate(
    pageId,
    {
      $push: {
        posts: {
          $each: generatedPosts.map((post) => ({
            post,
            images: [],
          })),
        },
      },
    },
    { new: true, runValidators: true },
  );

  const populatedPage = await Page.findById(pageId)
    .populate("linkedIdentities", "id firstName lastName pageUrl")
    .populate("assets.imageId")
    .populate("posts.images")
    .lean();

  return populatedPage;
}

function formatPage(page) {
  return {
    id: String(page._id),
    schemaVersion: page.schemaVersion,
    pageName: page.pageName,
    pageId: page.pageId,
    category: page.category,
    followerCount: page.followerCount,
    likeCount: page.likeCount,
    generationPrompt: page.generationPrompt,
    bio: String(page.bio || page.assets?.[0]?.postDescription || "").trim(),
    linkedIdentity: page.linkedIdentities?.[0] || null,
    assets: (page.assets || []).map((asset) => ({
      ...asset,
      imageId: mapImageDoc(asset.imageId),
    })),
    posts: (page.posts || []).map((post) => ({
      id: String(post._id),
      post: post.post || "",
      images: (post.images || []).map((image) => mapImageDoc(image)),
      createdAt: post.createdAt || null,
      updatedAt: post.updatedAt || null,
    })),
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

function ensureValidPageId(id) {
  return mongoose.isValidObjectId(id);
}

async function syncProfilePageReference({
  pageObjectId,
  previousProfileId = null,
  nextProfileId = null,
}) {
  const previousId = previousProfileId ? String(previousProfileId) : "";
  const nextId = nextProfileId ? String(nextProfileId) : "";

  if (previousId && previousId !== nextId) {
    await Profile.updateOne(
      { _id: previousProfileId, pageId: pageObjectId },
      { $set: { pageId: null } },
    );
  }

  if (nextId) {
    await Profile.updateOne(
      { _id: nextProfileId },
      { $set: { pageId: pageObjectId } },
    );
  }
}

router.get("/", async (_req, res, next) => {
  try {
    const pages = await Page.find()
      .populate("linkedIdentities", "id firstName lastName pageUrl")
      .populate("assets.imageId")
      .sort({ createdAt: -1 })
      .lean();

    res.json(pages.map(formatPage));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureValidPageId(id)) {
      return res.status(400).json({ message: "Invalid page id" });
    }

    const page = await Page.findById(id)
      .populate("linkedIdentities", "id firstName lastName pageUrl")
      .populate("assets.imageId")
      .populate("posts.images")
      .lean();

    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    res.json(formatPage(page));
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.array("images"), async (req, res, next) => {
  try {
    const pageName = String(req.body?.pageName || "").trim();
    const pageId = String(req.body?.pageId || "").trim();
    const category = String(req.body?.category || "").trim();
    const followerCount = Number.parseInt(req.body?.followerCount || "0", 10) || 0;
    const likeCount = Number.parseInt(req.body?.likeCount || "0", 10) || 0;
    const generationPrompt = String(req.body?.generationPrompt || "").trim();
    const linkedIdentityId = String(req.body?.linkedIdentityId || "").trim();
    const bio = String(req.body?.bio || "").trim();
    const engagementScore = Number.parseInt(req.body?.engagementScore || "0", 10) || 0;
    const assetTypes = JSON.parse(String(req.body?.assetTypes || "[]"));
    const files = req.files || [];

    if (!pageName) {
      return res.status(400).json({ message: "Page name is required" });
    }

    const linkedIdentity = linkedIdentityId
      ? await Profile.findById(linkedIdentityId)
      : null;

    if (linkedIdentityId && !linkedIdentity) {
      return res.status(404).json({ message: "Assigned profile not found" });
    }

    const renamedFiles = files.map((file, index) =>
      renameUploadedFile(
        file,
        getPageUploadBaseName(String(assetTypes[index] || "post").trim() || "post"),
      ),
    );

    const createdImages = renamedFiles.length
      ? await Image.insertMany(
          renamedFiles.map((file, index) => ({
            filename: `/images/${file.filename}`,
            annotation: pageName,
            type: String(assetTypes[index] || "post").trim() || "post",
            sourceType: "scraped",
            aiGenerated: false,
            generationModel: null,
            usedBy: linkedIdentity ? [{ userId: linkedIdentity._id }] : [],
            annotations: [],
          })),
        )
      : [];

    const page = await Page.create({
      pageName,
      pageId,
      category,
      followerCount,
      likeCount,
      bio,
      generationPrompt,
      linkedIdentities: linkedIdentity ? [linkedIdentity._id] : [],
      assets: createdImages.map((image, index) => ({
        imageId: image._id,
        type: String(assetTypes[index] || "post").trim() || "post",
        postDescription: bio,
        postedAt: null,
        engagementScore,
      })),
    });

    if (linkedIdentity) {
      await syncProfilePageReference({
        pageObjectId: page._id,
        nextProfileId: linkedIdentity._id,
      });
    }

    const populatedPage = await Page.findById(page._id)
      .populate("linkedIdentities", "id firstName lastName pageUrl")
      .populate("assets.imageId")
      .populate("posts.images")
      .lean();

    res.status(201).json(formatPage(populatedPage));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureValidPageId(id)) {
      return res.status(400).json({ message: "Invalid page id" });
    }

    const page = await Page.findById(id);
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const updates = req.body || {};
    const previousLinkedIdentityId = page.linkedIdentities?.[0] || null;

    if (Object.prototype.hasOwnProperty.call(updates, "pageName")) {
      page.pageName = String(updates.pageName || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "pageId")) {
      page.pageId = String(updates.pageId || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "category")) {
      page.category = String(updates.category || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "generationPrompt")) {
      page.generationPrompt = String(updates.generationPrompt || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "followerCount")) {
      page.followerCount = Number.parseInt(updates.followerCount || "0", 10) || 0;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "likeCount")) {
      page.likeCount = Number.parseInt(updates.likeCount || "0", 10) || 0;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "bio")) {
      const bio = String(updates.bio || "").trim();
      page.bio = bio;
      page.assets = (page.assets || []).map((asset) => ({
        ...asset.toObject?.() ? asset.toObject() : asset,
        postDescription: bio,
      }));
    }
    if (Object.prototype.hasOwnProperty.call(updates, "linkedIdentityId")) {
      const linkedIdentityId = String(updates.linkedIdentityId || "").trim();
      if (!linkedIdentityId) {
        page.linkedIdentities = [];
      } else {
        const linkedIdentity = await Profile.findById(linkedIdentityId);
        if (!linkedIdentity) {
          return res.status(404).json({ message: "Assigned profile not found" });
        }
        page.linkedIdentities = [linkedIdentity._id];
      }
    }

    await page.save();

    if (Object.prototype.hasOwnProperty.call(updates, "linkedIdentityId")) {
      await syncProfilePageReference({
        pageObjectId: page._id,
        previousProfileId: previousLinkedIdentityId,
        nextProfileId: page.linkedIdentities?.[0] || null,
      });
    }

    const populatedPage = await Page.findById(page._id)
      .populate("linkedIdentities", "id firstName lastName pageUrl")
      .populate("assets.imageId")
      .populate("posts.images")
      .lean();

    res.json(formatPage(populatedPage));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/images/download", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureValidPageId(id)) {
      return res.status(400).json({ message: "Invalid page id" });
    }

    const page = await Page.findById(id)
      .populate("assets.imageId")
      .lean();

    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const validImages = [
      ...(page.assets || []).map((asset) => asset.imageId),
      ...(page.posts || []).flatMap((post) => post.images || []),
    ].filter((image) => image?.filename);

    if (!validImages.length) {
      return res.status(404).json({ message: "No images found for this page" });
    }

    const safeName = slugify(page.pageName, "page");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-images.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (error) => {
      throw error;
    });
    archive.pipe(res);

    validImages.forEach((image, index) => {
      const relativeFile = String(image.filename || "").replace(/^\/+/, "");
      const absolutePath = path.resolve(projectRoot, "public", relativeFile);

      if (!absolutePath.startsWith(path.resolve(projectRoot, "public"))) {
        return;
      }

      if (!fs.existsSync(absolutePath)) {
        return;
      }

      archive.file(absolutePath, {
        name: path.basename(relativeFile) || `image-${index + 1}`,
      });
    });

    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

router.post("/:id/posts", upload.array("images"), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureValidPageId(id)) {
      return res.status(400).json({ message: "Invalid page id" });
    }

    const postText = String(req.body?.post || "").trim();
    const files = req.files || [];

    if (!postText && !files.length) {
      return res.status(400).json({ message: "Post text or at least one image is required" });
    }

    const page = await Page.findById(id).populate("linkedIdentities", "_id").lean();
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const linkedIdentity = page.linkedIdentities?.[0]?._id || null;
    const renamedFiles = files.map((file) =>
      renameUploadedFile(file, getPageUploadBaseName("post")),
    );

    const createdImages = renamedFiles.length
      ? await Image.insertMany(
          renamedFiles.map((file) => ({
            filename: `/images/${file.filename}`,
            annotation: postText || page.pageName,
            type: "post",
            sourceType: "scraped",
            aiGenerated: false,
            generationModel: null,
            usedBy: linkedIdentity ? [{ userId: linkedIdentity }] : [],
            annotations: [],
          })),
        )
      : [];

    await Page.findByIdAndUpdate(
      id,
      {
        $push: {
          posts: {
            post: postText,
            images: createdImages.map((image) => image._id),
          },
        },
      },
      { new: true, runValidators: true },
    );

    const populatedPage = await Page.findById(id)
      .populate("linkedIdentities", "id firstName lastName pageUrl")
      .populate("assets.imageId")
      .populate("posts.images")
      .lean();

    res.status(201).json(formatPage(populatedPage));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/posts/generate", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureValidPageId(id)) {
      return res.status(400).json({ message: "Invalid page id" });
    }

    const page = await Page.findById(id)
      .populate("linkedIdentities", "firstName lastName")
      .lean();

    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const userInstructions = String(req.body?.instructions || "").trim();
    const result = await generatePostCopy(page, userInstructions);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/posts/bulk-generate", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureValidPageId(id)) {
      return res.status(400).json({ message: "Invalid page id" });
    }

    const page = await Page.findById(id)
      .populate("linkedIdentities", "firstName lastName")
      .lean();

    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const count = Number.parseInt(req.body?.count || "0", 10);
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      return res.status(400).json({ message: "Count must be between 1 and 20." });
    }

    const userInstructions = String(req.body?.instructions || "").trim();
    const result = await generateBulkPostCopies(page, count, userInstructions);
    const updatedPage = await appendGeneratedPostsToPage(id, result.posts);

    res.status(201).json({
      posts: result.posts,
      count: result.posts.length,
      model: result.model,
      page: formatPage(updatedPage),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/images", upload.array("images"), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureValidPageId(id)) {
      return res.status(400).json({ message: "Invalid page id" });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: "Upload at least one image" });
    }

    const page = await Page.findById(id).populate("linkedIdentities", "_id");
    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    const linkedIdentityId = page.linkedIdentities?.[0]?._id || null;
    const postDescription = String(req.body?.postDescription || page.bio || "").trim();
    const engagementScore = Number.parseInt(req.body?.engagementScore || "0", 10) || 0;
    const rawAssetTypes = JSON.parse(String(req.body?.assetTypes || "[]"));

    const renamedFiles = files.map((file, index) =>
      renameUploadedFile(
        file,
        getPageUploadBaseName(String(rawAssetTypes[index] || "post").trim() || "post"),
      ),
    );

    const createdImages = await Image.insertMany(
      renamedFiles.map((file, index) => ({
        filename: `/images/${file.filename}`,
        annotation: page.pageName,
        type: String(rawAssetTypes[index] || "post").trim() || "post",
        sourceType: "scraped",
        aiGenerated: false,
        generationModel: null,
        usedBy: linkedIdentityId ? [{ userId: linkedIdentityId }] : [],
        annotations: [],
      })),
    );

    page.assets.push(
      ...createdImages.map((image, index) => ({
        imageId: image._id,
        type: String(rawAssetTypes[index] || "post").trim() || "post",
        postDescription,
        postedAt: null,
        engagementScore,
      })),
    );

    if (postDescription && !page.bio) {
      page.bio = postDescription;
    }

    await page.save();

    const populatedPage = await Page.findById(id)
      .populate("linkedIdentities", "id firstName lastName pageUrl")
      .populate("assets.imageId")
      .populate("posts.images")
      .lean();

    res.status(201).json(formatPage(populatedPage));
  } catch (error) {
    next(error);
  }
});

export default router;
