import { Router } from "express";
import { HumanAsset } from "../models/HumanAsset.js";
import "../models/Image.js";
import "../models/Profile.js";

const router = Router();

function formatHumanAsset(humanAsset) {
  const profileNames = (humanAsset.numberProfileUsing || [])
    .map((profile) => [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim())
    .filter(Boolean);

  const imageUsers = Object.fromEntries(
    (humanAsset.images || []).map((image) => [image.filename, profileNames]),
  );

  return {
    id: String(humanAsset._id),
    name: humanAsset.name,
    possibleProfiles: humanAsset.numberPossibleProfile || 0,
    usedBy: (humanAsset.numberProfileUsing || []).length,
    numberProfileUsing: humanAsset.numberProfileUsing || [],
    images: humanAsset.images || [],
    imageUsers,
    createdAt: humanAsset.createdAt,
    updatedAt: humanAsset.updatedAt,
  };
}

router.get("/", async (_req, res, next) => {
  try {
    const humanAssets = await HumanAsset.find()
      .populate("images")
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
    const humanAsset = await HumanAsset.findById(req.params.id)
      .populate("images")
      .populate("numberProfileUsing", "id firstName lastName profileUrl")
      .lean();

    if (!humanAsset) {
      return res.status(404).json({ message: "Human asset not found" });
    }

    res.json(formatHumanAsset(humanAsset));
  } catch (error) {
    next(error);
  }
});

export default router;
