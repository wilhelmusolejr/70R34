import archiver from "archiver";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { Router } from "express";
import { HumanAsset } from "../models/HumanAsset.js";
import { Image } from "../models/Image.js";
import { Profile } from "../models/Profile.js";
import { fileURLToPath } from "node:url";

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

function formatHumanAsset(humanAsset) {
  const imageUsers = Object.fromEntries(
    (humanAsset.images || []).map((image) => [
      image.filename,
      (image.usedBy || [])
        .map((entry) => [entry.userId?.firstName, entry.userId?.lastName].filter(Boolean).join(" ").trim())
        .filter(Boolean),
    ]),
  );

  const annotationsByImage = Object.fromEntries(
    (humanAsset.images || []).map((image) => [
      image.filename,
      (image.annotations || []).map((annotation) => ({
        id: String(annotation._id),
        profileId: String(annotation.profileId?._id || annotation.profileId),
        label: annotation.label,
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
      })),
    ]),
  );

  return {
    id: String(humanAsset._id),
    name: humanAsset.name,
    possibleProfiles: humanAsset.numberPossibleProfile || 0,
    usedBy: (humanAsset.numberProfileUsing || []).length,
    numberProfileUsing: humanAsset.numberProfileUsing || [],
    images: humanAsset.images || [],
    imageUsers,
    annotationsByImage,
    createdAt: humanAsset.createdAt,
    updatedAt: humanAsset.updatedAt,
  };
}

function populateHumanAssetQuery(query) {
  return query
    .populate({
      path: "images",
      populate: [
        {
          path: "usedBy.userId",
          select: "id firstName lastName profileUrl",
        },
        {
          path: "annotations.profileId",
          select: "id firstName lastName profileUrl",
        },
      ],
    })
    .populate("numberProfileUsing", "id firstName lastName profileUrl");
}

router.get("/", async (_req, res, next) => {
  try {
    const humanAssets = await populateHumanAssetQuery(HumanAsset.find())
      .populate("numberProfileUsing", "id firstName lastName profileUrl")
      .sort({ createdAt: -1 })
      .lean();

    res.json(humanAssets.map(formatHumanAsset));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const humanAsset = await populateHumanAssetQuery(HumanAsset.findById(req.params.id)).lean();

    if (!humanAsset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    res.json(formatHumanAsset(humanAsset));
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.array("images"), async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const numberPossibleProfile = Number.parseInt(req.body?.numberPossibleProfile || "0", 10) || 0;
    const imageAnnotation = String(req.body?.imageAnnotation || "").trim();
    const imageSourceType = String(req.body?.imageSourceType || "").trim() || "scraped";
    const aiGenerated = String(req.body?.aiGenerated || "false").trim() === "true";
    const generationModel = String(req.body?.generationModel || "").trim();
    const imageTypes = JSON.parse(String(req.body?.imageTypes || "[]"));
    const selectedProfileIds = []
      .concat(req.body?.numberProfileUsing || [])
      .flatMap((value) => String(value || "").split(","))
      .map((value) => value.trim())
      .filter(Boolean);
    const files = req.files || [];

    if (!name) {
      return res.status(400).json({ message: "Human asset name is required" });
    }

    if (!files.length) {
      return res.status(400).json({ message: "At least one image file is required" });
    }

    const linkedProfiles = selectedProfileIds.length
      ? await Profile.find({ _id: { $in: selectedProfileIds } }, { _id: 1 }).lean()
      : [];
    const linkedProfileIds = linkedProfiles.map((profile) => profile._id);

    const createdImages = await Image.insertMany(
      files.map((file, index) => ({
        filename: `/images/${file.filename}`,
        annotation: imageAnnotation || path.basename(file.filename, path.extname(file.filename)),
        type: String(imageTypes[index] || "post").trim() || "post",
        sourceType: imageSourceType,
        aiGenerated,
        generationModel: generationModel || null,
        usedBy: linkedProfileIds.map((profileId) => ({ userId: profileId })),
        annotations: [],
      })),
    );

    const postImageIds = createdImages
      .filter((image) => image.type === "post")
      .map((image) => image._id);

    if (linkedProfileIds.length && postImageIds.length) {
      await Profile.updateMany(
        { _id: { $in: linkedProfileIds } },
        {
          $addToSet: {
            images: {
              $each: postImageIds.map((imageId) => ({
                imageId,
                assignedAt: new Date(),
              })),
            },
          },
        },
      );
    }

    const humanAsset = await HumanAsset.create({
      name,
      numberPossibleProfile,
      numberProfileUsing: linkedProfileIds,
      images: createdImages.map((image) => image._id),
    });

    const populatedHumanAsset = await populateHumanAssetQuery(HumanAsset.findById(humanAsset._id)).lean();

    res.status(201).json(formatHumanAsset(populatedHumanAsset));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/images", upload.array("images"), async (req, res, next) => {
  try {
    const humanAsset = await HumanAsset.findById(req.params.id);
    if (!humanAsset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    const imageAnnotation = String(req.body?.imageAnnotation || "").trim();
    const imageSourceType = String(req.body?.imageSourceType || "").trim() || "scraped";
    const aiGenerated = String(req.body?.aiGenerated || "false").trim() === "true";
    const generationModel = String(req.body?.generationModel || "").trim();
    const imageTypes = JSON.parse(String(req.body?.imageTypes || "[]"));
    const selectedProfileIds = []
      .concat(req.body?.numberProfileUsing || [])
      .flatMap((value) => String(value || "").split(","))
      .map((value) => value.trim())
      .filter(Boolean);
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ message: "At least one image file is required" });
    }

    const linkedProfiles = selectedProfileIds.length
      ? await Profile.find({ _id: { $in: selectedProfileIds } }, { _id: 1 }).lean()
      : [];
    const linkedProfileIds = linkedProfiles.map((profile) => profile._id);

    const createdImages = await Image.insertMany(
      files.map((file, index) => ({
        filename: `/images/${file.filename}`,
        annotation: imageAnnotation || path.basename(file.filename, path.extname(file.filename)),
        type: String(imageTypes[index] || "post").trim() || "post",
        sourceType: imageSourceType,
        aiGenerated,
        generationModel: generationModel || null,
        usedBy: linkedProfileIds.map((profileId) => ({ userId: profileId })),
        annotations: [],
      })),
    );

    const postImageIds = createdImages
      .filter((image) => image.type === "post")
      .map((image) => image._id);

    if (linkedProfileIds.length && postImageIds.length) {
      await Profile.updateMany(
        { _id: { $in: linkedProfileIds } },
        {
          $addToSet: {
            images: {
              $each: postImageIds.map((imageId) => ({
                imageId,
                assignedAt: new Date(),
              })),
            },
          },
        },
      );
    }

    humanAsset.images.push(...createdImages.map((image) => image._id));
    linkedProfileIds.forEach((profileId) => {
      if (!humanAsset.numberProfileUsing.some((entry) => String(entry) === String(profileId))) {
        humanAsset.numberProfileUsing.push(profileId);
      }
    });
    await humanAsset.save();

    const populatedHumanAsset = await populateHumanAssetQuery(HumanAsset.findById(humanAsset._id)).lean();

    res.status(201).json(formatHumanAsset(populatedHumanAsset));
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

    const humanAsset = await HumanAsset.findById(req.params.id);
    if (!humanAsset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    const currentImageIds = new Set((humanAsset.images || []).map((id) => String(id)));
    const deletableIds = imageIds.filter((id) => currentImageIds.has(id));

    if (!deletableIds.length) {
      return res.status(404).json({ message: "No matching images found for this human asset" });
    }

    const imagesToDelete = await Image.find({ _id: { $in: deletableIds } }).lean();

    await Profile.updateMany(
      { "images.imageId": { $in: deletableIds } },
      {
        $pull: {
          images: {
            imageId: { $in: deletableIds },
          },
        },
      },
    );

    humanAsset.images = (humanAsset.images || []).filter(
      (imageId) => !deletableIds.includes(String(imageId)),
    );

    const remainingImages = await Image.find(
      { _id: { $in: humanAsset.images } },
      { usedBy: 1 },
    ).lean();

    humanAsset.numberProfileUsing = [
      ...new Set(
        remainingImages.flatMap((image) =>
          (image.usedBy || []).map((entry) => entry.userId),
        ),
      ),
    ];

    await humanAsset.save();
    await Image.deleteMany({ _id: { $in: deletableIds } });

    const publicRoot = path.resolve(projectRoot, "public");
    imagesToDelete.forEach((image) => {
      const relativeFile = String(image.filename || "").replace(/^\/+/, "");
      const absolutePath = path.resolve(projectRoot, "public", relativeFile);

      if (!absolutePath.startsWith(publicRoot)) {
        return;
      }

      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    });

    const populatedHumanAsset = await populateHumanAssetQuery(HumanAsset.findById(humanAsset._id)).lean();
    res.json(formatHumanAsset(populatedHumanAsset));
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

    const [humanAsset, image, profile] = await Promise.all([
      HumanAsset.findById(req.params.id),
      Image.findById(imageId),
      Profile.findById(profileId),
    ]);

    if (!humanAsset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    const annotation = {
      profileId: profile._id,
      label: label.trim(),
      x,
      y,
      width,
      height,
      createdAt: new Date(),
    };

    image.annotations.push(annotation);

    if (!image.usedBy.some((entry) => String(entry.userId) === String(profile._id))) {
      image.usedBy.push({ userId: profile._id });
    }

    if (!image.annotation) {
      image.annotation = label.trim();
    }

    if (!profile.images.some((entry) => String(entry.imageId) === String(image._id))) {
      profile.images.push({
        imageId: image._id,
        assignedAt: new Date(),
      });
    }

    if (!humanAsset.images.some((entry) => String(entry) === String(image._id))) {
      humanAsset.images.push(image._id);
    }

    if (!humanAsset.numberProfileUsing.some((entry) => String(entry) === String(profile._id))) {
      humanAsset.numberProfileUsing.push(profile._id);
    }

    await Promise.all([image.save(), profile.save(), humanAsset.save()]);

    const populatedHumanAsset = await populateHumanAssetQuery(HumanAsset.findById(humanAsset._id)).lean();

    res.status(201).json(formatHumanAsset(populatedHumanAsset));
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

    const [humanAsset, image, profile] = await Promise.all([
      HumanAsset.findById(req.params.id),
      Image.findById(imageId),
      Profile.findById(profileId),
    ]);

    if (!humanAsset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (!image.usedBy.some((entry) => String(entry.userId) === String(profile._id))) {
      image.usedBy.push({ userId: profile._id });
    }

    if (!profile.images.some((entry) => String(entry.imageId) === String(image._id))) {
      profile.images.push({
        imageId: image._id,
        assignedAt: new Date(),
      });
    }

    if (!humanAsset.images.some((entry) => String(entry) === String(image._id))) {
      humanAsset.images.push(image._id);
    }

    if (!humanAsset.numberProfileUsing.some((entry) => String(entry) === String(profile._id))) {
      humanAsset.numberProfileUsing.push(profile._id);
    }

    await Promise.all([image.save(), profile.save(), humanAsset.save()]);

    const populatedHumanAsset = await populateHumanAssetQuery(HumanAsset.findById(humanAsset._id)).lean();

    res.status(201).json(formatHumanAsset(populatedHumanAsset));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/images/download", async (req, res, next) => {
  try {
    const humanAsset = await HumanAsset.findById(req.params.id)
      .populate("images")
      .lean();

    if (!humanAsset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    const validImages = (humanAsset.images || []).filter((image) => image?.filename);
    if (!validImages.length) {
      return res.status(404).json({ message: "No images found for this human asset" });
    }

    const safeName = String(humanAsset.name || "human-asset")
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

export default router;
