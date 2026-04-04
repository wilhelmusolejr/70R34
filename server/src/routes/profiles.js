import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { fileURLToPath } from "node:url";
import { Profile } from "../models/Profile.js";
import { User } from "../models/User.js";
import "../models/Image.js";
import "../models/Page.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
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
        imageId: asset.imageId,
        type: asset.type || "post",
        postDescription: asset.postDescription || "",
        engagementScore: asset.engagementScore || 0,
      })),
    posts: (page.posts || []).map((post) => ({
      id: String(post._id),
      post: post.post || "",
      images: (post.images || []).filter((image) => image?.filename),
      createdAt: post.createdAt || null,
    })),
  };
}

function formatProfile(profile) {
  const linkedPage = formatLinkedPage(profile?.pageId);

  return {
    ...profile,
    pageId: linkedPage?.id || (profile?.pageId ? String(profile.pageId) : ""),
    linkedPage,
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const profiles = await Profile.find()
      .populate("images.imageId")
      .populate("pageId", "pageName pageId")
      .sort({ id: 1 })
      .lean();
    res.json(profiles.map(formatProfile));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findOne({ id })
      .populate("images.imageId")
      .populate({
        path: "pageId",
        select: "pageName pageId assets posts",
        populate: [
          { path: "assets.imageId" },
          { path: "posts.images" },
        ],
      })
      .lean();
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(formatProfile(profile));
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

    const lastProfile = await Profile.findOne().sort({ id: -1 }).lean();
    let nextId = (lastProfile?.id ?? 0) + 1;

    let ownerUser = null;
    if (userId) {
      ownerUser = await User.findById(userId);
    }

    const createdByMaker = ownerUser?.role === "maker";
    const documents = incoming.map((profile) => ({
      ...profile,
      status: createdByMaker ? "Pending Profile" : profile.status,
      id: nextId++,
    }));

    let inserted = [];
    try {
      inserted = await Profile.insertMany(documents, { ordered: false });
    } catch (bulkErr) {
      // ordered:false throws BulkWriteError but still inserts valid docs
      if (bulkErr?.insertedDocs?.length) {
        inserted = bulkErr.insertedDocs;
      } else {
        console.error("insertMany failed:", bulkErr.message);
        return res.status(500).json({ message: bulkErr.message || "Insert failed" });
      }
    }

    let updatedUser = null;

    if (ownerUser && inserted.length) {
      if (ownerUser) {
        const existingIds = new Set((ownerUser.profiles || []).map((entry) => entry.profileId));
        const assignedAt = new Date().toISOString().slice(0, 10);

        inserted.forEach((profile) => {
          if (!existingIds.has(profile.id)) {
            ownerUser.profiles.push({
              profileId: profile.id,
              assignedAt,
              assignmentStatus: "pending",
            });
          }
        });

        await ownerUser.save();
        updatedUser = sanitizeUser(ownerUser);
      }
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
        { id: 1, firstName: 1, lastName: 1, emails: 1 },
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

    const payload = {
      ...req.body,
      status: ownerUser?.role === "maker"
        ? "Pending Profile"
        : req.body?.status,
    };
    delete payload.userId;

    const profile = await Profile.create(payload);
    let updatedUser = null;

    if (ownerUser) {
      const alreadyAssigned = (ownerUser.profiles || []).some(
        (entry) => entry.profileId === profile.id,
      );
      if (!alreadyAssigned) {
        ownerUser.profiles.push({
          profileId: profile.id,
          assignedAt: new Date().toISOString().slice(0, 10),
          assignmentStatus: "pending",
        });
        await ownerUser.save();
      }
      updatedUser = sanitizeUser(ownerUser);
    }

    res.status(201).json({ profile, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findOneAndUpdate(
      { id },
      { ...req.body, id },
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
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findOneAndUpdate(
      { id },
      req.body,
      { new: true, runValidators: true },
    );

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/images/download", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findOne({ id })
      .populate("images.imageId")
      .lean();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const validImages = (profile.images || [])
      .map((entry) => entry.imageId)
      .filter((image) => image?.filename);

    if (!validImages.length) {
      return res.status(404).json({ message: "No images found for this profile" });
    }

    const safeName = `${profile.firstName || ""} ${profile.lastName || ""}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `profile-${profile.id}`;

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
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findOneAndDelete({ id });
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
