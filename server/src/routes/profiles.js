/* global process */
import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { Router } from "express";
import { fileURLToPath } from "node:url";
import { Image } from "../models/Image.js";
import "../models/Post.js";
import {
  Profile,
  PROFILE_STATUSES,
  FRIEND_REQUEST_STATUSES,
  ONBOARDING_KEYS,
} from "../models/Profile.js";
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

// Base URL of the automation bot that runs onboarding steps. Override with the
// BOT_API_URL env var; defaults to the bot listening locally on :3000.
const BOT_API_URL = (process.env.BOT_API_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

function isValidId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function sanitizeUser(user) {
  return {
    id: user._id,
    username: user.username,
    role: user.role,
    defaultCountry: user.defaultCountry || "US",
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

  if (Object.prototype.hasOwnProperty.call(nextPayload, "createdBy")) {
    const rawCreatedBy = nextPayload.createdBy;

    if (rawCreatedBy && typeof rawCreatedBy.toHexString === "function") {
      // Mongoose/BSON ObjectId — `.id` is a 12-byte Buffer, so go straight to hex.
      nextPayload.createdBy = rawCreatedBy.toHexString();
    } else if (rawCreatedBy && typeof rawCreatedBy === "object") {
      const nested = rawCreatedBy._id || rawCreatedBy.id;
      const trimmed =
        nested && typeof nested.toHexString === "function"
          ? nested.toHexString()
          : String(nested || "").trim();
      nextPayload.createdBy = trimmed || null;
    } else {
      const trimmed = String(rawCreatedBy || "").trim();
      nextPayload.createdBy = trimmed || null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "images")) {
    const rawImages = Array.isArray(nextPayload.images) ? nextPayload.images : [];
    nextPayload.images = rawImages
      .map((entry) => {
        if (!entry) return null;
        const rawImageId =
          typeof entry.imageId === "object" && entry.imageId
            ? entry.imageId._id || entry.imageId.id
            : entry.imageId;
        const imageId = String(rawImageId || "").trim();
        if (!imageId) return null;
        const rawAssetId =
          typeof entry.humanAssetId === "object" && entry.humanAssetId
            ? entry.humanAssetId._id || entry.humanAssetId.id
            : entry.humanAssetId;
        const humanAssetId = rawAssetId ? String(rawAssetId).trim() : null;
        const assignedAt = entry.assignedAt ? new Date(entry.assignedAt) : new Date();
        const tags = Array.isArray(entry.tags)
          ? entry.tags.map((t) => String(t || "").trim()).filter(Boolean)
          : [];
        const postCaption =
          typeof entry.postCaption === "string" ? entry.postCaption : "";
        return {
          humanAssetId: humanAssetId || null,
          imageId,
          assignedAt: Number.isNaN(assignedAt.getTime()) ? new Date() : assignedAt,
          tags,
          postCaption,
        };
      })
      .filter(Boolean);
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

  if (Object.prototype.hasOwnProperty.call(nextPayload, "friendRequests")) {
    const rawRequests = Array.isArray(nextPayload.friendRequests)
      ? nextPayload.friendRequests
      : [];
    nextPayload.friendRequests = rawRequests
      .map((entry) => {
        if (!entry) return null;
        const rawId =
          typeof entry.senderProfileId === "object" && entry.senderProfileId
            ? entry.senderProfileId.id ||
              entry.senderProfileId._id ||
              entry.senderProfileId
            : entry.senderProfileId;
        const id = String(rawId || "").trim();
        if (!id) return null;
        const status = String(entry.status || "Pending").trim() || "Pending";
        const receivedAt = entry.receivedAt
          ? new Date(entry.receivedAt)
          : new Date();
        return {
          senderProfileId: id,
          status,
          receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
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

function formatFriendRequestSender(value) {
  if (!value) return null;
  if (typeof value === "object" && value._id) {
    return {
      id: String(value._id),
      firstName: value.firstName || "",
      lastName: value.lastName || "",
      profileUrl: value.profileUrl || "",
      avatarUrl: value.avatarUrl || "",
      status: value.status || "",
    };
  }
  return { id: String(value), firstName: "", lastName: "", profileUrl: "", avatarUrl: "", status: "" };
}

function formatCreatedBy(value) {
  if (!value) return null;
  if (typeof value === "object" && value._id) {
    return {
      id: String(value._id),
      username: value.username || "",
      role: value.role || "",
    };
  }
  return { id: String(value), username: "", role: "" };
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

  const createdBy = formatCreatedBy(profile?.createdBy);

  const friendRequests = (profile?.friendRequests || [])
    .map((entry) => {
      if (!entry) return null;
      const sender = formatFriendRequestSender(entry.senderProfileId);
      if (!sender) return null;
      return {
        senderProfileId: sender,
        status: entry.status || "Pending",
        receivedAt: entry.receivedAt || null,
      };
    })
    .filter(Boolean);

  return {
    ...profile,
    images,
    proxies,
    friendRequests,
    pageId: linkedPage?.id || (profile?.pageId ? String(profile.pageId) : ""),
    linkedPage,
    proxyId: linkedProxy?.id || (profile?.proxyId ? String(profile.proxyId) : ""),
    linkedProxy,
    createdBy,
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
    .populate({
      path: "posts",
      populate: { path: "images", select: "filename altText tags humanAssetId" },
      options: { sort: { createdAt: -1 } },
    })
    .populate("proxyId")
    .populate("proxies.proxyId")
    .populate(
      "friendRequests.senderProfileId",
      "firstName lastName profileUrl avatarUrl status",
    )
    .populate("createdBy", "username role");
}

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
        { path: "createdBy", select: "username role" },
      ]);

      return res.json(populateAndFormat(populated));
    }

    let query = Profile.find(filter)
      .populate("images.imageId")
      .populate("pageId", "pageName pageId")
      .populate("proxyId", "host port username source type protocol status label country city")
      .populate("proxies.proxyId")
      .populate("createdBy", "username role")
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

    // Drop any face-box annotations on this image that pointed at this profile.
    await Image.updateOne(
      { _id: imageId },
      {
        $pull: {
          annotations: { profileId: profile._id },
        },
      },
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
      createdBy: ownerUser?._id || null,
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
      createdBy: ownerUser?._id || null,
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

// Atomic stamp/clear for a single onboarding key — avoids replacing the whole
// subdoc on partial PATCHes.
router.patch("/:id/onboarding/:key", async (req, res, next) => {
  try {
    const { id, key } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }
    if (!ONBOARDING_KEYS.includes(key)) {
      return res.status(400).json({
        message: `Unknown onboarding key. Must be one of: ${ONBOARDING_KEYS.join(", ")}`,
      });
    }

    const rawValue = req.body?.value;
    let value;
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      value = null;
    } else {
      const parsed = new Date(rawValue);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid timestamp value" });
      }
      value = parsed;
    }

    const result = await Profile.updateOne(
      { _id: id },
      { $set: { [`onboarding.${key}`]: value } },
    );
    if (!result.matchedCount) {
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

router.post("/:id/run", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const exists = await Profile.exists({ _id: id });
    if (!exists) {
      return res.status(404).json({ message: "Profile not found" });
    }

    let botResponse;
    try {
      botResponse = await fetch(`${BOT_API_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: `onboard-${id}-${Date.now()}`,
          profiles: [id],
          concurrency: 1,
          steps: [
            { type: "setup_privacy" },
            { type: "setup_about" },
            {
              type: "homepage_interaction",
              steps: [
                { type: "wait", params: { min: 8, max: 15 } },
                { type: "like_posts", params: { count: 2 } },
                { type: "share_posts", params: { count: 1 } },
                { type: "wait", params: { min: 30, max: 50 } },
              ],
            },
            {
              type: "connect_loop",
              params: { count: 5, skipIfFriendsAbove: 30 },
            },
            { type: "wait", params: { min: 10, max: 15 } },
          ],
        }),
      });
    } catch {
      return res.status(502).json({
        message: "Bot server not reachable",
        error: "Bot server not reachable",
      });
    }

    const text = await botResponse.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    return res.status(botResponse.ok ? 200 : botResponse.status).json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/friend-requests", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }

    const senderId = String(req.body?.senderProfileId || "").trim();
    if (!isValidId(senderId)) {
      return res.status(400).json({ message: "Invalid senderProfileId" });
    }
    if (senderId === id) {
      return res.status(400).json({
        message: "A profile cannot send a friend request to itself.",
      });
    }

    const sender = await Profile.findById(senderId).select("_id");
    if (!sender) {
      return res.status(404).json({ message: "Sender profile not found" });
    }

    const result = await Profile.updateOne(
      { _id: id, "friendRequests.senderProfileId": { $ne: senderId } },
      {
        $push: {
          friendRequests: {
            senderProfileId: senderId,
            status: "Pending",
            receivedAt: new Date(),
          },
        },
      },
    );

    if (!result.matchedCount) {
      const exists = await Profile.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ message: "Profile not found" });
      }
      return res.status(409).json({
        message: "A friend request from this sender already exists.",
      });
    }

    const populated = await getPopulatedProfileQuery(id).lean();
    res.status(201).json(formatProfile(populated));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/friend-requests/:senderId", async (req, res, next) => {
  try {
    const { id, senderId } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }
    if (!isValidId(senderId)) {
      return res.status(400).json({ message: "Invalid senderProfileId" });
    }

    const status = String(req.body?.status || "").trim();
    if (!FRIEND_REQUEST_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Status must be one of: ${FRIEND_REQUEST_STATUSES.join(", ")}`,
      });
    }

    const result = await Profile.updateOne(
      { _id: id, "friendRequests.senderProfileId": senderId },
      { $set: { "friendRequests.$.status": status } },
    );

    if (!result.matchedCount) {
      return res.status(404).json({
        message: "Friend request from this sender not found on this profile.",
      });
    }

    const populated = await getPopulatedProfileQuery(id).lean();
    res.json(formatProfile(populated));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/friend-requests/:senderId", async (req, res, next) => {
  try {
    const { id, senderId } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid profile id" });
    }
    if (!isValidId(senderId)) {
      return res.status(400).json({ message: "Invalid senderProfileId" });
    }

    const result = await Profile.updateOne(
      { _id: id, "friendRequests.senderProfileId": senderId },
      { $pull: { friendRequests: { senderProfileId: senderId } } },
    );

    if (!result.matchedCount) {
      const exists = await Profile.exists({ _id: id });
      if (!exists) {
        return res.status(404).json({ message: "Profile not found" });
      }
      return res.status(404).json({
        message: "Friend request from this sender not found on this profile.",
      });
    }

    const populated = await getPopulatedProfileQuery(id).lean();
    res.json(formatProfile(populated));
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
