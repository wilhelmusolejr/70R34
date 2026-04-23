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
import {
  Proxy,
  PROXY_PROTOCOLS,
  PROXY_STATUSES,
  PROXY_TYPES,
} from "../models/Proxy.js";
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

function normalizeIp(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw === "::1") return "127.0.0.1";
  if (raw.startsWith("::ffff:")) return raw.slice(7);
  return raw;
}

function isPrivateIpv4(value) {
  return (
    value === "127.0.0.1" ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  );
}

function isPrivateIpv6(value) {
  const normalized = value.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isPublicIp(value) {
  const normalized = normalizeIp(value);
  if (!normalized) return false;
  if (normalized.includes(":")) return !isPrivateIpv6(normalized);
  return !isPrivateIpv4(normalized);
}

function getRequestIpCandidates(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((part) => normalizeIp(part))
    .filter(Boolean);

  const candidates = [
    ...forwardedFor,
    normalizeIp(req.headers["x-real-ip"]),
    normalizeIp(req.ip),
    normalizeIp(req.socket?.remoteAddress),
  ].filter(Boolean);

  return [...new Set(candidates)];
}

async function fetchIpInfoForCandidates(candidates) {
  for (const ip of candidates.filter(isPublicIp)) {
    const response = await fetch(`https://ipinfo.io/${ip}/json`);
    if (!response.ok) continue;

    const data = await response.json();
    if (String(data?.ip || "").trim()) {
      return data;
    }
  }

  const fallbackResponse = await fetch("https://ipinfo.io/json");
  if (!fallbackResponse.ok) {
    throw new Error(`ipinfo.io returned HTTP ${fallbackResponse.status}`);
  }

  return fallbackResponse.json();
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

  if (Object.prototype.hasOwnProperty.call(nextPayload, "proxyId")) {
    const rawProxyId = nextPayload.proxyId;

    if (
      rawProxyId === null ||
      rawProxyId === undefined ||
      String(rawProxyId).trim() === ""
    ) {
      nextPayload.proxyId = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "proxies")) {
    const rawProxies = Array.isArray(nextPayload.proxies) ? nextPayload.proxies : [];
    nextPayload.proxies = rawProxies
      .map((entry) => {
        if (!entry) return null;
        const rawId =
          typeof entry.proxyId === "object" && entry.proxyId
            ? entry.proxyId.id || entry.proxyId._id
            : entry.proxyId;
        const id = String(rawId || "").trim();
        if (!id) return null;
        const assignedAt = entry.assignedAt ? new Date(entry.assignedAt) : new Date();
        return {
          proxyId: id,
          assignedAt: Number.isNaN(assignedAt.getTime()) ? new Date() : assignedAt,
        };
      })
      .filter(Boolean);
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
    bio: page.bio || "",
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

function formatLinkedProxy(proxy) {
  if (!proxy || typeof proxy !== "object") return null;

  return {
    id: String(proxy._id),
    host: proxy.host,
    port: proxy.port,
    username: proxy.username || null,
    password: proxy.password || null,
    source: proxy.source || null,
    type: proxy.type || null,
    protocol: proxy.protocol || null,
    label: proxy.label || null,
    status: proxy.status || null,
    country: proxy.country || null,
    city: proxy.city || null,
  };
}

function formatProfile(profile) {
  const linkedPage = formatLinkedPage(profile?.pageId);
  const linkedProxy = formatLinkedProxy(profile?.proxyId);
  const images = (profile?.images || []).map((entry) => ({
    ...entry,
    imageId: mapImageDoc(entry.imageId),
  }));
  const proxies = (profile?.proxies || [])
    .map((entry) => {
      if (!entry) return null;
      const populated = formatLinkedProxy(entry.proxyId);
      if (populated) {
        return { proxyId: populated, assignedAt: entry.assignedAt || null };
      }
      const rawId = entry.proxyId ? String(entry.proxyId) : "";
      if (!rawId) return null;
      return { proxyId: rawId, assignedAt: entry.assignedAt || null };
    })
    .filter(Boolean);

  return {
    ...profile,
    images,
    proxies,
    pageId: linkedPage?.id || (profile?.pageId ? String(profile.pageId) : ""),
    linkedPage,
    proxyId: linkedProxy?.id || (profile?.proxyId ? String(profile.proxyId) : ""),
    linkedProxy,
  };
}

function getPopulatedProfileQuery(id) {
  return Profile.findById(id)
    .populate("images.imageId")
    .populate({
      path: "pageId",
      select: "pageName pageId bio assets posts createdAt updatedAt",
      populate: [
        { path: "assets.imageId" },
        { path: "posts.images" },
      ],
    })
    .populate("proxyId")
    .populate("proxies.proxyId");
}

const PROFILE_STATUSES = [
  "Available",
  "Need Setup",
  "Pending Profile",
  "Active",
  "Flagged",
  "Banned",
  "Ready",
  "Delivered",
];

router.get("/", async (req, res, next) => {
  try {
    const filter = {};

    const statusInput = String(req.query.status || "").trim();
    if (statusInput) {
      if (!PROFILE_STATUSES.includes(statusInput)) {
        return res.status(400).json({
          message: `Status must be one of: ${PROFILE_STATUSES.join(", ")}`,
        });
      }
      filter.status = statusInput;
    }

    const limitInput = Number.parseInt(req.query.limit, 10);
    const limit =
      Number.isInteger(limitInput) && limitInput > 0 && limitInput <= 500
        ? limitInput
        : null;

    const random = String(req.query.random || "").trim() === "1" ||
      String(req.query.random || "").toLowerCase() === "true";

    const populateAndFormat = (docs) => docs.map(formatProfile);

    if (random && limit !== null) {
      const sampled = await Profile.aggregate([
        { $match: filter },
        { $sample: { size: limit } },
      ]);

      const populated = await Profile.populate(sampled, [
        { path: "images.imageId" },
        { path: "pageId", select: "pageName pageId" },
        {
          path: "proxyId",
          select: "host port username source type protocol status label country city",
        },
        { path: "proxies.proxyId" },
      ]);

      return res.json(populateAndFormat(populated));
    }

    let query = Profile.find(filter)
      .populate("images.imageId")
      .populate("pageId", "pageName pageId")
      .populate("proxyId", "host port username source type protocol status label country city")
      .populate("proxies.proxyId")
      .sort({ _id: 1 });

    if (limit !== null) query = query.limit(limit);

    const profiles = await query.lean();
    res.json(populateAndFormat(profiles));
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
      req.body?.date ||
        new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
    ).trim();
    const note = String(req.body?.note || "").trim();

    const updated = await Profile.findByIdAndUpdate(
      id,
      { $push: { trackerLog: { date, note } } },
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

router.post("/:id/proxies", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const rawEntry = String(req.body?.entry || "").trim();
    if (!rawEntry) {
      return res.status(400).json({ message: "Proxy entry is required." });
    }

    const parts = rawEntry.split(":").map((part) => part.trim());
    if (parts.length < 2) {
      return res.status(400).json({
        message: "Entry must be in host:port[:user:pass] format.",
      });
    }

    const [host, portStr, username = null, password = null] = parts;
    const port = Number.parseInt(portStr, 10);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
      return res.status(400).json({
        message: "Entry must be in host:port[:user:pass] format with a valid port (1–65535).",
      });
    }

    const type = String(req.body?.type || "").trim();
    if (!PROXY_TYPES.includes(type)) {
      return res.status(400).json({
        message: `Type must be one of: ${PROXY_TYPES.join(", ")}`,
      });
    }

    const protocolInput = String(req.body?.protocol || "").trim();
    const protocol = protocolInput
      ? PROXY_PROTOCOLS.includes(protocolInput)
        ? protocolInput
        : null
      : null;
    if (protocolInput && !protocol) {
      return res.status(400).json({
        message: `Protocol must be one of: ${PROXY_PROTOCOLS.join(", ")}`,
      });
    }

    const statusInput = String(req.body?.status || "pending").trim();
    const status = PROXY_STATUSES.includes(statusInput) ? statusInput : "pending";

    const toTrimmedOrNull = (value) => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed || null;
    };

    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    let createdProxy;
    try {
      createdProxy = await Proxy.create({
        host,
        port,
        username: username || null,
        password: password || null,
        source: toTrimmedOrNull(req.body?.source),
        type,
        protocol,
        status,
        label: toTrimmedOrNull(req.body?.label),
        country: toTrimmedOrNull(req.body?.country),
        city: toTrimmedOrNull(req.body?.city),
        notes: toTrimmedOrNull(req.body?.notes),
        tags,
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({
          message: "A proxy with this host:port:user:pass already exists.",
        });
      }
      if (err?.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }

    await Profile.updateOne(
      { _id: id },
      {
        $push: {
          proxies: {
            proxyId: createdProxy._id,
            assignedAt: new Date(),
          },
        },
      },
    );

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
    const requestIpCandidates = getRequestIpCandidates(req);

    if (!String(body.ip || "").trim()) {
      try {
        source = await fetchIpInfoForCandidates(requestIpCandidates);
      } catch (err) {
        const fallbackIp = requestIpCandidates[0] || "";
        source = fallbackIp ? { ip: fallbackIp } : {};

        if (!fallbackIp) {
          return res.status(502).json({
            message: err.message || "Failed to reach ipinfo.io",
          });
        }
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
