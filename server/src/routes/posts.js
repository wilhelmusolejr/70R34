import mongoose from "mongoose";
import { Router } from "express";
import { Image } from "../models/Image.js";
import { Post } from "../models/Post.js";
import { Profile } from "../models/Profile.js";

const router = Router();

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

    if (String(post.profileId || "") !== profileId) {
      post.profileId = profile._id;
      post.assignedAt = new Date();
      await post.save();
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

    const post = await Post.findByIdAndUpdate(
      postId,
      { profileId: null, assignedAt: null },
      { new: true },
    );
    if (!post) return res.status(404).json({ message: "Post not found." });

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
        if (updated) changed.push(updated._id);
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
