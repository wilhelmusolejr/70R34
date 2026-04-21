import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { Router } from "express";
import { fileURLToPath } from "node:url";
import { HumanAsset } from "../models/HumanAsset.js";
import { Image } from "../models/Image.js";
import { Profile } from "../models/Profile.js";
import { User } from "../models/User.js";
import "../models/Page.js";
import { mapImageDoc } from "../utils/publicImageUrl.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

function isValidId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function sanitizeUser(user) {
  return {
    id: user._id,
    username: user.username,
    role: user.role,
    profiles: user.profiles || [],
  };
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeProfilePayload(payload = {}) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "pageId")) {
    const rawPageId = nextPayload.pageId;

    if (
      rawPageId === null ||
      rawPageId === undefined ||
      String(rawPageId).trim() === ""
    ) {
      nextPayload.pageId = null;
    }
  }

  return nextPayload;
}

function getSelectedEmail(profile) {
  const selectedEmail = (profile?.emails || []).find((email) => email?.selected);
  return normalizeText(selectedEmail?.address);
}

function formatLinkedPage(page) {
  if (!page || typeof page !== "object") return null;

  return {
    id: String(page._id),
    pageName: page.pageName || "",
    pageId: page.pageId || "",
    createdAt: page.createdAt || null,
    updatedAt: page.updatedAt || null,
    assets: (page.assets || [])
      .filter((asset) => asset?.imageId?.filename)
      .map((asset) => ({
        imageId: mapImageDoc(asset.imageId),
        type: asset.type || "post",
        postDescription: asset.postDescription || "",
        engagementScore: asset.engagementScore || 0,
      })),
    posts: (page.posts || []).map((post) => ({
      id: String(post._id),
      post: post.post || "",
      images: (post.images || [])
        .filter((image) => image?.filename)
        .map((image) => mapImageDoc(image)),
      createdAt: post.createdAt || null,
    })),
  };
}

function formatProfile(profile) {
  const linkedPage = formatLinkedPage(profile?.pageId);
  const images = (profile?.images || []).map((entry) => ({
    ...entry,
    imageId: mapImageDoc(entry.imageId),
  }));

  return {
    ...profile,
    images,
    pageId: linkedPage?.id || (profile?.pageId ? String(profile.pageId) : ""),
    linkedPage,
  };
}

function getPopulatedProfileQuery(id) {
  return Profile.findById(id)
    .populate("images.imageId")
    .populate({
      path: "pageId",
      select: "pageName pageId assets posts createdAt updatedAt",
      populate: [
        { path: "assets.imageId" },
        { path: "posts.images" },
      ],
    });
}

router.get("/", async (_req, res, next) => {
  try {
    const profiles = await Profile.find()
      .populate("images.imageId")
      .populate("pageId", "pageName pageId")
      .sort({ _id: 1 })
      .lean();
    res.json(profiles.map(formatProfile));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await getPopulatedProfileQuery(id).lean();
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(formatProfile(profile));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/images/:imageId", async (req, res, next) => {
  try {
    const { id } = req.params;
    const imageId = String(req.params.imageId || "").trim();

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    if (!imageId) {
      return res.status(400).json({ message: "Invalid image id" });
    }

    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const hadAssignment = (profile.images || []).some(
      (entry) => String(entry.imageId) === imageId,
    );

    if (!hadAssignment) {
      return res.status(404).json({ message: "Image is not assigned to this profile" });
    }

    profile.images = (profile.images || []).filter(
      (entry) => String(entry.imageId) !== imageId,
    );
    await profile.save();

    await Image.updateOne(
      { _id: imageId },
      {
        $pull: {
          usedBy: {
            userId: profile._id,
          },
          annotations: {
            profileId: profile._id,
          },
        },
      },
    );

    const impactedAssets = await HumanAsset.find({ images: imageId });

    await Promise.all(
      impactedAssets.map(async (asset) => {
        const remainingImages = await Image.find(
          { _id: { $in: asset.images } },
          { usedBy: 1 },
        ).lean();

        const stillUsesAsset = remainingImages.some((image) =>
          (image.usedBy || []).some((entry) => String(entry.userId) === String(profile._id)),
        );

        if (!stillUsesAsset) {
          asset.numberProfileUsing = (asset.numberProfileUsing || []).filter(
            (entry) => String(entry) !== String(profile._id),
          );
          await asset.save();
        }
      }),
    );

    const populatedProfile = await getPopulatedProfileQuery(id).lean();
    res.json(formatProfile(populatedProfile));
  } catch (error) {
    next(error);
  }
});

router.post("/bulk", async (req, res, next) => {
  try {
    const incoming = req.body?.profiles;
    const userId = String(req.body?.userId || "").trim();
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return res.status(400).json({ message: "profiles array required" });
    }

    let ownerUser = null;
    if (userId) {
      ownerUser = await User.findById(userId);
    }

    const createdByMaker = ownerUser?.role === "maker";
    const documents = incoming.map((profile) => ({
      ...profile,
      status: createdByMaker ? "Pending Profile" : profile.status,
    }));

    let inserted = [];
    try {
      inserted = await Profile.insertMany(documents, { ordered: false });
    } catch (bulkErr) {
      if (bulkErr?.insertedDocs?.length) {
        inserted = bulkErr.insertedDocs;
      } else {
        console.error("insertMany failed:", bulkErr.message);
        return res.status(500).json({ message: bulkErr.message || "Insert failed" });
      }
    }

    let updatedUser = null;

    if (ownerUser && inserted.length) {
      const existingIds = new Set((ownerUser.profiles || []).map((entry) => String(entry.profileId)));
      const assignedAt = new Date().toISOString().slice(0, 10);

      const newAssignments = inserted
        .filter((profile) => !existingIds.has(String(profile._id)))
        .map((profile) => ({
          profileId: profile._id,
          assignedAt,
          assignmentStatus: "pending",
        }));

      if (newAssignments.length) {
        await User.updateOne(
          { _id: ownerUser._id },
          { $push: { profiles: { $each: newAssignments } } },
        );
      }

      const refreshed = await User.findById(ownerUser._id).lean();
      updatedUser = sanitizeUser(refreshed);
    }

    return res.status(201).json({
      created: inserted.length,
      profiles: inserted,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Bulk route error:", error.message);
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const userId = String(req.body?.userId || "").trim();
    let ownerUser = null;
    const incomingSelectedEmail = getSelectedEmail(req.body);

    if (userId) {
      ownerUser = await User.findById(userId);
    }

    if (incomingSelectedEmail) {
      const existingProfiles = await Profile.find(
        { "emails.selected": true },
        { firstName: 1, lastName: 1, emails: 1 },
      ).lean();

      const duplicateProfile = existingProfiles.find(
        (profile) => getSelectedEmail(profile) === incomingSelectedEmail,
      );

      if (duplicateProfile) {
        return res.status(409).json({
          message: `Profile already exists with the selected email ${incomingSelectedEmail}.`,
        });
      }
    }

    const payload = normalizeProfilePayload({
      ...req.body,
      status: ownerUser?.role === "maker"
        ? "Pending Profile"
        : req.body?.status,
    });
    delete payload.userId;

    const profile = await Profile.create(payload);
    let updatedUser = null;

    if (ownerUser) {
      const alreadyAssigned = (ownerUser.profiles || []).some(
        (entry) => String(entry.profileId) === String(profile._id),
      );
      if (!alreadyAssigned) {
        await User.updateOne(
          { _id: ownerUser._id },
          {
            $push: {
              profiles: {
                profileId: profile._id,
                assignedAt: new Date().toISOString().slice(0, 10),
                assignmentStatus: "pending",
              },
            },
          },
        );
      }
      const refreshed = await User.findById(ownerUser._id).lean();
      updatedUser = sanitizeUser(refreshed);
    }

    res.status(201).json({ profile, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findByIdAndUpdate(
      id,
      normalizeProfilePayload(req.body),
      { new: true, overwrite: true, runValidators: true },
    );

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findByIdAndUpdate(
      id,
      normalizeProfilePayload(req.body),
      { new: true, runValidators: true },
    );

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const populatedProfile = await getPopulatedProfileQuery(id).lean();
    res.json(formatProfile(populatedProfile));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/tracker", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const date = String(
      req.body?.date || new Date().toISOString().slice(0, 10),
    ).trim();
    const note = String(req.body?.note || "").trim();

    const updated = await Profile.findOneAndUpdate(
      { _id: id, "trackerLog.date": { $ne: date } },
      { $push: { trackerLog: { date, note } } },
      { new: true },
    );

    if (!updated) {
      const exists = await Profile.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ message: "Profile not found" });
      }
      return res
        .status(409)
        .json({ message: `Tracker entry for ${date} already exists` });
    }

    const populated = await getPopulatedProfileQuery(id).lean();
    res.status(201).json(formatProfile(populated));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/proxy-log", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const body = req.body || {};
    let source = body;

    if (!String(body.ip || "").trim()) {
      const callerIp = String(req.ip || "").replace(/^::ffff:/, "");
      const lookupUrl = callerIp
        ? `https://ipinfo.io/${callerIp}/json`
        : "https://ipinfo.io/json";

      try {
        const ipinfoRes = await fetch(lookupUrl);
        if (!ipinfoRes.ok) {
          return res.status(502).json({
            message: `ipinfo.io returned HTTP ${ipinfoRes.status}`,
          });
        }
        source = await ipinfoRes.json();
      } catch (err) {
        return res.status(502).json({
          message: err.message || "Failed to reach ipinfo.io",
        });
      }
    }

    const entry = {
      ip: String(source.ip || "").trim(),
      city: String(source.city || "").trim(),
      region: String(source.region || "").trim(),
      country: String(source.country || "").trim(),
      loc: String(source.loc || "").trim(),
      org: String(source.org || "").trim(),
      postal: String(source.postal || "").trim(),
      timezone: String(source.timezone || "").trim(),
      checkedAt: new Date(),
    };

    if (!entry.ip) {
      return res.status(400).json({ message: "Could not determine IP address" });
    }

    const updated = await Profile.findByIdAndUpdate(
      id,
      { $push: { proxyLog: entry } },
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const populated = await getPopulatedProfileQuery(id).lean();
    res.status(201).json(formatProfile(populated));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/images/download", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await getPopulatedProfileQuery(id).lean();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const validImages = [
      ...(profile.images || []).map((entry) => entry.imageId),
      ...((profile.pageId?.assets || []).map((asset) => asset.imageId)),
      ...((profile.pageId?.posts || []).flatMap((post) => post.images || [])),
    ]
      .filter((image) => image?.filename);

    if (!validImages.length) {
      return res.status(404).json({ message: "No images found for this profile" });
    }

    const safeName = `${profile.firstName || ""} ${profile.lastName || ""}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `profile-${profile._id}`;

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

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findByIdAndDelete(id);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
