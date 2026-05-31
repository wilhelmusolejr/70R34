import mongoose from "mongoose";
import { Image } from "../models/Image.js";

function normalizeIds(imageIds = []) {
  return imageIds.map((id) => new mongoose.Types.ObjectId(id));
}

export function findUnpostedImages(filter = {}) {
  return Image.find({
    tags: "post",
    postId: null,
    ...filter,
  });
}

export async function assertImagesAvailableForPost(imageIds = []) {
  const normalizedIds = normalizeIds(imageIds);
  const uniqueIds = new Set(normalizedIds.map(String));

  if (uniqueIds.size !== normalizedIds.length) {
    throw new Error("A post cannot contain the same image twice.");
  }

  const images = await Image.find(
    { _id: { $in: normalizedIds } },
    { _id: 1, tags: 1, postId: 1 },
  ).lean();

  if (images.length !== normalizedIds.length) {
    throw new Error("One or more images do not exist.");
  }

  const invalidTag = images.find(
    (image) => !Array.isArray(image.tags) || !image.tags.includes("post"),
  );
  if (invalidTag) {
    throw new Error("Only images tagged 'post' can belong to a Post.");
  }

  const alreadyClaimed = images.find((image) => image.postId);
  if (alreadyClaimed) {
    throw new Error("One or more images already belong to another Post.");
  }
}

export async function claimImagesForPost(postId, imageIds = []) {
  const normalizedIds = normalizeIds(imageIds);

  const result = await Image.updateMany(
    {
      _id: { $in: normalizedIds },
      tags: "post",
      postId: null,
    },
    {
      $set: { postId },
    },
  );

  if (result.modifiedCount !== normalizedIds.length) {
    await Image.updateMany(
      { _id: { $in: normalizedIds }, postId },
      { $set: { postId: null } },
    );
    throw new Error("One or more images were claimed by another post.");
  }
}

export async function releaseImagesFromPost(postId) {
  await Image.updateMany(
    { postId },
    { $set: { postId: null } },
  );
}
