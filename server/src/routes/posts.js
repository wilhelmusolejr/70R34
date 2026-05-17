import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Router } from "express";
import { Image } from "../models/Image.js";
import { Post } from "../models/Post.js";
import { Profile } from "../models/Profile.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

function isValidId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function populatePostQuery(query) {
  return query
    .populate("images", "filename annotation type")
    .populate("profileId", "firstName lastName");
}

export function formatPost(doc) {
  const post = doc?.toObject ? doc.toObject() : doc;
  return {
    _id: String(post._id),
    images: (post.images || []).map((img) => ({
      _id: String(img._id || img),
      filename: img.filename || "",
      annotation: img.annotation || "",
      type: img.type || "post",
    })),
    caption: post.caption || "",
    context: post.context || "",
    theme: post.theme || "",
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

router.get("/", async (_req, res, next) => {
  try {
    const posts = await populatePostQuery(Post.find()).sort({ createdAt: -1 }).lean();
    res.json(posts.map(formatPost));
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
