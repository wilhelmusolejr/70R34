// One-shot migration: switch the Image/HumanAsset/Post/Profile schema to the
// new structure (Image.humanAssetId back-ref, altText, tags[], Post.status, etc).
//
// MUST run before booting the server with the new models, because the new
// Image schema requires `humanAssetId`.
//
// Run from the server/ directory so mongoose resolves.
// Dry-run by default. Pass --apply to actually write.
//
//   cd server && node scripts/migrate-image-structure.mjs                # preview
//   cd server && node scripts/migrate-image-structure.mjs --apply        # execute
//   cd server && node scripts/migrate-image-structure.mjs --uri mongodb://... --apply
//
// Idempotent: re-running on already-migrated data is a no-op.

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

function parseArgs(argv) {
  const args = { uri: process.env.MONGODB_URI || "", apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--uri") {
      args.uri = argv[i + 1] || args.uri;
      i += 1;
    }
  }
  return args;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.uri) {
    console.error("MONGODB_URI is required (set in server/.env or pass --uri).");
    process.exit(1);
  }

  const mode = args.apply ? "APPLY" : "DRY-RUN";
  console.log(`[migrate] mode=${mode}`);
  console.log(`[migrate] connecting...`);
  await mongoose.connect(args.uri);
  const db = mongoose.connection.db;

  const humanAssets = db.collection("humanassets");
  const images = db.collection("images");
  const profiles = db.collection("profiles");
  const posts = db.collection("posts");
  const pages = db.collection("pages");

  // -------- Step 1: backfill Image.humanAssetId from HumanAsset.images[] --------
  const assetsWithImages = await humanAssets
    .find({ images: { $exists: true, $ne: [] } }, { projection: { _id: 1, images: 1 } })
    .toArray();

  let imagesBackfilled = 0;
  for (const asset of assetsWithImages) {
    const imageIds = (asset.images || []).filter(Boolean);
    if (!imageIds.length) continue;
    if (args.apply) {
      const res = await images.updateMany(
        { _id: { $in: imageIds }, humanAssetId: { $exists: false } },
        { $set: { humanAssetId: asset._id } },
      );
      imagesBackfilled += res.modifiedCount;
    } else {
      const count = await images.countDocuments({
        _id: { $in: imageIds },
        humanAssetId: { $exists: false },
      });
      imagesBackfilled += count;
    }
  }
  console.log(`[step 1] images that got humanAssetId: ${imagesBackfilled}`);

  // -------- Step 2: rename Image.annotation -> altText, type -> tags[], drop usedBy --------
  // Use aggregation pipeline update so we can compute tags from old `type`.
  const imagesToRewrite = await images.countDocuments({
    $or: [
      { annotation: { $exists: true } },
      { type: { $exists: true } },
      { usedBy: { $exists: true } },
      { originalCaption: { $exists: false } },
      { altText: { $exists: false } },
      { tags: { $exists: false } },
    ],
  });
  console.log(`[step 2] images needing field rewrite: ${imagesToRewrite}`);

  if (args.apply && imagesToRewrite > 0) {
    await images.updateMany({}, [
      {
        $set: {
          altText: {
            $ifNull: [
              { $ifNull: ["$altText", "$annotation"] },
              "",
            ],
          },
          originalCaption: { $ifNull: ["$originalCaption", ""] },
          tags: {
            $cond: [
              { $isArray: "$tags" },
              "$tags",
              {
                $cond: [
                  { $and: [{ $ne: ["$type", null] }, { $ne: ["$type", ""] }] },
                  ["$type"],
                  [],
                ],
              },
            ],
          },
        },
      },
      { $unset: ["annotation", "type", "usedBy"] },
    ]);
  }

  // -------- Step 3: drop HumanAsset.images and HumanAsset.numberProfileUsing --------
  const assetsToClean = await humanAssets.countDocuments({
    $or: [
      { images: { $exists: true } },
      { numberProfileUsing: { $exists: true } },
    ],
  });
  console.log(`[step 3] human assets to clean: ${assetsToClean}`);
  if (args.apply && assetsToClean > 0) {
    await humanAssets.updateMany(
      {},
      { $unset: { images: "", numberProfileUsing: "" } },
    );
  }

  // -------- Step 4: backfill Profile.images[].humanAssetId + .tags --------
  const profilesWithImages = await profiles
    .find(
      { "images.0": { $exists: true } },
      { projection: { _id: 1, images: 1 } },
    )
    .toArray();

  let profileEntriesPatched = 0;
  let profilesTouched = 0;
  for (const profile of profilesWithImages) {
    let dirty = false;
    const nextEntries = [];
    for (const entry of profile.images || []) {
      const hasAsset = Boolean(entry?.humanAssetId);
      const hasTags = Array.isArray(entry?.tags);
      if (hasAsset && hasTags) {
        nextEntries.push(entry);
        continue;
      }
      const img = entry?.imageId
        ? await images.findOne(
            { _id: entry.imageId },
            { projection: { humanAssetId: 1 } },
          )
        : null;
      const nextEntry = {
        ...entry,
        humanAssetId: hasAsset ? entry.humanAssetId : img?.humanAssetId || null,
        tags: hasTags ? entry.tags : [],
      };
      nextEntries.push(nextEntry);
      dirty = true;
      profileEntriesPatched += 1;
    }
    if (dirty) {
      profilesTouched += 1;
      if (args.apply) {
        await profiles.updateOne(
          { _id: profile._id },
          { $set: { images: nextEntries } },
        );
      }
    }
  }
  console.log(
    `[step 4] profile image entries patched: ${profileEntriesPatched} across ${profilesTouched} profiles`,
  );

  // -------- Step 5: Post status + postedAt --------
  const postsNeedingStatus = await posts.countDocuments({
    $or: [{ status: { $exists: false } }, { postedAt: { $exists: false } }],
  });
  console.log(`[step 5] posts needing status/postedAt: ${postsNeedingStatus}`);
  if (args.apply && postsNeedingStatus > 0) {
    await posts.updateMany({}, [
      {
        $set: {
          status: {
            $cond: [
              { $ifNull: ["$status", false] },
              "$status",
              {
                $cond: [{ $ne: ["$profileId", null] }, "posted", "draft"],
              },
            ],
          },
          postedAt: {
            $ifNull: [
              "$postedAt",
              {
                $cond: [
                  { $ne: ["$profileId", null] },
                  { $ifNull: ["$assignedAt", null] },
                  null,
                ],
              },
            ],
          },
        },
      },
    ]);
  }

  // -------- Step 6: delete fully-orphaned images --------
  //
  // "Orphan" = not referenced by any HumanAsset.images, Profile.images.imageId,
  // Post.images, OR Page.assets/posts. Page-owned images stay (they have a null
  // humanAssetId but are owned by their Page document).
  const referenced = new Set();
  const assetsForRef = await humanAssets
    .find({}, { projection: { images: 1 } })
    .toArray();
  for (const a of assetsForRef) {
    for (const id of a.images || []) referenced.add(String(id));
  }
  const profilesForRef = await profiles
    .find({ "images.0": { $exists: true } }, { projection: { "images.imageId": 1 } })
    .toArray();
  for (const p of profilesForRef) {
    for (const e of p.images || []) {
      if (e?.imageId) referenced.add(String(e.imageId));
    }
  }
  const postsForRef = await posts
    .find({ images: { $exists: true, $ne: [] } }, { projection: { images: 1 } })
    .toArray();
  for (const p of postsForRef) {
    for (const id of p.images || []) referenced.add(String(id));
  }
  const pagesForRef = await pages
    .find({}, { projection: { "assets.imageId": 1, "posts.images": 1 } })
    .toArray();
  for (const p of pagesForRef) {
    for (const a of p.assets || []) {
      if (a?.imageId) referenced.add(String(a.imageId));
    }
    for (const post of p.posts || []) {
      for (const id of post.images || []) referenced.add(String(id));
    }
  }

  const allImagesLite = await images
    .find({}, { projection: { _id: 1, filename: 1 } })
    .toArray();
  const orphanDocs = allImagesLite.filter((i) => !referenced.has(String(i._id)));
  console.log(`[step 6] fully-orphaned images to delete: ${orphanDocs.length}`);

  if (args.apply && orphanDocs.length) {
    await images.deleteMany({ _id: { $in: orphanDocs.map((o) => o._id) } });
    const publicRoot = path.resolve(__dirname, "..", "..", "public");
    for (const img of orphanDocs) {
      const rel = String(img.filename || "").replace(/^\/+/, "");
      if (!rel) continue;
      const abs = path.resolve(publicRoot, rel);
      if (!abs.startsWith(publicRoot)) continue;
      if (fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
        } catch {
          // best-effort; file may already be gone
        }
      }
    }
  }

  // -------- Sanity (apply mode only): any image still missing humanAssetId? --------
  if (args.apply) {
    const stillOrphaned = await images.countDocuments({ humanAssetId: { $exists: false } });
    if (stillOrphaned > 0) {
      console.warn(
        `[warn] ${stillOrphaned} images STILL have no humanAssetId but are referenced ` +
          `somewhere (Profile.images or Post.images). Server will reject these. ` +
          `Investigate manually.`,
      );
    } else {
      console.log(`[ok] all surviving images have humanAssetId set.`);
    }
  }

  await mongoose.disconnect();
  console.log(`[migrate] done (${mode}).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
