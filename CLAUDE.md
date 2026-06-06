# Profile Vault

Dashboard for managing fictional Facebook automation assets. Part of the L0r3a automation system.

## Stack

- React 19 + Vite (JSX, no TypeScript)
- React Router v6 for routing
- Plain CSS (`App.css`, `index.css`) — no Tailwind, no CSS modules
- No state management library — local `useState` + `useAuth` context
- Backend via REST API at `VITE_API_URL` (default `http://localhost:4000`)

## Running

```bash
npm run dev    # dev server
npm run build  # production build
```

## Routes

- `/` — **Dashboard** (was Profiles before; landing page is now activity overview)
- `/profiles` — Profiles list (was `/`)
- `/profile/:id` — Profile detail
- `/images`, `/images/:id` — Image asset list + detail
- `/pages`, `/pages/:id` — Pages list + detail
- `/posts` — Posts
- `/proxies` — Proxies
- `/sharers` — Sharers
- `/logs` — Logs

When changing the routing, also update `getDocumentTitle` in `src/App.jsx` and any in-page `navigate("/...")` / `<Link to="/...">` references — there is no internal redirect from `/` to `/profiles`.

## The Core Entities

### 1. Profiles (`/profiles`)
Fictional person identities used for Facebook accounts. Each profile has:
- Personal info: name, gender, DOB, city, hometown, bio
- Contact: emails (multiple, one selected), passwords (email + Facebook), phone, recovery email
- Life details: work history, education, relationship status, languages, interests, travel
- Browser assignments: `browsers` array — `{ browserId, provider }` (e.g. hidemium)
- Account state: status, tags, tracker log, `has2FA`, `hasPage`, `profileSetup`
- API: `/api/profiles` — CRUD + bulk create + image unassign + `POST /:id/proxies` (create+attach) + `POST /:id/proxy-log`
- **IDs:** profiles use MongoDB `_id` (ObjectId string) — not a numeric `id` field. All routes and frontend refs use `_id`.

#### Profile shape (source: `server/src/models/Profile.js`)

Every field has a default, so a brand-new profile with only required `firstName` / `lastName` already has the full shape below populated with empty values.

```jsonc
{
  "_id": "ObjectId",
  "firstName": "Jane",              // required
  "lastName": "Doe",                // required
  "dob": "1994-07-12",              // string, YYYY-MM-DD
  "gender": "female",               // free-text, UI classes it as male/female/neutral
  "emails": [                       // one entry should have selected: true
    { "address": "jane@example.com", "selected": true }
  ],
  "emailPassword": "",
  "facebookPassword": "",

  // --- PROXY FIELDS ---
  "proxy": "",                      // legacy free-text proxy string (kept for back-compat)
  "proxyLocation": "",              // legacy free-text location
  "proxyId": "ObjectId|null",       // SINGULAR — primary assigned Proxy (populates to linkedProxy)
  "proxies": [                      // ARRAY of Proxy refs (like images). Populated on read:
    {
      "proxyId": {                  // full populated Proxy doc (see Proxies entity)
        "id": "ObjectId",
        "host": "gate.example.com",
        "port": 8080,
        "username": "user",
        "password": "pass",
        "type": "residential",      // residential | isp | datacenter | mobile
        "protocol": "http",         // http | https | socks5 | null
        "status": "pending",        // pending | active | inactive | dead | expired
        "source": "IPRoyal",
        "label": null, "country": "US", "city": null
      },
      "assignedAt": "2026-04-22T00:00:00.000Z"
    }
  ],
  "proxyLog": [                     // append-only IP-check history
    {
      "ip": "1.2.3.4", "city": "NYC", "region": "NY", "country": "US",
      "loc": "40.71,-74.00", "org": "AS... ISP", "postal": "10001",
      "timezone": "America/New_York", "checkedAt": "ISO date"
    }
  ],

  "city": "", "hometown": "", "bio": "",
  "status": "Available",            // Available | Need Setup | Pending Profile | Active | Flagged | Banned | Ready | Delivered
  "tags": ["us", "bulk-a"],
  "profileUrl": "", "pageUrl": "",
  "pageId": "ObjectId|null",        // populates to linkedPage on read
  "profileCreated": "", "accountCreated": "",
  "friends": 0,
  "has2FA": false, "hasPage": false, "profileSetup": false,
  "recoveryEmail": "", "phone": "", "notes": "",
  "avatarUrl": "", "coverPhotoUrl": "",
  "websites": [],
  "socialLinks": [{ "platform": "instagram", "url": "..." }],

  "images": [                       // shape that `proxies` now mirrors
    {
      "imageId": "ObjectId | <populated Image>",
      "humanAssetId": "ObjectId|null",
      "assignedAt": "ISO date",
      "tags": ["post"],             // ASSIGNMENT tags — per-profile, editable from profile detail page modal
      "postCaption": ""             // caption used when THIS profile posts THIS image to FB
    }
  ],
  "trackerLog": [{ "date": "2026-04-22", "note": "Markdown ok — rendered with react-markdown on the profile detail page" }],
  "statusHistory": [             // SERVER-MANAGED append-only status audit — do NOT set from a client
    { "from": "Active", "to": "Banned", "at": "2026-06-07T13:22:05.123Z" }
  ],
  "personal": {
    "relationshipStatus": "Single", // see RELATIONSHIP_STATUSES enum
    "relationshipStatusSince": "",
    "languages": ["en"]
  },
  "work": [
    { "company": "", "position": "", "from": "", "current": false, "to": "", "city": "" }
  ],
  "education": {
    "college":    { "name": "", "from": "", "to": "", "graduated": false, "degree": "" },
    "highSchool": { "name": "", "from": "", "to": "", "graduated": false, "degree": "" }
  },
  "hobbies": [],
  "interests": { "music": [], "tvShows": [], "movies": [], "games": [], "sportsTeams": [] },
  "travel": [{ "place": "", "date": "" }],
  "otherNames": [],
  "browsers": [{ "browserId": "", "provider": "hidemium" }],
  "identityPrompt": "",
  "createdBy": "ObjectId|null",     // User ref — set from req.body.userId on create/bulk. Populates to { id, username, role } on read.
  "createdAt": "ISO date", "updatedAt": "ISO date"
}
```

**On-read extras from `formatProfile` (`server/src/routes/profiles.js`):**
- `linkedPage` — full populated Page when `pageId` is set, else `null`.
- `linkedProxy` — full populated Proxy when `proxyId` (singular) is set, else `null`.
- `pageId` / `proxyId` are coerced to string ids in the response even though they're populated internally.
- `createdBy` — `{ id, username, role }` when set, else `null`. Older profiles created before this field existed will read as `null`.

**Writing `proxies` back:** the UI must send entries as `{ proxyId: "<id-string>", assignedAt }` — `normalizeProfilePayload` + `serializeProfile` flatten populated objects to ids before PATCH. Do **not** delete a Proxy doc when unlinking from `proxies`; removal is a Profile-side array update only.

**`statusHistory` is server-managed (append-only audit of status changes):** never set it from a client — `normalizeProfilePayload` strips it on the way in and `serializeProfile` drops it on save. It is written entirely server-side in `server/src/models/Profile.js`: a `findOneAndUpdate` hook appends `{ from, to, at }` whenever `status` actually changes (no-op changes are ignored), and a `pre("save")` hook (plus the `POST /bulk` route, since `insertMany` skips middleware) seeds an initial `{ from: "", to: <status>, at }` entry on creation. Going-forward only — profiles created before this existed have `statusHistory: []` until their next status change. Surfaced as the Dashboard "Banned today" card (counts `to: "Banned"` entries dated today) and the profile detail page's read-only "Status History" card.

**Two `tags` arrays for the same image (don't conflate):**
- `Image.tags[]` — lives on the Image doc itself; shared across every profile using that image. Edit from the image asset page (`/images/:id`).
- `Profile.images[].tags[]` — lives on the per-profile assignment; specific to that profile's use of the image. Edit from the profile detail page image modal.
- Same split applies to `Profile.images[].postCaption` (assignment-level) vs `Image.originalCaption` (image-level): in the profile detail image modal the editable Post Caption writes to the assignment; the Image's altText / originalCaption / Image-level tags are written via `PATCH /api/human-assets/:assetId/images/:imageId` (and Image tags are shown read-only).

### 2. Images (`/images`)
Real-person photo asset sets used as visual identity for profiles. Internally called **human assets** in the API and code. Each asset has:
- A name and a collection of image files (each with a `type`: profile, cover, post, etc.)
- Metadata: annotation, source type (scraped vs AI-generated), generation model
- Can be assigned to one or more profiles
- API: `/api/human-assets` — fetch list, fetch by ID, upload with images

> **Naming note:** The UI calls these "Images" but the API/code uses "human assets" (`humanAssets`, `/api/human-assets`). Keep this consistent — don't mix the terms within the same layer.

### 3. Pages (`/pages`)
Facebook page data. Each page has:
- Profile and cover images (from the Images pool)
- A linked identity (Profile assigned to manage it)
- Posts list (can be manually added or AI-generated)
- Status derived from state: `Pending` (no images) → `Available` (images but no identity) → `Claimed` (has identity)
- API: `/api/pages` — CRUD, add posts, bulk-generate posts, add images

### 4. Proxies (`/proxies`)
Pool of network proxies. Each Proxy doc has `host`, `port`, optional `username`/`password`, plus `type` (residential | isp | datacenter | mobile), `protocol` (http | https | socks5 | null), `status` (pending | active | inactive | dead | expired), `source`, `label`, `country`, `city`, `tags`, `notes`, `cost`, `currency`, `lastCheckedAt`, `lastKnownIp`, `expiresAt`.
- Unique index on `{ host, port, username, password }` — duplicates surface as 409.
- API: `/api/proxies` (list + `/bulk` create + GET/PATCH by id) and `/api/profiles/:id/proxies` (create-and-attach to a specific Profile).
- Profile → Proxy link lives in two places: singular `profile.proxyId` (primary) and array `profile.proxies[]` (all assignments, same pattern as `images`).

### 5. Sharers (`/sharers`)
Pool of Facebook URLs (profiles, pages, groups) the automation bot uses for engagement actions (sharer/visit/like pools). Each Sharer doc has:
- `url` — Facebook URL, **unique** (duplicates return 409). Must be `http(s)`.
- `country` — required 2-letter uppercase code (`US`, `IT`, ...) — the primary grouping key.
- `type` — `profile` (default) | `page` | `group` | `unknown`.
- `status` — `active` (default) | `inactive` | `dead`.
- `label`, `notes`, `tags[]`, `lastUsedAt`, `createdAt`, `updatedAt`.
- Source: `server/src/models/Sharer.js`, `server/src/routes/sharers.js`.

**API: `/api/sharers`**
- `GET /` — list. Query params: `country` (2-letter), `type`, `status`, `limit` (≤500), `skip`.
- `GET /by-country/:country` — bot-friendly fetch by country code. Returns `{ country, count, urls: ["...", ...] }`. Optional `?status=active`, `?type=profile`, and `?full=true` (returns `sharers: [<full doc>, ...]` instead of just `urls`).
- `POST /` — create one `{ url, country, type?, status?, label?, notes?, tags? }`.
- `POST /bulk` — create many `{ entries: [url, ...], country, type?, status?, tags? }`. Invalid/duplicate URLs are reported in `invalid[]`, not fatal.
- `GET /:id`, `PATCH /:id`, `DELETE /:id`.

**Page (`/sharers`):** lists all sharers grouped into one table per country, with search, country filter, add modal, and per-row delete. Add/Delete gated by `canWrite` (admin/maker); guests see a guard modal.

### 6. Dashboard (`/`)
Activity overview for the last 7 days. **Active source: `src/pages/DashboardPageV2.jsx`** (aliased as `DashboardPage` in `App.jsx`). The original `src/pages/DashboardPage.jsx` is kept as a backup — swap the import in `App.jsx` to restore it. Shared helpers (date bucketing, `countByDay`, `percentDelta`, `statusColor`, palette tables) live in `src/utils/dashboard.js`. No server endpoint of its own — aggregates client-side from `fetchProfiles`, `fetchPosts`, `fetchPages`, `fetchUsers`.

- **Filter bar** with three multi-selects (each defaults to "All"):
  - Makers (one per `User.role === "maker"`, color-coded)
  - Countries (`US` / `IT`)
  - Profile statuses (full `STATUS_OPTIONS`)
- **Weekly totals** — six summary cards (profiles created, posts published, posts drafted, image assets added, pages created, tracker entries). Always reflects the filtered profile set (and unfiltered post/asset/page totals).
- **Submitted today** sidebar (left, ~20%) — 2-column grid of per-maker cards showing today's submission count.
- **Submissions per maker · last 7 days** chart (right, ~80%) — CSS grouped bar chart, one color per maker, 7 day columns. Today's column is outlined.
- **Daily breakdown** matrix exists in code (`MetricRow`) but is currently hidden — can be re-added later.

**Filter semantics:**
- The Maker filter scopes "Profiles created" via `profile.createdBy.id` AND scopes the chart / submitted-today blocks to that maker's own assignments.
- Country/status filters apply to profile-derived metrics AND to the submission blocks (a maker's submission is only counted when the referenced profile's country/status passes).
- Posts / assets / pages totals are global (no filter applies); a note appears when filters are active.

### 7. Users (auth)
Auth subject. Source: `server/src/models/User.js`, `server/src/routes/auth.js`.

```jsonc
{
  "_id": "ObjectId",
  "username": "alice",            // unique
  "role": "admin" | "maker" | "guest",
  "defaultCountry": "US",         // US | IT (used by ProfilesPage filter default)
  "profiles": [                   // makers' assigned profiles (admins typically have none)
    {
      "profileId": "ObjectId",
      "assignedAt": "ISO date string",
      "assignmentStatus": "pending" | "completed",
      "submittedAt": "ISO date string"   // stamped when status flips to "completed"
    }
  ]
}
```

**API: `/api/auth`**
- `POST /register` — creates a `guest`. Use the DB to promote.
- `POST /login` — returns sanitized user (no `passwordHash`).
- `PATCH /users/:userId/default-country` — body `{ country: "US"|"IT" }`.
- `PATCH /users/:userId/profiles/:profileId` — body `{ assignmentStatus: "pending"|"completed" }`. When flipping to `completed`, the server also stamps `submittedAt = now()`. This is the only source of `submittedAt`, so the Dashboard's submission chart/cards only count assignments completed AFTER this field was added.
- `GET /users` — list all users (sanitized, no password hash). Used by the Dashboard for the maker filter and per-maker chart.

### 8. Posts (`/posts`)
A Post bundles a set of Images and is optionally assigned to a Profile to publish on Facebook. Source: `server/src/models/Post.js`, `server/src/routes/posts.js`.

```jsonc
{
  "_id": "ObjectId",
  "images": ["ObjectId"],           // Image refs. UNIQUE per image (one image -> one post)
  "caption": "",                    // text shown on the FB post
  "context": "",                    // internal note (not posted to FB)
  "theme": "",
  "profileId": "ObjectId|null",
  "assignedAt": "ISO date|null",
  "status": "draft|posted|failed",
  "postedAt": "ISO date|null",
  "generatedBy": "", "generationModel": ""
}
```

- `Image.postId` is the back-ref kept in sync with `Post.images[]`. An image is "available" when `postId === null`. The Post → Image link is enforced server-side by claiming on add and releasing on remove.

**API: `/api/posts`**
- `GET /` — list all posts (populated images + assigned profile name).
- `POST /` — **create** a new post from a set of unclaimed images. Body: `{ images: [imageId, ...], caption?, context?, profileId? }`. Validates that each image exists with `postId === null`, creates the post, claims the images, and if `profileId` is provided, sets `assignedAt = now()` and appends to `Profile.posts[]`.
- `PATCH /:id` — update caption/context/etc.
- `POST /:id/images` / `DELETE /:id/images/:imageId` — add/remove a single image (claims/releases `Image.postId`).
- `POST /:id/assign` / `DELETE /:id/assign` — set or clear the owner Profile (mirrors `Profile.posts[]`).
- `POST /:id/auto-assign`, `POST /auto-assign-all` — bot helpers.
- `DELETE /:id`, `POST /bulk-delete`.
- `GET /available-images` — paginated list of images with `tags: "post"` AND `postId: null` (used by `PostEditModal`'s picker).

**Page (`/posts`):** post cards grouped by assignment state, with bulk select/delete, auto-assign, and a **Create Post** button (admin/maker only). The Create modal (`src/components/CreatePostModal.jsx`) shows every human asset with its full image grid; selection uses native checkboxes, claimed images render disabled with an "in use" overlay.

## Project Structure

```
src/
  api/           # API fetch functions (one file per entity)
  components/    # Shared UI components (modals, SafeImage)
  constants/     # UI config (profileUi.js — status options, AVC values)
  context/       # AuthContext — session stored in localStorage as `pv_session`
  generator/     # Deterministic fake data generators (profiles, pages)
  pages/         # Route-level page components
  utils/         # access.js — role checks (canWrite, canViewConfidential, mask)
```

## Auth & Roles

- Auth is backend-managed; session stored in `localStorage` (`pv_session`)
- Roles: `admin`, `maker`, `guest`
  - `admin` — full access
  - `maker` — gets profiles assigned via `User.profiles[]`, submits them via the profile detail page Submit block (flips assignmentStatus → `completed` and stamps `submittedAt`)
  - `guest` — read-only, confidential fields masked
- `canWrite(user)` — gates create/edit/delete actions (admin + maker)
- `canViewConfidential(user)` — gates sensitive fields (passwords, emails)
- Guest badge shown in nav when role is `guest`

## Generators

`src/generator/generate.js` — `generateProfile(params)` and `generateBatch(count, params)` create realistic fake profiles with seeded names, locations, education, work, interests, bio, and emails. No external API needed.

`src/generator/pages.js` — generates Facebook page info (name, category, about, etc.).

## Environment

```
VITE_API_URL=http://localhost:4000   # backend base URL (dev only)
IMAGE_API_KEY=                        # key for image generation (AI images)
IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
```

In production, the server (`server/`) serves the built `dist/` and the API on the same port. Leave `VITE_API_URL` empty so API calls use relative paths. The `server/.env` only needs `MONGODB_URI` and `PORT`.

Optional server env: `BOT_API_URL` — base URL of the automation bot that `POST /api/profiles/:id/run` forwards onboarding tasks to (defaults to `http://localhost:3000`, i.e. the bot running on the same host as the API server).

## Scripts

- `server/src/seed.js` — destructive starter seed (used by `npm run seed` if defined). Reads from `src/data.js`; wipes Profiles/HumanAssets/Images/Proxies and reinserts.
- `server/scripts/migrate-image-structure.mjs` — one-shot, idempotent migration to the current Image/HumanAsset/Post/Profile schema. Dry-run by default; pass `--apply`.
- `server/scripts/seed-simulation.mjs` — **additive** demo data for the Dashboard. Creates `sim_maker_*` users (password `simpassword`), a configurable number of `tags: ["sim"]` profiles with `createdAt` and tracker entries spread across the last 7 days, plus per-maker assignments with `submittedAt` stamps. Run as `cd server && node scripts/seed-simulation.mjs --apply`; add `--clean` to wipe sim data first. Targets only docs tagged `sim` (profiles) or with `sim_` username prefix (users), so real data is safe.

## CSS Conventions

- Modal classes prefixed `npm-` (New Profile Modal origin, used app-wide now)
- Status badge classes: `sbadge sp` (available/green), `sbadge sa` (pending/yellow), `sbadge sg` (claimed/gray)
- Theme toggled via `data-theme` attribute on `<html>`, persisted in `localStorage` as `pv_theme`
- Button variants: `btn-p` (primary), `btn-s` (secondary)

## Key Behaviors

- All API base URL reads: `import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL`
- `SafeImage` component handles missing/broken images gracefully
- WIP nav links (Anti-Bot ML, Analytics) show a modal — don't remove them, they're placeholders
- Page status is derived client-side from page data, not stored on the backend
