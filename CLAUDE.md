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

## The Core Entities

### 1. Profiles (`/`)
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
    { "imageId": "ObjectId | <populated Image>", "assignedAt": "ISO date" }
  ],
  "trackerLog": [{ "date": "2026-04-22", "note": "..." }],
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
- Roles: `admin`, `guest` (guests see masked confidential fields)
- `canWrite(user)` — gates create/edit/delete actions
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
