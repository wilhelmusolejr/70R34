import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Router } from "express";
import { Image } from "../models/Image.js";
import { Post, POST_STATUSES } from "../models/Post.js";
import { Profile } from "../models/Profile.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

function isValidId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

// Country is an optional 2-letter code (US, IT, ...), stored uppercase.
// Empty string clears it. Returns { ok, value } or { ok: false, message }.
function normalizeCountry(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return { ok: true, value: "" };
  if (!/^[A-Z]{2}$/.test(value)) {
    return { ok: false, message: "country must be a 2-letter code (e.g. US)." };
  }
  return { ok: true, value };
}

function populatePostQuery(query) {
  return query
    .populate("images", "filename altText tags humanAssetId originalCaption")
    .populate("profileId", "firstName lastName");
}

export function formatPost(doc) {
  const post = doc?.toObject ? doc.toObject() : doc;
  return {
    _id: String(post._id),
    images: (post.images || []).map((img) => ({
      _id: String(img._id || img),
      filename: img.filename || "",
      altText: img.altText || "",
      originalCaption: img.originalCaption || "",
      tags: Array.isArray(img.tags) ? img.tags : [],
      humanAssetId: img.humanAssetId ? String(img.humanAssetId) : null,
    })),
    caption: post.caption || "",
    context: post.context || "",
    theme: post.theme || "",
    country: post.country || "",
    status: post.status || "draft",
    postedAt: post.postedAt || null,
    profileId: post.profileId ? String(post.profileId._id || post.profileId) : null,
    profile: post.profileId && post.profileId.firstName
      ? {
          _id: String(post.profileId._id),
          firstName: post.profileId.firstName,
          lastName: post.profileId.lastName,
        }
      : null,
    assignedAt: post.assignedAt || null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.country !== undefined) {
      const country = normalizeCountry(req.query.country);
      if (!country.ok) {
        return res.status(400).json({ message: country.message });
      }
      filter.country = country.value;
    }

    const posts = await populatePostQuery(Post.find(filter))
      .sort({ createdAt: -1 })
      .lean();
    res.json(posts.map(formatPost));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const imageIds = Array.isArray(req.body?.images) ? req.body.images : [];
    if (imageIds.length === 0) {
      return res.status(400).json({ message: "Select at least one image." });
    }
    if (!imageIds.every(isValidId)) {
      return res.status(400).json({ message: "One or more image ids are invalid." });
    }

    const profileIdInput = String(req.body?.profileId || "").trim();
    if (profileIdInput && !isValidId(profileIdInput)) {
      return res.status(400).json({ message: "Invalid profile id." });
    }

    const country = normalizeCountry(req.body?.country);
    if (!country.ok) {
      return res.status(400).json({ message: country.message });
    }

    const images = await Image.find({ _id: { $in: imageIds } }).select(
      "_id postId",
    );
    if (images.length !== imageIds.length) {
      return res.status(404).json({ message: "One or more images not found." });
    }
    const claimedCount = images.filter((img) => img.postId).length;
    if (claimedCount > 0) {
      return res.status(409).json({
        message: `${claimedCount} of the selected images are already in another post.`,
      });
    }

    let profile = null;
    if (profileIdInput) {
      profile = await Profile.findById(profileIdInput).select("_id");
      if (!profile) {
        return res.status(404).json({ message: "Profile not found." });
      }
    }

    const post = await Post.create({
      images: imageIds,
      caption: String(req.body?.caption || ""),
      context: String(req.body?.context || ""),
      country: country.value,
      profileId: profile ? profile._id : null,
      assignedAt: profile ? new Date() : null,
    });

    await Image.updateMany(
      { _id: { $in: imageIds } },
      { $set: { postId: post._id } },
    );

    if (profile) {
      await Profile.updateOne(
        { _id: profile._id },
        { $addToSet: { posts: post._id } },
      );
    }

    const populated = await populatePostQuery(Post.findById(post._id)).lean();
    res.status(201).json(formatPost(populated));
  } catch (error) {
    next(error);
  }
});

router.get("/available-images", async (req, res, next) => {
  try {
    const pageInput = Number.parseInt(req.query.page, 10);
    const limitInput = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(pageInput) && pageInput > 0 ? pageInput : 1;
    const limit =
      Number.isInteger(limitInput) && limitInput > 0 && limitInput <= 100
        ? limitInput
        : 30;
    const skip = (page - 1) * limit;

    const filter = { tags: "post", postId: null };

    // Optional: scope to a single human asset so callers can pull a coherent
    // set (multiple photos from the same persona) instead of the global pool.
    const humanAssetIdInput = String(req.query.humanAssetId || "").trim();
    if (humanAssetIdInput) {
      if (!isValidId(humanAssetIdInput)) {
        return res.status(400).json({ message: "Invalid humanAssetId." });
      }
      filter.humanAssetId = humanAssetIdInput;
    }
    const [items, total] = await Promise.all([
      Image.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .select("_id filename altText tags humanAssetId originalCaption createdAt")
        .lean(),
      Image.countDocuments(filter),
    ]);

    const images = items.map((img) => ({
      _id: String(img._id),
      filename: img.filename || "",
      altText: img.altText || "",
      originalCaption: img.originalCaption || "",
      tags: Array.isArray(img.tags) ? img.tags : [],
      humanAssetId: img.humanAssetId ? String(img.humanAssetId) : null,
      createdAt: img.createdAt || null,
    }));
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;
    res.json({
      images,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const postId = String(req.params.id || "").trim();
    if (!isValidId(postId)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found." });

    const body = req.body || {};
    if (typeof body.caption === "string") post.caption = body.caption;
    if (typeof body.context === "string") post.context = body.context;
    if (typeof body.theme === "string") post.theme = body.theme;
    if (Object.prototype.hasOwnProperty.call(body, "country")) {
      const country = normalizeCountry(body.country);
      if (!country.ok) {
        return res.status(400).json({ message: country.message });
      }
      post.country = country.value;
    }
    if (typeof body.status === "string") {
      if (!POST_STATUSES.includes(body.status)) {
        return res.status(400).json({
          message: `status must be one of: ${POST_STATUSES.join(", ")}`,
        });
      }
      const wasPosted = post.status === "posted";
      post.status = body.status;
      if (body.status === "posted" && !wasPosted) {
        post.postedAt = post.postedAt || new Date();
      } else if (body.status !== "posted") {
        post.postedAt = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "postedAt")) {
      post.postedAt = body.postedAt ? new Date(body.postedAt) : null;
    }
    await post.save();

    const populated = await populatePostQuery(Post.findById(post._id)).lean();
    res.json(formatPost(populated));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/images", async (req, res, next) => {
  try {
    const postId = String(req.params.id || "").trim();
    const imageId = String(req.body?.imageId || "").trim();
    if (!isValidId(postId) || !isValidId(imageId)) {
      return res.status(400).json({ message: "Invalid post or image id." });
    }

    const [post, image] = await Promise.all([
      Post.findById(postId).select("_id images"),
      Image.findById(imageId).select("_id postId type"),
    ]);
    if (!post) return res.status(404).json({ message: "Post not found." });
    if (!image) return res.status(404).json({ message: "Image not found." });

    const currentPostId = image.postId ? String(image.postId) : "";
    if (currentPostId && currentPostId !== postId) {
      return res.status(409).json({
        message: "Image is already attached to another post.",
      });
    }

    const claimed = await Image.findOneAndUpdate(
      { _id: image._id, $or: [{ postId: null }, { postId: post._id }] },
      { $set: { postId: post._id } },
      { new: true },
    );
    if (!claimed) {
      return res.status(409).json({
        message: "Image was just claimed by another post.",
      });
    }

    await Post.updateOne(
      { _id: post._id },
      { $addToSet: { images: image._id } },
    );

    const populated = await populatePostQuery(Post.findById(post._id)).lean();
    res.json(formatPost(populated));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/images/:imageId", async (req, res, next) => {
  try {
    const postId = String(req.params.id || "").trim();
    const imageId = String(req.params.imageId || "").trim();
    if (!isValidId(postId) || !isValidId(imageId)) {
      return res.status(400).json({ message: "Invalid post or image id." });
    }

    const post = await Post.findById(postId).select("_id images");
    if (!post) return res.status(404).json({ message: "Post not found." });

    const has = (post.images || []).some(
      (id) => String(id) === imageId,
    );
    if (!has) {
      return res.status(404).json({
        message: "Image is not attached to this post.",
      });
    }

    await Post.updateOne(
      { _id: post._id },
      { $pull: { images: imageId } },
    );
    await Image.updateOne(
      { _id: imageId, postId: post._id },
      { $set: { postId: null } },
    );

    const populated = await populatePostQuery(Post.findById(post._id)).lean();
    res.json(formatPost(populated));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/images/download", async (req, res, next) => {
  try {
    const postId = String(req.params.id || "").trim();
    if (!isValidId(postId)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const post = await Post.findById(postId)
      .populate("images", "filename")
      .populate("profileId", "firstName lastName")
      .lean();

    if (!post) return res.status(404).json({ message: "Post not found." });

    const validImages = (post.images || []).filter((img) => img?.filename);
    if (!validImages.length) {
      return res.status(404).json({ message: "No images found for this post." });
    }

    const owner = post.profileId
      ? `${post.profileId.firstName || ""} ${post.profileId.lastName || ""}`.trim()
      : "";
    const baseName = (owner || `post-${post._id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `post-${post._id}`;
    const datePart = post.createdAt
      ? new Date(post.createdAt).toISOString().slice(0, 10)
      : "post";
    const zipName = `${baseName}-post-${datePart}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (error) => {
      throw error;
    });
    archive.pipe(res);

    validImages.forEach((image, index) => {
      const relativeFile = String(image.filename || "").replace(/^\/+/, "");
      const absolutePath = path.resolve(projectRoot, "public", relativeFile);
      if (!absolutePath.startsWith(path.resolve(projectRoot, "public"))) return;
      if (!fs.existsSync(absolutePath)) return;
      archive.file(absolutePath, {
        name: path.basename(relativeFile) || `image-${index + 1}`,
      });
    });

    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

router.post("/:id/assign", async (req, res, next) => {
  try {
    const postId = String(req.params.id || "").trim();
    const profileId = String(req.body?.profileId || "").trim();
    if (!isValidId(postId) || !isValidId(profileId)) {
      return res.status(400).json({ message: "Invalid post or profile id." });
    }

    const [post, profile] = await Promise.all([
      Post.findById(postId),
      Profile.findById(profileId).select("_id"),
    ]);
    if (!post) return res.status(404).json({ message: "Post not found." });
    if (!profile) return res.status(404).json({ message: "Profile not found." });

    const oldProfileId = post.profileId ? String(post.profileId) : "";
    if (oldProfileId !== profileId) {
      post.profileId = profile._id;
      post.assignedAt = new Date();
      await post.save();
      if (oldProfileId) {
        await Profile.updateOne(
          { _id: oldProfileId },
          { $pull: { posts: post._id } },
        );
      }
      await Profile.updateOne(
        { _id: profile._id },
        { $addToSet: { posts: post._id } },
      );
    }

    const populated = await populatePostQuery(Post.findById(post._id)).lean();
    res.json(formatPost(populated));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/assign", async (req, res, next) => {
  try {
    const postId = String(req.params.id || "").trim();
    if (!isValidId(postId)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found." });

    const oldProfileId = post.profileId ? String(post.profileId) : "";
    post.profileId = null;
    post.assignedAt = null;
    await post.save();
    if (oldProfileId) {
      await Profile.updateOne(
        { _id: oldProfileId },
        { $pull: { posts: post._id } },
      );
    }

    const populated = await populatePostQuery(Post.findById(post._id)).lean();
    res.json(formatPost(populated));
  } catch (error) {
    next(error);
  }
});

async function getEligibleProfiles() {
  const takenIds = await Post.distinct("profileId", { profileId: { $ne: null } });
  return Profile.find({ _id: { $nin: takenIds } }).sort({ createdAt: 1, _id: 1 }).lean();
}

router.post("/:id/auto-assign", async (req, res, next) => {
  try {
    const postId = String(req.params.id || "").trim();
    if (!isValidId(postId)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const exists = await Post.exists({ _id: postId });
    if (!exists) return res.status(404).json({ message: "Post not found." });

    const candidates = await getEligibleProfiles();
    for (const profile of candidates) {
      const stillPostless = !(await Post.exists({ profileId: profile._id }));
      if (!stillPostless) continue;

      const updated = await Post.findOneAndUpdate(
        { _id: postId, profileId: null },
        { profileId: profile._id, assignedAt: new Date() },
        { new: true },
      );
      if (!updated) {
        const current = await populatePostQuery(Post.findById(postId)).lean();
        return res.json(formatPost(current));
      }

      await Profile.updateOne(
        { _id: profile._id },
        { $addToSet: { posts: updated._id } },
      );

      const populated = await populatePostQuery(Post.findById(updated._id)).lean();
      return res.json(formatPost(populated));
    }

    res.status(409).json({ message: "No profile without a post is available." });
  } catch (error) {
    next(error);
  }
});

router.post("/auto-assign-to-profile", async (req, res, next) => {
  try {
    const profileId = String(req.body?.profileId || "").trim();
    if (!isValidId(profileId)) {
      return res.status(400).json({ message: "Invalid profile id." });
    }

    const profile = await Profile.findById(profileId).select("_id country");
    if (!profile) return res.status(404).json({ message: "Profile not found." });

    const alreadyOwns = await Post.exists({ profileId: profile._id });
    if (alreadyOwns) {
      return res.status(409).json({ message: "Profile already owns a post." });
    }

    const country = String(profile.country || "").toUpperCase() || "US";
    // Posts with no country default to US, so a US profile also matches them.
    const countryFilter = country === "US" ? { $in: ["US", ""] } : country;
    const updated = await Post.findOneAndUpdate(
      { profileId: null, country: countryFilter },
      { profileId: profile._id, assignedAt: new Date() },
      { new: true, sort: { createdAt: -1, _id: -1 } },
    );
    if (!updated) {
      return res.status(409).json({
        message: `No unassigned post is available for country ${country}.`,
      });
    }

    await Profile.updateOne(
      { _id: profile._id },
      { $addToSet: { posts: updated._id } },
    );

    const populated = await populatePostQuery(Post.findById(updated._id)).lean();
    res.json(formatPost(populated));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const postId = String(req.params.id || "").trim();
    if (!isValidId(postId)) {
      return res.status(400).json({ message: "Invalid post id." });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found." });

    const profileId = post.profileId ? String(post.profileId) : "";
    const imageIds = Array.isArray(post.images) ? post.images : [];

    await Post.deleteOne({ _id: post._id });

    if (profileId) {
      await Profile.updateOne(
        { _id: profileId },
        { $pull: { posts: post._id } },
      );
    }
    if (imageIds.length) {
      await Image.updateMany(
        { _id: { $in: imageIds }, postId: post._id },
        { $set: { postId: null } },
      );
    }

    res.json({ ok: true, _id: postId });
  } catch (error) {
    next(error);
  }
});

router.post("/bulk-delete", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const valid = ids
      .map((value) => String(value || "").trim())
      .filter((value) => isValidId(value));
    if (!valid.length) {
      return res.status(400).json({ message: "No valid post ids provided." });
    }

    const posts = await Post.find({ _id: { $in: valid } })
      .select("_id profileId images")
      .lean();
    if (!posts.length) {
      return res.status(404).json({ message: "No matching posts found." });
    }

    const postIds = posts.map((p) => p._id);
    const byProfile = new Map();
    const imageIds = [];
    for (const post of posts) {
      if (post.profileId) {
        const key = String(post.profileId);
        const bucket = byProfile.get(key) || [];
        bucket.push(post._id);
        byProfile.set(key, bucket);
      }
      if (Array.isArray(post.images)) {
        imageIds.push(...post.images);
      }
    }

    await Post.deleteMany({ _id: { $in: postIds } });

    for (const [profileId, ids] of byProfile.entries()) {
      await Profile.updateOne(
        { _id: profileId },
        { $pull: { posts: { $in: ids } } },
      );
    }
    if (imageIds.length) {
      await Image.updateMany(
        { _id: { $in: imageIds }, postId: { $in: postIds } },
        { $set: { postId: null } },
      );
    }

    res.json({ deletedCount: posts.length, _ids: postIds.map(String) });
  } catch (error) {
    next(error);
  }
});

router.post("/auto-assign-all", async (_req, res, next) => {
  try {
    const posts = await Post.find({ profileId: null }).sort({ createdAt: 1, _id: 1 }).lean();
    const profiles = await getEligibleProfiles();
    const changed = [];
    let failedCount = 0;

    for (let index = 0; index < posts.length && index < profiles.length; index += 1) {
      try {
        const updated = await Post.findOneAndUpdate(
          { _id: posts[index]._id, profileId: null },
          { profileId: profiles[index]._id, assignedAt: new Date() },
          { new: true },
        );
        if (updated) {
          changed.push(updated._id);
          await Profile.updateOne(
            { _id: profiles[index]._id },
            { $addToSet: { posts: updated._id } },
          );
        }
      } catch {
        failedCount += 1;
      }
    }

    const formatted = await populatePostQuery(Post.find({ _id: { $in: changed } })).lean();
    res.json({
      posts: formatted.map(formatPost),
      assignedCount: formatted.length,
      skippedCount: Math.max(posts.length - formatted.length - failedCount, 0),
      failedCount,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
