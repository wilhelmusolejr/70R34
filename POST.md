# Posts — Backend & AI Grouping Spec

This document describes the **Post** entity, the API surface the Profile Vault frontend already calls, and how a vision-capable AI worker (Claude or Codex, running on the server where the image files live) should turn raw `Image` documents into coherent `Post` bundles ready for assignment to a `Profile`.

It is the contract between:

- The frontend (`src/pages/PostsPage.jsx`, `src/api/posts.js`, profile detail Posts section)
- The backend (`server/src/models/Post.js`, `server/src/routes/posts.js`)
- The AI grouping job (Claude / Codex / any equivalent worker)

> **What changed (this revision):** the worker now runs **on the same machine as `public/images/`** and is a multimodal LLM, so it opens the JPGs directly instead of calling a separate vision API. Group size is now **2–5 images** (minimum **2**), with a randomized target count picked per bundle in that range, and the primary output shifted from "write a polished caption" to "produce a post **idea** (context) backed by 2–5 related images". See §4.

---

## 1. What a Post is

A **Post** is a small bundle of images that would plausibly be shared together as one Facebook post by a fictional person, plus the **idea** behind that post.

Three requirements:

1. **Belong together visually or narratively** — same person, same event, same trip, same theme, same moment. A bundle needs at least two images that share a clear moment.
2. **2–5 images.** Coherence is the hard rule; size is a soft preference. Include only images that genuinely share the moment — **never pad a bundle with unrelated images to hit a number.** When a moment genuinely offers more than two related images, vary how many you take (2–5) so post sizes aren't all identical. If a coherent set has more than 5 images, split it into multiple 2–5 posts; if fewer than 2 images relate, emit nothing and leave them unclaimed. Quality of grouping > size.
3. **No image reuse across Posts.** Each `Image` document belongs to at most one Post. Globally unique. This is the core invariant.

Once created, a Post sits in the **unassigned pool** until it is assigned to exactly one Profile. A Profile can hold multiple Posts; each Post belongs to at most one Profile.

---

## 2. Data model

Collection `posts`. Mongoose schema:

```js
// server/src/models/Post.js
const PostSchema = new Schema(
  {
    images: [{ type: Schema.Types.ObjectId, ref: "Image", required: true }],
    caption: { type: String, default: "" }, // the Facebook caption text
    context: { type: String, default: "" }, // the IDEA — what this post is about
    theme: { type: String, default: "" }, // taxonomy slug: "birthday", "memorial", "vacation", ...
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", default: null },
    assignedAt: { type: Date, default: null },
    generatedBy: { type: String, default: "" }, // e.g. "claude-vision-2026-06", "codex-vision-2026-05", "manual"
    generationModel: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

PostSchema.index({ profileId: 1 });
PostSchema.index({ theme: 1 });
```

### Field meanings

| Field                             | Purpose                                                                                         | Frontend usage                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `images`                          | Ordered list of Image refs. The first image is the hero.                                        | Rendered as a 2×2 preview; if `length > 4` the 4th tile shows `+N` overlay |
| `caption`                         | Short believable Facebook caption written in the persona's voice                                | Shown as the post body (3-line clamp on cards)                             |
| `context`                         | The **idea** — what this post is about ("birthday greeting", "memorial post", "vacation recap") | Shown as a kicker above the caption                                        |
| `theme`                           | Machine-readable category from the §4.5 taxonomy                                                | Used for filtering/analytics                                               |
| `profileId`                       | Owner profile, or `null` if unassigned                                                          | Drives the assigned/unassigned filter and stat cards                       |
| `assignedAt`                      | Timestamp of assignment                                                                         | Reserved                                                                   |
| `generatedBy` / `generationModel` | Provenance for auditability                                                                     | Reserved                                                                   |

`context` is the load-bearing field for AI generation. `caption` can be short or even empty if the persona's voice isn't decidable yet — the assignment step (or a later pass) can refine it once the Post is bound to a Profile.

### Server-side `formatPost`

Always return Posts with `images` populated (filename + altText/annotation) and `profile` populated to `{ _id, firstName, lastName }`. The frontend reads both `post.profile` (preferred) and `post.profileId` (fallback).

```js
function formatPost(doc) {
  const post = doc.toObject ? doc.toObject() : doc;
  return {
    _id: String(post._id),
    images: (post.images || []).map((img) => ({
      _id: String(img._id || img),
      filename: img.filename || "",
      annotation: img.annotation || img.altText || "",
      type:
        img.type ||
        (Array.isArray(img.tags) && img.tags.includes("post") ? "post" : ""),
    })),
    caption: post.caption || "",
    context: post.context || "",
    theme: post.theme || "",
    profileId: post.profileId
      ? String(post.profileId._id || post.profileId)
      : null,
    profile:
      post.profileId && post.profileId.firstName
        ? {
            _id: String(post.profileId._id),
            firstName: post.profileId.firstName,
            lastName: post.profileId.lastName,
          }
        : null,
    assignedAt: post.assignedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
```

### Profile-side mirror

The link is stored on **both sides** to avoid reverse queries on the hot read path. Profile gets a `posts` array of Post refs:

```js
// server/src/models/Profile.js (excerpt)
posts: {
  type: [{ type: Schema.Types.ObjectId, ref: "Post" }],
  default: [],
},
```

`GET /api/profiles/:id` populates this:

```js
.populate({
  path: "posts",
  populate: { path: "images", select: "filename annotation altText tags" },
  options: { sort: { createdAt: -1 } },
})
```

`Post.profileId` remains the source of truth — `Profile.posts` mirrors it. Every assignment route writes both sides in the same handler; see §5.

---

## 3. API contract

All routes below are what the frontend already calls. Match them exactly.

### `GET /api/posts`

Returns every Post in the system.

- Sort by `createdAt: -1` (newest first).
- Populate `images` and `profileId`.
- Response: `Post[]` (array of formatted posts).

### `POST /api/posts` _(used by the AI worker)_

Create a new unassigned Post from a set of unclaimed images.

- Body:
  ```jsonc
  {
    "images": ["<imageId>", "<imageId>"],
    "caption": "Five days in Bali and I'm already plotting the next trip. 🌴",
    "context": "Vacation recap — beach + food from same trip",
    "theme": "vacation",
    "generatedBy": "claude-vision-2026-06",
    "generationModel": "claude-opus-4-7",
    // profileId omitted → Post stays unassigned in the pool
  }
  ```
- Pre-conditions:
  - Every `images[i]` exists in the `Image` collection.
  - Every image has `tags` containing `"post"`.
  - Every image has `postId: null` (not already claimed).
- Behaviour: create the Post, atomically set `Image.postId = <new post id>` on each image (guarded by `postId: null`), and if `profileId` is provided, append to `Profile.posts`.
- Returns the formatted Post.

### `POST /api/posts/:id/assign`

Manually assign a post to a specific profile.

- Body: `{ "profileId": "<ObjectId>" }`
- Pre-conditions: Post exists, Profile exists, profile doesn't already own this Post (no-op if it does).
- Behaviour: set `post.profileId = profileId`, `post.assignedAt = now`. Returns the updated formatted post.
- A Profile **may** own multiple Posts — the UI just hides those profiles from its typeahead; the backend doesn't enforce that.

### `DELETE /api/posts/:id/assign`

Unassign a post (back to the unassigned pool).

- No body. Sets `profileId = null`, `assignedAt = null`. Images stay attached.

### `POST /api/posts/:id/auto-assign`

System picks a profile for this post.

- Body: `{}`
- Selection rule: pick **one Profile that currently has no Posts assigned**, stable ordering (oldest `createdAt` first).
- Race protection: guarded update — `Post.findOneAndUpdate({ _id, profileId: null }, ...)`.
- If no eligible profile, respond `409 Conflict` with `{ message: "No profile without a post is available." }`.

### `POST /api/posts/auto-assign-all`

Bulk variant. Zips unassigned posts (oldest first) with post-less profiles (oldest first). Response:

```jsonc
{
  "posts": [
    /* changed posts, formatted */
  ],
  "assignedCount": 12,
  "skippedCount": 3,
  "failedCount": 0,
}
```

### `DELETE /api/posts/:id`

Permanently delete one Post. In the same handler:

- `$pull` `post._id` from the owning Profile's `posts` array if set.
- For every image in `post.images` whose `postId` still points at this post → set `postId = null`.
- Delete the Post.

Response: `{ ok: true, _id: "<post id>" }`.

### `POST /api/posts/bulk-delete`

Body: `{ ids: ["<postId>", ...] }`. Same cleanup, batched. Response: `{ deletedCount, _ids }`.

### `GET /api/posts/:id/images/download`

Streams a ZIP. Filename: `{firstname-lastname}-post-{YYYY-MM-DD}.zip` when assigned; `post-{id}-{date}.zip` otherwise. Missing files on disk are silently skipped.

### `GET /api/posts/available-images`

The image-grouping worker's input feed. Paginated list of `Image` documents where `tags` includes `"post"` AND `postId === null`.

- Query params: `limit` (default 50, max 200), `skip`, `humanAssetId` (optional filter — recommended for the AI worker so it iterates one persona at a time).
- Response:
  ```jsonc
  {
    "items": [
      {
        "_id": "<imageId>",
        "filename": "/images/image_post_xxx.jpg",
        "humanAssetId": "<humanAssetId>",
        "altText": "",
        "originalCaption": "",
        "tags": ["post"],
      },
    ],
    "total": 142,
  }
  ```

### Failure semantics

All endpoints return `{ message: "..." }` on error with an appropriate 4xx/5xx status.

---

## 4. AI worker — vision-on-disk grouping

This is the AI side. The worker is a multimodal LLM (Claude or Codex) running **on the same host as `public/images/`**, so it opens the JPG/PNG files directly rather than calling a separate vision API.

The goal: scan unclaimed `tags:"post"` images, look at them, group 2–5 that share a clear moment, and produce a **post idea** (context) plus a short caption.

### 4.1 Where the files live

The server serves `/images/<filename>` from `public/images/` (see `server/src/index.js` — `express.static`). For the worker, that resolves to:

```
<repo-root>/public/images/<filename>
```

`Image.filename` in the DB is stored as `/images/<filename>` (with the leading `/images/` segment). When the worker reads the file from disk it should strip that prefix and join with the images dir:

```js
import path from "node:path";
const IMAGES_DIR = path.resolve(process.cwd(), "public/images");
const absPath = path.join(
  IMAGES_DIR,
  image.filename.replace(/^\/images\//, ""),
);
```

`public/images/` is the **only** filesystem source the worker reads. The **database is the source of truth** for eligibility.

### 4.2 Source pool

Query for the next batch of eligible images. Preferably scope to one `humanAssetId` per run so the persona is fixed:

```js
Image.find({
  tags: "post",            // only post-tagged images
  postId: null,            // not already claimed
  humanAssetId: <assetId>, // one persona at a time
}).limit(50);
```

Or via HTTP: `GET /api/posts/available-images?humanAssetId=<assetId>&limit=50`.

An image may be inspected and left unused, then reconsidered later. The worker does not need to remember every image it has ever seen. It only needs to respect `postId`:

- `postId: null` → eligible
- `postId: <Post id>` → already claimed; skip before analysis

Once a set of images is bundled into a Post (via `POST /api/posts`), the backend atomically sets each selected image's `postId` to the new Post's `_id`, so the next worker run won't see them again.

**Hard rule — every image ID emitted must exist in the database.** Re-verify ids exist immediately before posting; records may be deleted between fetch and emit. The frontend renders broken-image placeholders for any id that doesn't resolve, so a Post that ships broken images is worse than no Post at all.

### 4.3 What makes a valid group

A group should answer one question: _"if this were posted today, what would the caption say?"_ If you can't answer in one sentence, the group is wrong.

- **2–3 images:** the typical case — same outfit, same scene, same event, or an obvious narrative pair (before/after, two angles of the same dish).
- **4–5 images:** OK when all of them belong to one event. Don't push past 5.
- **Size rule — coherence is the hard rule, the 2–5 range is a soft preference:** never add an unrelated image just to hit a bigger count. When a single moment genuinely offers more than two related images, vary how many you include (2–5) so post sizes aren't all the same. If a coherent moment has more than 5 images, split it into multiple 2–5 posts. If only one coherent image is left over, leave it unclaimed — a 1-image post is not allowed.

If nothing forms a coherent post, emit nothing for this batch. **Leftover unclaimed images are fine and expected** — they'll be considered next run.

### 4.4 The worker prompt

Paste this prompt verbatim into your AI worker (Claude or Codex), substituting `{{...}}` placeholders at runtime. The worker should be given filesystem access to `public/images/` and HTTP access to the Profile Vault API.

```
You are an image-grouping bot for a fictional-person Facebook automation system. You look at photographs of one persona and produce 0–N Facebook post ideas — each idea is a small cluster of related images (2–5) plus the IDEA behind the post and a short caption.

INPUT
- humanAssetId: {{humanAssetId}}
- persona name: {{personaName}}
- images dir on this server: {{absoluteImagesDir}}
- candidates (unclaimed, tags:"post"): JSON array of { imageId, filename }
{{candidatesJson}}

PROCESS
1. For each candidate, open the file at `{{absoluteImagesDir}}/<filename-without-/images/-prefix>` and look at it. Note the persona's face, scene, outfit, lighting, objects, and mood.
2. Cluster images into 2–5-image bundles where every image in a bundle clearly belongs to the same moment, event, outfit, or narrative. Coherence is the hard rule and the 2–5 range is a soft preference: never add an unrelated image to reach a bigger count. When a moment genuinely offers more than two related images, vary how many you include (2–5) so sizes aren't all identical; if a moment has more than 5, split it into multiple 2–5 bundles.
   - Same outfit + same backdrop → very likely one moment.
   - Same indoor scene with different angles → one moment.
   - One striking portrait/landscape with no obvious siblings → not a post on its own; leave it unclaimed (minimum bundle size is 2).
   - Mixed outfits, mixed scenes, unrelated subjects → keep them apart; leave leftover images unclaimed.
3. For each bundle, decide:
   - theme: one slug from the TAXONOMY list below. Use "everyday" if nothing fits.
   - context: 1 line, ≤ 80 chars, plain English, describing the IDEA — what this post is about. Examples: "Birthday greeting from the persona", "Memorial post — remembering a loved one", "Beach day during a Bali trip", "First Sunday in the new apartment". This is the load-bearing field; it must be specific enough that a human reader knows the intent at a glance.
   - caption: 1–3 short sentences, first-person from the persona's POV, no second-person ("you") voice, at most one emoji, no hashtags unless the theme makes them natural (concerts, weddings).

OUTPUT — strict JSON, no prose around it
{
  "posts": [
    {
      "images": ["<imageId>", ...],
      "theme": "<slug>",
      "context": "<≤80 chars — the IDEA>",
      "caption": "<1–3 sentence FB caption>"
    }
  ]
}

If no coherent bundles can be formed from this batch, return { "posts": [] }.

HARD RULES
- Never reuse an image id across bundles in the same response.
- Never invent or guess an image id. Use only ids from the candidates list.
- Never pad a bundle with unrelated images just to hit the target count. Bundles must have 2–5 images; if fewer than 2 coherent images remain, emit nothing.
- Never invent a theme outside TAXONOMY.
- Never group images of obviously different people unless the theme is "family" or "wedding" and the same people recur.
- Never group a profile/cover photo into a post bundle — only "post"-tagged images reach you, but if a candidate looks like a passport-style headshot, prefer to skip it.

TAXONOMY (use exactly these slugs)
birthday      — cake, candles, party hats, balloons, group portraits with a celebrant
memorial      — black-and-white portraits, candles, gravesite, somber tone. Only group on unambiguous cues.
vacation      — beaches, mountains, hotels, foreign signage, airports, captioned landmarks
daytrip       — single-location outdoor outing that isn't a full vacation. Hike, picnic, day at the lake
food          — plated dishes, restaurant interiors, recipe shots
pet           — same animal across multiple frames
family        — multiple household members who recur across frames
wedding       — white dress, formal attire, ceremony, reception, rings, couple-centric
graduation    — caps, gowns, diplomas, campus signage
holiday       — Christmas, fireworks, Halloween costumes, seasonal decor
work          — office, conference badges, presentations, work milestones
home          — moving boxes, new apartment, renovation reveals
hobby         — same activity gear repeated (guitar, paint, gym, gaming setup)
concert_event — stage lights, ticket stubs, crowd shots, festival wristbands
everyday      — coherent lifestyle bundle that fits nothing else (coffee + reading + walk)
```

### 4.5 Theme taxonomy (canonical list)

| Slug            | When to use it                                                                                         | Caption tone                |
| --------------- | ------------------------------------------------------------------------------------------------------ | --------------------------- |
| `birthday`      | Cake, candles, party hats, balloons, group portraits with a celebrant                                  | Celebratory, emoji-friendly |
| `memorial`      | Black-and-white portraits, candles, gravesite, somber group shots. **Only group on unambiguous cues.** | Reverent, short             |
| `vacation`      | Beaches, mountains, hotels, foreign signage, airports, captioned landmarks                             | Reflective or excited       |
| `daytrip`       | Single-location outdoor outing that isn't a full vacation                                              | Casual                      |
| `food`          | Plated dishes, restaurant interiors, recipe shots                                                      | Foodie / casual             |
| `pet`           | Same animal across multiple frames                                                                     | Affectionate                |
| `family`        | Multiple household members who recur across frames                                                     | Warm                        |
| `wedding`       | White dress, formal attire, ceremony, reception, rings                                                 | Formal, congratulatory      |
| `graduation`    | Caps, gowns, diplomas, campus signage                                                                  | Proud                       |
| `holiday`       | Christmas, fireworks, Halloween, Thanksgiving                                                          | Seasonal                    |
| `work`          | Office, conference badges, presentations, team offsites                                                | Professional but personal   |
| `home`          | Moving boxes, new apartment, renovation reveals                                                        | Domestic                    |
| `hobby`         | Same activity gear repeated (guitar, gym, gaming)                                                      | Enthusiast                  |
| `concert_event` | Stage lights, ticket stubs, crowd shots, festival wristbands                                           | Hyped                       |
| `everyday`      | Catch-all coherent lifestyle bundle                                                                    | Lowkey                      |

Do not invent themes outside this list. If you need a new one, propose it as a doc update first.

### 4.6 Worker execution flow (driver script)

```text
for each humanAssetId in (humanAssets with unclaimed "post" images):
  candidates = GET /api/posts/available-images?humanAssetId=<id>&limit=50
  if candidates.items.length == 0: continue

  result = AI(prompt with candidates injected)   // §4.4
  posts = result.posts                            // [] is valid

  for each bundle in posts:
    // re-verify ids exist and are still unclaimed
    stillEligible = Image.find({ _id: { $in: bundle.images }, postId: null })
    if stillEligible.length !== bundle.images.length: skip bundle

    POST /api/posts {
      images: bundle.images,
      caption: bundle.caption,
      context: bundle.context,
      theme: bundle.theme,
      generatedBy: "claude-vision-2026-06",     // or codex equivalent
      generationModel: "<model id>"
      // profileId omitted — Post enters the unassigned pool
    }
```

The backend's `POST /api/posts` handler does the atomic image claim (guarded `postId: null` update) — the worker does not need to flip `postId` itself. If the claim fails (image was just taken by another run), the API returns 4xx and the worker should skip that bundle.

### 4.7 What NOT to group

- Don't bundle a profile shot + a cover photo + a random post. Only `tags:"post"` images are eligible (the source pool already filters this).
- Don't bundle images of obviously different people unless the theme is `family` or `wedding` and the people recur.
- Don't bundle mixed themes (beach + birthday cake + memorial) to reach a quota. There is no quota.
- Don't reuse an image. The `postId` guard enforces this — failing the guard means another run already claimed it; skip.
- Don't emit an image `_id` that doesn't exist in `Image`. See §4.2's hard rule.

### 4.8 When the pool is thin

If no candidates form a coherent bundle, **emit nothing** for that humanAsset this run. The leftover images sit in the pool until more arrive or a future run sees them differently.

---

## 5. Atomicity, concurrency, and how the link is patched

### Invariants the backend must protect

1. **An image belongs to at most one Post.** Enforce via guarded update on `Image.postId` (`postId: null` precondition).
2. **A Post's `profileId` only transitions `null → <id>` or `<id> → null`.** Never overwrite an existing assignment without an explicit unassign step.
3. **`Profile.posts` and `Post.profileId` always agree.** Both sides update in the same handler.

### Patch flow per route

```text
POST /api/posts                    (create unassigned, claim images)
  1. validate every image: exists, tags includes "post", postId === null
  2. Post.create({ images, caption, context, theme, profileId: profileId || null, ... })
  3. Image.updateMany(
       { _id: { $in: images }, postId: null },          // guard
       { $set: { postId: newPost._id } }
     )
     if matchedCount !== images.length:
       Post.deleteOne(newPost._id)                       // roll back the post
       Image.updateMany({ postId: newPost._id }, { $set: { postId: null } })
       return 409 — some images were just claimed
  4. if profileId: Profile.updateOne(profileId, $addToSet posts: newPost._id)

POST /api/posts/:id/assign        (assign to Profile P)
  1. load post, load Profile P (404 if either missing)
  2. capture oldProfileId from post
  3. if oldProfileId !== P._id:
       post.profileId = P._id; post.assignedAt = now; post.save()
       if oldProfileId: Profile.updateOne(oldProfileId, $pull  posts: post._id)
                          Profile.updateOne(P._id,      $addToSet posts: post._id)

DELETE /api/posts/:id/assign      (unassign)
  1. load post (404 if missing)
  2. capture oldProfileId
  3. post.profileId = null; post.assignedAt = null; post.save()
  4. if oldProfileId: Profile.updateOne(oldProfileId, $pull posts: post._id)

POST /api/posts/:id/auto-assign   (server picks an eligible profile)
  1. for candidate P in unassigned-profiles:
       updated = Post.findOneAndUpdate(
         { _id: postId, profileId: null },              // guard
         { profileId: P._id, assignedAt: now }
       )
       if updated:
         Profile.updateOne(P._id, $addToSet posts: updated._id)
         return formatPost(updated)
  2. else 409 — no eligible profile

POST /api/posts/auto-assign-all   (bulk variant)
  for each (post, profile) pair, run the auto-assign step above

DELETE /api/posts/:id             (delete one)
  1. load post (404 if missing)
  2. Post.deleteOne(post._id)
  3. if post.profileId: Profile.updateOne(profileId, $pull posts: post._id)
  4. Image.updateMany({ _id ∈ post.images, postId: post._id }, $set postId: null)

POST /api/posts/bulk-delete       (delete many)
  same cleanup, batched in one deleteMany + per-profile $pull + one updateMany
```

### Concurrency

Two workers grouping the same image pool, two clients calling `auto-assign` simultaneously — use `findOneAndUpdate` with explicit guards (`profileId: null` for assign, `postId: null` for image claims). Never read-then-write without a guard.

The dual-write pattern is **not transactional** by default. If the Post update succeeds but the Profile update fails, you can end up with a Post pointing at a profile whose `posts` array doesn't list it. The backfill query below converges this state. If split-state becomes a real concern, wrap each handler in a Mongoose `startSession()` transaction.

### Backfill (one-time)

If you add `Profile.posts` to a database where `Post.profileId` is already populated, run once in `mongosh` against your DB:

```js
db.posts
  .find({ profileId: { $ne: null } }, { _id: 1, profileId: 1 })
  .forEach((p) =>
    db.profiles.updateOne(
      { _id: p.profileId },
      { $addToSet: { posts: p._id } },
    ),
  );
```

Idempotent — safe to re-run any time.

---

## 6. JSON samples

The shapes the frontend sees on the wire, including populated subdocuments.

### Post — populated, as returned by `GET /api/posts` / assign endpoints

```jsonc
{
  "_id": "672f1a2b3c4d5e6f7a8b9c01",
  "images": [
    {
      "_id": "672f1a2b3c4d5e6f7a8b9d11",
      "filename": "/images/image_post_a1b2c3d4-e5f6-4789-9012-3456789abcde.jpg",
      "annotation": "Beach at sunset, Bali",
      "type": "post",
    },
    // ...2–5 images total
  ],
  "caption": "Five days in Bali and I'm already plotting the next trip. 🌴",
  "context": "Vacation recap — beach + food from same Bali trip",
  "theme": "vacation",
  "profileId": "672f1a2b3c4d5e6f7a8b9c02", // stringified ObjectId, null when unassigned
  "profile": {
    // null when unassigned
    "_id": "672f1a2b3c4d5e6f7a8b9c02",
    "firstName": "Jane",
    "lastName": "Doe",
  },
  "assignedAt": "2026-05-17T10:30:00.000Z", // null when unassigned
  "createdAt": "2026-05-15T08:00:00.000Z",
  "updatedAt": "2026-05-17T10:30:00.000Z",
}
```

`profile` is a populated mini-doc for display; `profileId` is the stringified id so the frontend can route to `/profile/:id` without unwrapping the populated object. Both are emitted by `formatPost`.

### Profile — post-relevant slice of `GET /api/profiles/:id`

```jsonc
{
  "_id": "672f1a2b3c4d5e6f7a8b9c02",
  "firstName": "Jane",
  "lastName": "Doe",
  // ...all other profile fields
  "posts": [
    {
      "_id": "672f1a2b3c4d5e6f7a8b9c01",
      "caption": "Five days in Bali and I'm already plotting the next trip. 🌴",
      "context": "Vacation recap — beach + food from same Bali trip",
      "theme": "vacation",
      "images": [
        {
          "_id": "672f1a2b3c4d5e6f7a8b9d11",
          "filename": "/images/image_post_a1b2c3d4-e5f6-4789-9012-3456789abcde.jpg",
          "annotation": "Beach at sunset, Bali",
          "type": "post",
        },
      ],
      "profileId": "672f1a2b3c4d5e6f7a8b9c02",
      "assignedAt": "2026-05-17T10:30:00.000Z",
      "createdAt": "2026-05-15T08:00:00.000Z",
      "updatedAt": "2026-05-17T10:30:00.000Z",
    },
  ],
}
```

### Post — what's stored in MongoDB

```jsonc
{
  "_id": "672f1a2b3c4d5e6f7a8b9c01",
  "images": [
    "672f1a2b3c4d5e6f7a8b9d11",
    // ...2–5 ObjectIds
  ],
  "caption": "Five days in Bali and I'm already plotting the next trip. 🌴",
  "context": "Vacation recap — beach + food from same Bali trip",
  "theme": "vacation",
  "profileId": "672f1a2b3c4d5e6f7a8b9c02", // null when unassigned
  "assignedAt": "2026-05-17T10:30:00.000Z",
  "generatedBy": "claude-vision-2026-06",
  "generationModel": "claude-opus-4-7",
  "createdAt": "2026-05-15T08:00:00.000Z",
  "updatedAt": "2026-05-17T10:30:00.000Z",
}
```

### Worker output — what the AI returns before the driver POSTs

```jsonc
{
  "posts": [
    {
      "images": ["672f1a2b3c4d5e6f7a8b9d11", "672f1a2b3c4d5e6f7a8b9d12"],
      "theme": "vacation",
      "context": "Bali trip — beach morning and street food the same day",
      "caption": "Bali mornings hit different. Beach run, then the best nasi goreng of my life. 🌴",
    },
    {
      "images": ["672f1a2b3c4d5e6f7a8b9d20", "672f1a2b3c4d5e6f7a8b9d21"],
      "theme": "memorial",
      "context": "Memorial post for late grandmother — two B&W portraits",
      "caption": "One year today. Still hear your laugh in every kitchen.",
    },
  ],
}
```

---

## 7. Frontend ↔ Backend handshake summary

| Action          | Frontend file              | Frontend function                    | Backend route                        | Returns                                               |
| --------------- | -------------------------- | ------------------------------------ | ------------------------------------ | ----------------------------------------------------- |
| List            | `src/api/posts.js`         | `fetchPosts()`                       | `GET /api/posts`                     | `Post[]`                                              |
| Create          | `src/api/posts.js`         | `createPost(body)`                   | `POST /api/posts`                    | `Post`                                                |
| Assign manual   | `src/api/posts.js`         | `assignPostToProfile(id, profileId)` | `POST /api/posts/:id/assign`         | `Post`                                                |
| Unassign        | `src/api/posts.js`         | `unassignPost(id)`                   | `DELETE /api/posts/:id/assign`       | `Post`                                                |
| Auto-assign one | `src/api/posts.js`         | `autoAssignPost(id)`                 | `POST /api/posts/:id/auto-assign`    | `Post`                                                |
| Auto-assign all | `src/api/posts.js`         | `autoAssignAllPosts()`               | `POST /api/posts/auto-assign-all`    | `{ posts, assignedCount, skippedCount, failedCount }` |
| Delete one      | `src/api/posts.js`         | `deletePost(id)`                     | `DELETE /api/posts/:id`              | `{ ok, _id }`                                         |
| Bulk delete     | `src/api/posts.js`         | `bulkDeletePosts(ids)`               | `POST /api/posts/bulk-delete`        | `{ deletedCount, _ids }`                              |
| Per-post ZIP    | `src/api/postDownloads.js` | `getPostImagesDownloadUrl(id)`       | `GET /api/posts/:id/images/download` | ZIP stream                                            |
| Available pool  | (worker)                   | —                                    | `GET /api/posts/available-images`    | `{ items, total }`                                    |

The image-grouping job is **out of band** — it runs as a worker, not via the frontend. Once it calls `POST /api/posts`, the frontend sees the new posts on the next `GET /api/posts`.

---

## 8. Things deliberately out of scope (for now)

- Editing a Post's caption / context from the UI. Today, Posts are read-only on the frontend except for assignment and deletion. Add an edit endpoint later if needed.
- Image-level analytics (engagement, reach). Posts only track ownership at this stage.
- Multi-language captions. Default to English; revisit when L0r3a starts targeting non-English markets.
- Soft-delete / undo. `DELETE /api/posts/:id` and `POST /api/posts/bulk-delete` are permanent — the Image documents stay (with `postId` cleared so they can be regrouped) but the Post is gone.
- Transactional dual-write. The Post↔Profile sync is two sequential writes, not a Mongo transaction. See §5 for the failure mode and the `$addToSet`-based recovery query.
- Re-running the worker on already-bundled images. The `postId` guard makes this a no-op, so re-runs are safe but produce nothing new for claimed images.
