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

async function generatePostCopy(page, userInstructions = "") {
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

  const pageProfile = page.linkedIdentities?.[0] || null;
  const promptContext = [
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
        .slice(-3)
        .map((post) => post.post)
        .filter(Boolean)
        .join(" | ") || "None"
    }`,
    `Extra instruction from user: ${userInstructions || "None"}`,
  ].join("\n");

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
      temperature: 0.8,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You write short, natural social-media posts for a Facebook page. Return only the final post text. Do not use hashtags unless the context strongly calls for them. Do not add quotes, titles, labels, or explanations.",
        },
        {
          role: "user",
          content: `Write one engaging post for this page.\n\n${promptContext}`,
        },
      ],
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

  const payload = await response.json();
  const post = extractGeneratedText(payload);

  if (!post) {
    throw new Error("GitHub Models returned an empty response.");
  }

  return {
    post,
    model,
  };
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
