import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { Router } from "express";
import { HumanAsset, HUMAN_ASSET_COUNTRIES } from "../models/HumanAsset.js";
import { Image, IMAGE_SOURCE_TYPES } from "../models/Image.js";
import { Profile } from "../models/Profile.js";
import { fileURLToPath } from "node:url";
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

function slugifyPart(value, fallback = "asset") {
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

function getHumanAssetUploadBaseName(primaryTag, sourceType) {
  const normalizedTag = slugifyPart(primaryTag || sourceType || "post", "post");
  return `image_${normalizedTag}_${randomUUID()}`;
}

function parseTagList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  const raw = String(value || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || "").trim()).filter(Boolean);
      }
    } catch {
      // fall through to csv split
    }
  }
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function parseTagsPerImage(value, count) {
  // Accepts either a stringified JSON array of arrays/strings, or undefined.
  // Returns an array of length `count`, each entry is string[].
  let parsed = [];
  if (Array.isArray(value)) {
    parsed = value;
  } else {
    const raw = String(value || "").trim();
    if (raw) {
      try {
        const json = JSON.parse(raw);
        if (Array.isArray(json)) parsed = json;
      } catch {
        // ignore — fall through to empties
      }
    }
  }
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const entry = parsed[i];
    if (Array.isArray(entry)) {
      result.push(entry.map((v) => String(v || "").trim()).filter(Boolean));
    } else if (typeof entry === "string" && entry.trim()) {
      result.push([entry.trim()]);
    } else {
      result.push([]);
    }
  }
  return result;
}

async function getAssetImages(humanAssetId) {
  return Image.find({ humanAssetId })
    .populate({
      path: "annotations.profileId",
      select: "id firstName lastName profileUrl",
    })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
}

async function getProfilesUsingAsset(humanAssetId) {
  // Need `images` array so we can map per-image usage (imageUsers).
  return Profile.find(
    { "images.humanAssetId": humanAssetId },
    { _id: 1, firstName: 1, lastName: 1, profileUrl: 1, images: 1 },
  ).lean();
}

async function formatHumanAssetById(humanAssetId) {
  const [asset, images, profilesUsing] = await Promise.all([
    HumanAsset.findById(humanAssetId).lean(),
    getAssetImages(humanAssetId),
    getProfilesUsingAsset(humanAssetId),
  ]);
  if (!asset) return null;
  return formatHumanAsset(asset, images, profilesUsing);
}

function formatHumanAsset(asset, imagesRaw, profilesUsing) {
  const images = (imagesRaw || []).map((image) => {
    const mapped = mapImageDoc(image);
    return {
      ...mapped,
      annotations: (image.annotations || []).map((annotation) => ({
        id: String(annotation._id),
        profileId: String(annotation.profileId?._id || annotation.profileId),
        label: annotation.label,
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
      })),
    };
  });

  const usingList = (profilesUsing || []).map((p) => ({
    _id: String(p._id),
    firstName: p.firstName || "",
    lastName: p.lastName || "",
    profileUrl: p.profileUrl || "",
  }));

  // Per-image map keyed by image filename: which profiles have this image assigned.
  // Derived from Profile.images[].imageId (no more Image.usedBy[]).
  const imageUsers = Object.fromEntries(images.map((img) => [img.filename, []]));
  const imageFilenameById = new Map(
    images.map((img) => [String(img._id), img.filename]),
  );
  for (const profile of profilesUsing || []) {
    for (const entry of profile.images || []) {
      const filename = imageFilenameById.get(String(entry?.imageId));
      if (!filename) continue;
      const displayName = [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (displayName) imageUsers[filename].push(displayName);
    }
  }

  const annotationsByImage = Object.fromEntries(
    images.map((img) => [img.filename, img.annotations || []]),
  );

  return {
    id: String(asset._id),
    name: asset.name,
    country: asset.country || "US",
    usedBy: usingList.length,
    numberProfileUsing: usingList,
    profilesUsing: usingList,
    imageUsers,
    annotationsByImage,
    images,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

async function createImagesForAsset({
  humanAssetId,
  files,
  imageTagsPerImage,
  originalCaption,
  altText,
  imageSourceType,
  aiGenerated,
  generationModel,
  selectedProfileIds,
}) {
  if (!files.length) return [];

  const renamedFiles = files.map((file, index) => {
    const primaryTag = imageTagsPerImage[index]?.[0] || "post";
    return renameUploadedFile(
      file,
      getHumanAssetUploadBaseName(primaryTag, imageSourceType),
    );
  });

  const createdImages = await Image.insertMany(
    renamedFiles.map((file, index) => ({
      filename: `/images/${file.filename}`,
      humanAssetId,
      originalCaption: originalCaption || "",
      altText:
        altText ||
        path.basename(file.filename, path.extname(file.filename)),
      tags: imageTagsPerImage[index] || [],
      sourceType: imageSourceType,
      aiGenerated,
      generationModel: generationModel || null,
      annotations: [],
    })),
  );

  // Auto-assign newly-created images to any selected profiles.
  if (selectedProfileIds.length && createdImages.length) {
    const assignAt = new Date();
    await Profile.updateMany(
      { _id: { $in: selectedProfileIds } },
      {
        $addToSet: {
          images: {
            $each: createdImages.map((image) => ({
              humanAssetId,
              imageId: image._id,
              assignedAt: assignAt,
              tags: [],
            })),
          },
        },
      },
    );
  }

  return createdImages;
}

function readUploadFields(req) {
  const originalCaption = String(req.body?.originalCaption || "").trim();
  const altText = String(req.body?.altText || req.body?.imageAnnotation || "").trim();
  const imageSourceType = String(req.body?.imageSourceType || "").trim() || "scraped";
  const aiGenerated = String(req.body?.aiGenerated || "false").trim() === "true";
  const generationModel = String(req.body?.generationModel || "").trim();
  const files = req.files || [];

  // Per-image tags. Two accepted shapes:
  //   1. imageTagsPerImage = JSON `[["profile","cover"], ["post"], ...]`
  //   2. legacy imageTypes  = JSON `["profile", "post", ...]`  → coerced to [["profile"], ["post"], ...]
  let tagsPerImage = parseTagsPerImage(req.body?.imageTagsPerImage, files.length);
  if (!tagsPerImage.some((arr) => arr.length) && req.body?.imageTypes) {
    const legacyTypes = parseTagsPerImage(req.body.imageTypes, files.length);
    tagsPerImage = legacyTypes;
  }

  const selectedProfileIds = []
    .concat(req.body?.numberProfileUsing || req.body?.profileIds || [])
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    originalCaption,
    altText,
    imageSourceType,
    aiGenerated,
    generationModel,
    files,
    tagsPerImage,
    selectedProfileIds,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    const countryInput = String(req.query?.country || "").trim().toUpperCase();
    if (countryInput) {
      if (!HUMAN_ASSET_COUNTRIES.includes(countryInput)) {
        return res.status(400).json({
          message: `country must be one of: ${HUMAN_ASSET_COUNTRIES.join(", ")}`,
        });
      }
      filter.country = countryInput;
    }
    const assets = await HumanAsset.find(filter).sort({ createdAt: -1 }).lean();
    const assetIds = assets.map((a) => a._id);

    const [imagesByAsset, profilesByAsset] = await Promise.all([
      Image.find({ humanAssetId: { $in: assetIds } })
        .populate({
          path: "annotations.profileId",
          select: "id firstName lastName profileUrl",
        })
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      Profile.find(
        { "images.humanAssetId": { $in: assetIds } },
        { _id: 1, firstName: 1, lastName: 1, profileUrl: 1, images: 1 },
      ).lean(),
    ]);

    const imagesIndex = new Map();
    for (const img of imagesByAsset) {
      const key = String(img.humanAssetId);
      if (!imagesIndex.has(key)) imagesIndex.set(key, []);
      imagesIndex.get(key).push(img);
    }

    const profilesIndex = new Map();
    for (const profile of profilesByAsset) {
      const assetIdsInProfile = new Set(
        (profile.images || [])
          .map((e) => e?.humanAssetId)
          .filter(Boolean)
          .map((id) => String(id)),
      );
      for (const id of assetIdsInProfile) {
        if (!profilesIndex.has(id)) profilesIndex.set(id, []);
        profilesIndex.get(id).push(profile);
      }
    }

    const formatted = assets.map((asset) =>
      formatHumanAsset(
        asset,
        imagesIndex.get(String(asset._id)) || [],
        profilesIndex.get(String(asset._id)) || [],
      ),
    );
    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const asset = await formatHumanAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: "Human asset not found" });
    }
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.array("images"), async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const rawCountry = String(req.body?.country || "").trim().toUpperCase();
    const country = HUMAN_ASSET_COUNTRIES.includes(rawCountry) ? rawCountry : "US";
    const fields = readUploadFields(req);

    if (!name) {
      return res.status(400).json({ message: "Human asset name is required" });
    }
    if (!fields.files.length) {
      return res.status(400).json({ message: "At least one image file is required" });
    }

    const linkedProfiles = fields.selectedProfileIds.length
      ? await Profile.find(
          { _id: { $in: fields.selectedProfileIds } },
          { _id: 1 },
        ).lean()
      : [];
    const linkedProfileIds = linkedProfiles.map((p) => p._id);

    const humanAsset = await HumanAsset.create({ name, country });

    await createImagesForAsset({
      humanAssetId: humanAsset._id,
      files: fields.files,
      imageTagsPerImage: fields.tagsPerImage,
      originalCaption: fields.originalCaption,
      altText: fields.altText,
      imageSourceType: fields.imageSourceType,
      aiGenerated: fields.aiGenerated,
      generationModel: fields.generationModel,
      selectedProfileIds: linkedProfileIds,
    });

    const formatted = await formatHumanAssetById(humanAsset._id);
    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/images", upload.array("images"), async (req, res, next) => {
  try {
    const asset = await HumanAsset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    const fields = readUploadFields(req);
    if (!fields.files.length) {
      return res.status(400).json({ message: "At least one image file is required" });
    }

    const linkedProfiles = fields.selectedProfileIds.length
      ? await Profile.find(
          { _id: { $in: fields.selectedProfileIds } },
          { _id: 1 },
        ).lean()
      : [];
    const linkedProfileIds = linkedProfiles.map((p) => p._id);

    await createImagesForAsset({
      humanAssetId: asset._id,
      files: fields.files,
      imageTagsPerImage: fields.tagsPerImage,
      originalCaption: fields.originalCaption,
      altText: fields.altText,
      imageSourceType: fields.imageSourceType,
      aiGenerated: fields.aiGenerated,
      generationModel: fields.generationModel,
      selectedProfileIds: linkedProfileIds,
    });

    const formatted = await formatHumanAssetById(asset._id);
    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/images", async (req, res, next) => {
  try {
    const imageIds = Array.isArray(req.body?.imageIds)
      ? req.body.imageIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];

    if (!imageIds.length) {
      return res.status(400).json({ message: "imageIds array is required" });
    }

    const asset = await HumanAsset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    const owned = await Image.find(
      { _id: { $in: imageIds }, humanAssetId: asset._id },
      { _id: 1, filename: 1 },
    ).lean();
    if (!owned.length) {
      return res.status(404).json({ message: "No matching images found for this human asset" });
    }
    const deletableIds = owned.map((img) => img._id);

    await Profile.updateMany(
      { "images.imageId": { $in: deletableIds } },
      { $pull: { images: { imageId: { $in: deletableIds } } } },
    );

    await Image.deleteMany({ _id: { $in: deletableIds } });

    const publicRoot = path.resolve(projectRoot, "public");
    owned.forEach((image) => {
      const relativeFile = String(image.filename || "").replace(/^\/+/, "");
      const absolutePath = path.resolve(projectRoot, "public", relativeFile);
      if (!absolutePath.startsWith(publicRoot)) return;
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    });

    const formatted = await formatHumanAssetById(asset._id);
    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body?.name === "string") {
      const trimmed = req.body.name.trim();
      if (!trimmed) {
        return res.status(400).json({ message: "name cannot be empty" });
      }
      update.name = trimmed;
    }
    if (typeof req.body?.country === "string") {
      const next = req.body.country.trim().toUpperCase();
      if (!HUMAN_ASSET_COUNTRIES.includes(next)) {
        return res.status(400).json({
          message: `country must be one of: ${HUMAN_ASSET_COUNTRIES.join(", ")}`,
        });
      }
      update.country = next;
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "Nothing to update" });
    }
    const asset = await HumanAsset.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true },
    ).lean();
    if (!asset) return res.status(404).json({ message: "Human asset not found" });
    const formatted = await formatHumanAssetById(asset._id);
    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/images/:imageId", async (req, res, next) => {
  // Update Image metadata by id. Editable fields mirror the Image model:
  // altText, originalCaption, tags, sourceType, aiGenerated, generationModel.
  try {
    const asset = await HumanAsset.findById(req.params.id).lean();
    if (!asset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    const update = {};
    if (typeof req.body?.altText === "string") update.altText = req.body.altText.trim();
    if (typeof req.body?.originalCaption === "string") update.originalCaption = req.body.originalCaption.trim();
    if (req.body?.tags !== undefined) update.tags = parseTagList(req.body.tags);
    if (typeof req.body?.sourceType === "string") {
      const next = req.body.sourceType.trim();
      if (!IMAGE_SOURCE_TYPES.includes(next)) {
        return res.status(400).json({
          message: `sourceType must be one of: ${IMAGE_SOURCE_TYPES.join(", ")}`,
        });
      }
      update.sourceType = next;
    }
    if (req.body?.aiGenerated !== undefined) {
      update.aiGenerated = Boolean(req.body.aiGenerated);
    }
    if (typeof req.body?.generationModel === "string") {
      const trimmed = req.body.generationModel.trim();
      update.generationModel = trimmed || null;
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const result = await Image.findOneAndUpdate(
      { _id: req.params.imageId, humanAssetId: asset._id },
      { $set: update },
      { new: true },
    ).lean();

    if (!result) {
      return res.status(404).json({ message: "Image not found in this asset" });
    }

    const formatted = await formatHumanAssetById(asset._id);
    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/annotations", async (req, res, next) => {
  try {
    const { imageId, profileId, label, x, y, width, height } = req.body || {};

    if (!imageId || !profileId || !label?.trim()) {
      return res.status(400).json({ message: "imageId, profileId, and label are required" });
    }

    const [asset, image, profile] = await Promise.all([
      HumanAsset.findById(req.params.id),
      Image.findById(imageId),
      Profile.findById(profileId),
    ]);
    if (!asset) return res.status(404).json({ message: "Human asset not found" });
    if (!image) return res.status(404).json({ message: "Image not found" });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    if (String(image.humanAssetId) !== String(asset._id)) {
      return res.status(400).json({ message: "Image does not belong to this human asset" });
    }

    image.annotations.push({
      profileId: profile._id,
      label: label.trim(),
      x,
      y,
      width,
      height,
      createdAt: new Date(),
    });

    if (!image.altText) {
      image.altText = label.trim();
    }

    if (!profile.images.some((e) => String(e.imageId) === String(image._id))) {
      profile.images.push({
        humanAssetId: asset._id,
        imageId: image._id,
        assignedAt: new Date(),
        tags: [],
      });
    }

    await Promise.all([image.save(), profile.save()]);

    const formatted = await formatHumanAssetById(asset._id);
    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/assign-image", async (req, res, next) => {
  try {
    const { imageId, profileId } = req.body || {};
    if (!imageId || !profileId) {
      return res.status(400).json({ message: "imageId and profileId are required" });
    }

    const [asset, image, profile] = await Promise.all([
      HumanAsset.findById(req.params.id),
      Image.findById(imageId),
      Profile.findById(profileId),
    ]);
    if (!asset) return res.status(404).json({ message: "Human asset not found" });
    if (!image) return res.status(404).json({ message: "Image not found" });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    if (String(image.humanAssetId) !== String(asset._id)) {
      return res.status(400).json({ message: "Image does not belong to this human asset" });
    }

    if (!profile.images.some((e) => String(e.imageId) === String(image._id))) {
      profile.images.push({
        humanAssetId: asset._id,
        imageId: image._id,
        assignedAt: new Date(),
        tags: [],
      });
      await profile.save();
    }

    const formatted = await formatHumanAssetById(asset._id);
    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/images/download", async (req, res, next) => {
  try {
    const asset = await HumanAsset.findById(req.params.id).lean();
    if (!asset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    const validImages = await Image.find(
      { humanAssetId: asset._id },
      { _id: 1, filename: 1 },
    ).lean();

    if (!validImages.length) {
      return res.status(404).json({ message: "No images found for this human asset" });
    }

    const safeName = String(asset.name || "human-asset")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "human-asset";

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

export default router;
