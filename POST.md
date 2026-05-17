# Posts — Backend & AI Grouping Spec

This document describes the **Post** entity, the API surface the Profile Vault frontend already calls, and how Codex (or any image-analysis bot) should turn raw `Image` documents into coherent `Post` bundles ready for assignment to a `Profile`.

It is the contract between:

- The frontend (`src/pages/PostsPage.jsx`, `src/api/posts.js`, profile detail Posts section)
- The backend (`server/src/models/Post.js` — to be created, plus routes)
- The AI grouping job (Codex or any equivalent worker)

---

## 1. What a Post is

A **Post** is a bundle of images that would plausibly be shared together as a single Facebook post by a fictional person.

Three requirements:

1. **Belong together visually or narratively** — same event, same trip, same theme, same moment.
2. **At least 4 images** — fewer than 4 should not be created as a Post (UI shows a warning when count < 4).
3. **No image reuse across Posts** — each `Image` document can belong to at most one Post. Globally unique. This is the core invariant.

Once created, a Post sits in the **unassigned pool** until it is assigned to exactly one Profile. A Profile can hold multiple Posts; each Post belongs to at most one Profile.

---

## 2. Data model

Create a new collection `posts`. Suggested Mongoose schema:

```js
// server/src/models/Post.js
const PostSchema = new Schema(
  {
    images: [{ type: Schema.Types.ObjectId, ref: "Image", required: true }],
    caption: { type: String, default: "" },        // the Facebook caption text
    context: { type: String, default: "" },        // short rationale: WHY these images go together
    theme: { type: String, default: "" },          // taxonomy slug: "birthday", "vacation", "pet", ...
    profileId: { type: Schema.Types.ObjectId, ref: "Profile", default: null },
    assignedAt: { type: Date, default: null },
    generatedBy: { type: String, default: "" },    // e.g. "codex-vision-2026-05", "manual"
    generationModel: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

PostSchema.index({ profileId: 1 });
PostSchema.index({ theme: 1 });
```

### Field meanings

| Field | Purpose | Frontend usage |
| --- | --- | --- |
| `images` | Ordered list of Image refs. The first image is treated as the hero. | Rendered as a 2×2 preview; if `length > 4` the 4th tile shows `+N` overlay |
| `caption` | Believable Facebook caption written in the persona's voice | Shown as the post body (3-line clamp on cards) |
| `context` | One-line rationale for the grouping — what event/theme this is | Shown as a kicker above the caption ("Birthday party at Sarah's house") |
| `theme` | Machine-readable category from the taxonomy below | Reserved for filtering/analytics; not yet surfaced |
| `profileId` | Owner profile, or `null` if unassigned | Drives the assigned/unassigned filter and stat cards |
| `assignedAt` | Timestamp of assignment | Reserved |
| `generatedBy` / `generationModel` | Provenance for auditability | Reserved |

### Server-side `formatPost`

Always return Posts with `images` populated (filename + annotation at minimum) and `profile` populated to `{ _id, firstName, lastName, _id }`. The frontend reads both `post.profile` (preferred) and `post.profileId` (fallback).

```js
function formatPost(doc) {
  const post = doc.toObject ? doc.toObject() : doc;
  return {
    _id: String(post._id),
    images: (post.images || []).map((img) => ({
      _id: String(img._id || img),
      filename: img.filename || "",
      annotation: img.annotation || "",
      type: img.type || "post",
    })),
    caption: post.caption || "",
    context: post.context || "",
    theme: post.theme || "",
    profileId: post.profileId ? String(post.profileId._id || post.profileId) : null,
    profile: post.profileId && post.profileId.firstName
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

When `GET /api/profiles` / `GET /api/profiles/:id` runs, include a `posts` array on each Profile so the read-only Posts section on the profile detail and the "N Posts" requirement on the profiles list keep working:

```jsonc
profile.posts = [
  {
    _id: "<post id>",
    caption: "...",
    context: "...",
    images: [{ _id, filename, annotation }],
    createdAt: "..."
  }
]
```

This is just `Post.find({ profileId: profile._id })` mapped through `formatPost`.

---

## 3. API contract

All routes below are what the frontend already calls. Match them exactly.

### `GET /api/posts`

Returns every Post in the system.

- Sort by `createdAt: -1` (newest first).
- Populate `images` and `profileId`.
- Response: `Post[]` (array of formatted posts).

### `POST /api/posts/:id/assign`

Manually assign a post to a specific profile.

- Body: `{ "profileId": "<ObjectId>" }`
- Pre-conditions:
  - Post exists.
  - Profile exists.
  - The profile does not already own this Post (no-op if it does).
- Behaviour: set `post.profileId = profileId`, `post.assignedAt = now`. Returns the updated formatted post.
- A Profile **may** own multiple Posts — do not reject if the profile already has other Posts assigned. The UI hides profiles that already have any Post from the typeahead, but the backend should not enforce that (it lets admins override via the API if needed).

### `DELETE /api/posts/:id/assign`

Unassign a post (back to the unassigned pool).

- No body.
- Behaviour: set `profileId = null`, `assignedAt = null`. The images stay attached to the post — only ownership changes. Returns the updated formatted post.

### `POST /api/posts/:id/auto-assign`

System picks a profile for this post.

- Body: `{}`
- Selection rule: pick **one Profile that currently has no Posts assigned**.
  - `Profile.find({ _id: { $nin: distinct profileIds in posts collection } })`
  - Stable ordering — e.g. oldest `createdAt` first — so repeated calls fill profiles in a predictable order.
- Race protection: use a guarded update so two simultaneous calls can't both pick the same profile. One approach:
  ```js
  // pseudocode
  const candidates = Profile.find({ _id: { $nin: takenIds } }).sort({ createdAt: 1 });
  for (const profile of candidates) {
    const updated = await Post.findOneAndUpdate(
      { _id: postId, profileId: null },               // guard: still unassigned
      { profileId: profile._id, assignedAt: new Date() },
      { new: true },
    );
    if (updated && /* profile is still postless */) return formatPost(updated);
  }
  ```
- If no eligible profile exists, respond `409 Conflict` with `{ message: "No profile without a post is available." }`.

### `POST /api/posts/auto-assign-all`

Bulk version of the above.

- Body: `{}`
- Algorithm:
  1. Load all unassigned posts (`profileId: null`), oldest first.
  2. Load all profiles that currently have zero assigned posts, oldest first.
  3. Zip them — assign post[i] to profile[i] — using the same atomic guard as above.
  4. Stop when either side is exhausted.
- Response shape (the frontend already reads this):
  ```jsonc
  {
    "posts": [/* the Posts whose state changed, formatted */],
    "assignedCount": 12,
    "skippedCount": 3,        // posts that couldn't find a profile
    "failedCount": 0          // unexpected errors per-post
  }
  ```

### Failure semantics

All endpoints return `{ message: "..." }` on error with an appropriate 4xx/5xx status. The frontend `apiFetch` reads `body.message` and surfaces it as a toast.

---

## 4. Image-grouping job (Codex / vision bot)

This is the AI side. The goal: scan unused post-type images and emit `Post` documents whose images "make sense" as one Facebook post.

### 4.1 Source pool

```js
Image.find({
  type: "post",                 // only post-type images
  postId: null,                 // not already claimed by another Post
});
```

`public/images` is only the file store. The **database is the source of truth** for whether an image is still eligible for grouping.

An image may be analyzed and left unused, then reconsidered later when more related images arrive. That is fine and expected. The worker does **not** need to permanently remember every image it has ever inspected.

What it **must** remember is whether an image has already been consumed by an existing Post:

- `postId: null` → eligible for future grouping
- `postId: <Post id>` → already belongs to a Post; skip it before analysis begins

Once a set of images is bundled into a Post, set each selected image's `postId` to the new Post's `_id` so those files are never reconsidered for future Posts even though they remain in `public/images`.

Use a guarded update such as `postId: null` when claiming images so a parallel grouping job can't claim the same image twice. If the guard fails, swap in another candidate.

### 4.2 What makes a valid group

A group should answer one question: *"if this were posted today, what would the caption say?"* If you can't answer in one sentence, the group is wrong.

**Minimum:** 4 images. **Soft maximum:** 10. Above 10 it stops looking like a single Facebook post.

### 4.3 Themes worth grouping (taxonomy for the `theme` field)

This list is the bot's prompt cheat-sheet — not exhaustive, but covers the bulk of believable posts. Use the slug verbatim in `theme`.

| Slug | When to use it | Caption tone | Example context |
| --- | --- | --- | --- |
| `birthday` | Cake, candles, party hats, balloons, grouped portraits with a celebrant. Or the same person across selfie + party shots. | Celebratory, emoji-friendly | "30th birthday dinner with friends" |
| `memorial` | Black-and-white portraits, candles, framed photos, gravesite, memorial flowers, somber group shots. **Be careful** — only group if the visual cue is unambiguous. | Reverent, short | "Remembering grandma — one year today" |
| `vacation` | Beaches, mountains, hotels, foreign signage, airports, captioned landmarks, group travel selfies. Same location across multiple shots. | Reflective or excited | "Five days in Bali — already miss it" |
| `daytrip` | Single-location outdoor activity that doesn't read as a full vacation. Hiking, picnics, day at the lake. | Casual | "Sunday hike at the falls" |
| `food` | Plated dishes, restaurant interiors, recipe shots. 4+ dish photos from the same setting. | Foodie / casual | "Date night at that ramen place" |
| `pet` | Same animal across multiple frames — dog at the park, cat napping, pet at vet. | Affectionate | "Three months with this rescue pup" |
| `family` | Multiple people who recur across the image set, household setting. | Warm | "Saturday lunch with the whole family" |
| `wedding` | White dress, formal attire, ceremony, reception, rings, couple-centric framing. | Formal, congratulatory | "Sarah & James — 06.14.2024" |
| `graduation` | Caps, gowns, diplomas, campus signage, group photos in regalia. | Proud | "Officially done with grad school" |
| `holiday` | Christmas tree, lights, fireworks, Halloween costumes, Thanksgiving table. | Seasonal | "First Christmas in the new place" |
| `work` | Office, conference badges, presentations, "team offsite" framing, work milestones. | Professional but personal | "Wrapping up the launch — proud of this team" |
| `home` | Moving boxes, new apartment shots, renovation before/after, room reveals. | Domestic | "Finally got the place looking like home" |
| `hobby` | Same activity gear repeated — guitars, paint, gym, gaming setup. | Enthusiast | "Six months into this guitar habit" |
| `concert_event` | Stage lights, ticket stubs, crowd shots, festival wristbands. | Hyped | "What a night — best show of the year" |
| `everyday` | Catch-all for cohesive lifestyle bundles that don't fit anything else (coffee + reading + park walk in one day). | Lowkey | "Slow Sunday energy" |

If nothing fits, `theme: "everyday"` is acceptable. **Do not invent themes outside this list** — if you need a new one, propose it as a doc update first.

### 4.4 Signals the bot should use

In rough priority order:

1. **Same face / person identity** — if `HumanAsset.images` includes the same person across multiple frames, those frames trivially belong together. This is the strongest signal and the cheapest one (just group by HumanAsset).
2. **Image annotation text** — `Image.annotation` is the primary cheap signal. Run text similarity / clustering on annotations before falling back to vision. Phrases like "birthday", "Maldives", "wedding", "dog" carry the theme directly.
3. **Visual continuity** — same indoor/outdoor scene, same lighting, same outfits across frames implies a single event.
4. **Filename hints** — sometimes filenames carry dates or tags. Use them as a tiebreaker only.
5. **`Image.createdAt` proximity** — images uploaded close in time are more likely to be one event. Treat this as a weak prior; do not rely on it alone.

### 4.5 Output for each Post

```jsonc
{
  "images": ["<imageId>", "<imageId>", "<imageId>", "<imageId>"],
  "caption": "Five days in Bali and I'm already plotting the next trip. Beach mornings, ridiculous food, no alarms. 🌴",
  "context": "Bali vacation — beach and food shots, same trip",
  "theme": "vacation",
  "generatedBy": "codex-vision-2026-05",
  "generationModel": "<actual model id>"
}
```

**Caption rules:**

- Write in first person from the persona's POV. The persona is the eventual Profile owner — at generation time you don't know which, so write generically ("first trip back to Tokyo" rather than "Sarah's first trip to Tokyo").
- 1–3 sentences. Facebook captions are short.
- One emoji max, optional.
- No hashtags unless the theme makes them natural (concerts, weddings).
- No second-person voice ("you" addressing the reader is uncommon).
- Match the theme's tone column in §4.3.

**Context rules:**

- 1 line, ≤ 80 chars.
- Plain English, no marketing voice.
- Should answer: *"why are these 4 images one post?"*
- Examples: `"Birthday dinner — same group across all shots"`, `"Beach + food from same Bali trip"`, `"Memorial photos — black & white, candles"`.

### 4.6 What NOT to group

- Don't bundle **a profile shot + a cover photo + random posts**. Profile/cover images are reserved for identity, not feed posts. Only `type: "post"` images are eligible.
- Don't bundle **images of obviously different people** unless the theme is `family` or `wedding` and the people recur across frames.
- Don't bundle **mixed themes** (a beach shot + a birthday cake + a memorial photo) just to reach 4 images. Better to leave images unbundled than to ship an incoherent post.
- Don't reuse an image. The `usedBy` guard enforces this — failing the guard means another job already claimed it; pick a different one.

### 4.7 When the pool is thin

If fewer than 4 unused images share a coherent theme, **don't create a Post**. Wait until more images arrive. A small unassigned-image leftover is fine and expected.

---

## 5. Atomicity & concurrency

Two invariants the backend must protect:

1. **An image belongs to at most one Post.** Enforce via guarded update on `Image.postId` (`postId: null` precondition).
2. **A Post's `profileId` only transitions `null → <id>` or `<id> → null`.** Never overwrite an existing assignment without an explicit unassign step.

Both can race: two clients calling `auto-assign` simultaneously, two bots grouping the same image pool, etc. Use `findOneAndUpdate` with explicit guard predicates as shown in §3 and §4.1 — do not read-then-write without a guard.

---

## 6. Frontend ↔ Backend handshake summary

| Action | Frontend file | Frontend function | Backend route | Returns |
| --- | --- | --- | --- | --- |
| List | `src/api/posts.js` | `fetchPosts()` | `GET /api/posts` | `Post[]` |
| Assign manual | `src/api/posts.js` | `assignPostToProfile(id, profileId)` | `POST /api/posts/:id/assign` | `Post` |
| Unassign | `src/api/posts.js` | `unassignPost(id)` | `DELETE /api/posts/:id/assign` | `Post` |
| Auto-assign one | `src/api/posts.js` | `autoAssignPost(id)` | `POST /api/posts/:id/auto-assign` | `Post` |
| Auto-assign all | `src/api/posts.js` | `autoAssignAllPosts()` | `POST /api/posts/auto-assign-all` | `{ posts, assignedCount, skippedCount, failedCount }` |

The image-grouping job is **out of band** — it runs as a worker, not via the HTTP API. Once it writes `Post` documents (and updates `Image.usedBy`), the frontend sees them on the next `GET /api/posts`.

---

## 7. Things deliberately out of scope (for now)

- Editing a Post's caption / context from the UI. Today, Posts are read-only on the frontend except for assignment. Add an edit endpoint later if needed.
- Deleting a Post. If a Post is "wrong," unassign it first, then the worker can rebundle. Hard-delete should also clear the relevant `Image.usedBy` entries — keep the delete path lean rather than implementing it now.
- Image-level analytics (engagement, reach). Posts only track ownership at this stage.
- Multi-language captions. Default to English; revisit when L0r3a starts targeting non-English markets.
