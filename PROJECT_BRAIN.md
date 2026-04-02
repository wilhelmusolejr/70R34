# PROJECT BRAIN — 70R34

> Last updated: 2026-04-02
> Purpose: Central reference for architecture, current code state, data models, and planned work.

---

## 1. What This Is

**70R34** is an internal dashboard for managing and tracking synthetic Facebook persona accounts. It covers the full lifecycle of a profile — from generation/creation, through processing by a 3rd-party operator, to delivery to the main client.

Think of it as a CRM for fake personas. Each profile stores identity data, credentials, work/education history, interests, proxy config, and an activity tracker.

---

## 2. Tech Stack

| Layer | Tool | Version |
|---|---|---|
| UI Framework | React | 19.2.4 |
| Routing | React Router | 7.13.2 |
| Build Tool | Vite | 8.0.1 |
| Styling | TailwindCSS + Custom CSS | 4.2.2 |
| Fonts | Poppins (body), JetBrains Mono (mono) | — |
| Backend | Node.js + Express | 5.1.0 |
| Database | MongoDB Atlas (cloud) via Mongoose | 8.19.3 |
| State | React `useState` / `useEffect` — no global store | — |

---

## 3. File Structure (Current)

```
profile-vault/
├── src/
│   ├── pages/
│   │   ├── ProfilesPage.jsx          ← Profile list, filters, stats, tracker
│   │   └── ProfileDetailPage.jsx     ← Full profile view + inline editing
│   ├── components/
│   │   └── NewProfileModal.jsx       ← Manual profile creation (tab-based)
│   ├── api/
│   │   └── profiles.js               ← All fetch calls to backend
│   ├── constants/
│   │   └── profileUi.js              ← AVC, SC, TC, STATUS_CLASS, STATUS_OPTIONS
│   ├── data.js                       ← Seed data (15 profiles, new schema format)
│   ├── App.jsx                       ← Router + nav layout
│   ├── App.css                       ← All component styles
│   ├── index.css                     ← CSS custom properties + reset
│   └── main.jsx                      ← React entry point
├── server/
│   └── src/
│       ├── index.js                  ← Entry point, port 4000
│       ├── app.js                    ← Express app + middleware
│       ├── config/db.js              ← MongoDB Atlas connection
│       ├── models/Profile.js         ← Mongoose schema (finalized)
│       ├── routes/profiles.js        ← CRUD API routes
│       └── seed.js                   ← Seeds DB from src/data.js
├── .env                              ← VITE_API_URL=http://localhost:4000
├── server/.env                       ← MONGODB_URI (Atlas) + PORT=4000
├── index.html                        ← Browser title: 70R34
└── package.json                      ← name: "70r34", has dev:server + server:seed scripts
```

---

## 4. Routes

| Path | Component |
|---|---|
| `/` | `ProfilesPage` — list of all profiles |
| `/profile/:id` | `ProfileDetailPage` — full detail + inline editor |

Nav links for Analytics, Anti-Bot ML, Settings exist but have no routes yet.

---

## 5. Data Model — Profile Document

All profiles live in the `profiles` collection in MongoDB Atlas database `70r34`.

### GROUP 1 — Identity

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | Number | ✅ | Sequential integer, unique, indexed |
| `firstName` | String | ✅ | |
| `lastName` | String | ✅ | |
| `dob` | String | optional | Format `"MM-DD-YYYY"` |
| `gender` | String | optional | `"Male"` or `"Female"` |
| `status` | String (enum) | auto | Default `"Available"`. See status table below. |
| `tags` | `[String]` | optional | UI label pills. Values: Verified, Bot Suspect, New User, Flagged, Pending Profile, Banned |
| `friends` | Number | optional | Friend count on Facebook. Default `0` |

**Status values and lifecycle meaning:**

| Value | Meaning |
|---|---|
| `Available` | Profile is ready and waiting. A 3rd-party operator can grab it. **Default.** |
| `Pending Profile` | Operator has taken the profile and is actively registering/building it on Facebook |
| `Active` | Account is live and currently farming on the platform |
| `Flagged` | Account is active but hitting platform errors (e.g. can't create a page) |
| `Banned` | Account permanently banned by Facebook |
| `Ready` | Fully set up — ready to hand off to the main client |
| `Delivered` | Handed to the main client. End of lifecycle. |

---

### GROUP 2 — Work Experience

`work: [WorkSchema]` — array, 0 to many entries

| Field | Type | Notes |
|---|---|---|
| `company` | String | Employer name |
| `position` | String | Job title |
| `from` | String | Start year e.g. `"2019"` |
| `to` | String | End year, empty string if current |
| `current` | Boolean | If true, this is the active job |
| `city` | String | City where job is held |

> Note: there are no longer top-level `workplace` or `position` fields. The hero in ProfileDetailPage derives these from `work[0]`.

---

### GROUP 3 — Education

| Field | Type | Notes |
|---|---|---|
| `education.college.name` | String | |
| `education.college.from` | String | Year |
| `education.college.to` | String | Year |
| `education.college.graduated` | Boolean | |
| `education.college.degree` | String | e.g. `"B.S. Computer Science"` |
| `education.highSchool.name` | String | |
| `education.highSchool.from` | String | Year |
| `education.highSchool.to` | String | Year |
| `education.highSchool.graduated` | Boolean | |
| `education.highSchool.degree` | String | |

---

### GROUP 4 — Personal Details

| Field | Type | Notes |
|---|---|---|
| `city` | String | Current city/town |
| `hometown` | String | Hometown |
| `bio` | String | Multiline persona bio |
| `personal.relationshipStatus` | String (enum) | Single / In a Relationship / Married / It's Complicated / Widowed / Separated / Divorced |
| `personal.relationshipStatusSince` | String | Year relationship started |
| `personal.languages` | `[String]` | e.g. `["English", "Spanish"]` |
| `otherNames` | `[String]` | Aliases and nicknames |

---

### GROUP 5 — Credentials

| Field | Type | Required | Notes |
|---|---|---|---|
| `emails` | `[{ address: String, selected: Boolean }]` | ✅ | Auto-generate = 5 options, `selected: false`. Customer picks one → `selected: true`. Manual = 1 entry, `selected: true`. |
| `emailPassword` | String | ✅ | Single shared password for all email address options |
| `facebookPassword` | String | ✅ | Facebook account password |
| `proxy` | String | optional | Format: `"ip:port:user:pass"` |
| `proxyLocation` | String | optional | e.g. `"New York, NY"` |
| `recoveryEmail` | String | optional | Backup/recovery email |
| `phone` | String | optional | Phone number on the account |
| `has2FA` | Boolean | optional | Whether 2FA is enabled. Default `false` |

---

### GROUP 6 — Requirements (computed + stored)

These are boolean flags. The requirements score (0–4) is computed in the UI.

| Field | Type | Notes |
|---|---|---|
| `has2FA` | Boolean | Stored in Group 5 / Credentials |
| `hasPage` | Boolean | Whether a Facebook Page has been created |
| `profileSetup` | Boolean | Whether the Facebook profile is fully filled out |
| `friends` | Number | Stored in Group 1. Score checks `friends >= 30` |

> `hasReachedFriendsRequirement` is **not stored** — computed as `friends >= 30` in the UI.

**Score logic:** `has2FA + hasPage + (friends >= 30) + profileSetup` → 0–4
- 4/4 → green · 2–3 → amber · <2 → red

---

### GROUP 7 — Account & Links

| Field | Type | Notes |
|---|---|---|
| `profileCreated` | String `"YYYY-MM-DD"` | Date profile was first opened in an antidetect browser |
| `accountCreated` | String `"YYYY-MM-DD"` | Date the Facebook account was actually registered |
| `profileUrl` | String | Facebook profile URL |
| `pageUrl` | String | Facebook page URL |
| `hasPage` | Boolean | See Group 6 |
| `profileSetup` | Boolean | See Group 6 |

---

### GROUP 8 — Tracker Log

`trackerLog: [{ date: String, note: String }]` — auto-populated by the daily tracker UI

| Field | Type | Notes |
|---|---|---|
| `date` | String | `"YYYY-MM-DD"` |
| `note` | String | Optional operator note for that day's activity |

---

### GROUP 9 — Interests

All `[String]` arrays, all optional.

| Field | Notes |
|---|---|
| `interests.music` | Music genres/artists |
| `interests.tvShows` | TV shows |
| `interests.movies` | Movies |
| `interests.games` | Video games |
| `interests.sportsTeams` | Sports teams |

---

### GROUP 10 — Hobbies

| Field | Type | Notes |
|---|---|---|
| `hobbies` | `[String]` | List of hobbies and activities |

---

### GROUP 11 — Travel

`travel: [{ place: String, date: String }]`

| Field | Notes |
|---|---|
| `place` | Place name e.g. `"Italy"` |
| `date` | Format `"YYYY-MM"` |

---

### GROUP 12 — Social Media & Web

| Field | Type | Notes |
|---|---|---|
| `websites` | `[String]` | Personal/blog URLs |
| `socialLinks` | `[{ platform: String, url: String }]` | Other social accounts (Instagram, Twitter, etc.) |

---

### GROUP 13 — Internal

| Field | Type | Notes |
|---|---|---|
| `notes` | String | Operator-only notes, not shown on the public profile |
| `avatarUrl` | String | Profile photo URL (low priority — initials used as fallback) |
| `coverPhotoUrl` | String | Cover photo URL (low priority) |

---

### Auto fields (Mongoose)
| Field | Notes |
|---|---|
| `_id` | MongoDB ObjectId |
| `createdAt` | Auto timestamp |
| `updatedAt` | Auto timestamp |
| `versionKey` | Disabled (`__v` not stored) |

---

## 6. API Routes

Base URL: `http://localhost:4000`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/profiles` | All profiles, sorted by `id` asc |
| `GET` | `/api/profiles/:id` | Single profile by numeric `id` |
| `POST` | `/api/profiles` | Create one profile |
| `PATCH` | `/api/profiles/:id` | Partial update (single field save) |
| `PUT` | `/api/profiles/:id` | Full replace |
| `DELETE` | `/api/profiles/:id` | Delete profile, returns 204 |
| `GET` | `/api/health` | Health check, returns `{ ok: true }` |

**Not yet built:**
- `POST /api/profiles/bulk` — needed for auto-generate (Phase 4)
- `GET /api/profiles/export` — CSV download (Phase 2)
- Query params: `?search=`, `?status=`, `?sort=` (Phase 2)

---

## 7. Frontend API Client (`src/api/profiles.js`)

| Function | Calls |
|---|---|
| `fetchProfiles()` | `GET /api/profiles` |
| `fetchProfile(id)` | `GET /api/profiles/:id` |
| `createProfile(payload)` | `POST /api/profiles` |
| `updateProfile(id, payload)` | `PATCH /api/profiles/:id` |
| `deleteProfile(id)` | `DELETE /api/profiles/:id` |

Base URL from `VITE_API_BASE_URL` env var. 204 responses return `null`.

---

## 8. ProfilesPage — Current Features

### Stats bar
Total · Active · Pending (Pending Profile) · Banned · Ready · Done Today

### Filters
- Text search — name, city, company, email address
- Status dropdown filter
- Sort: ID / Name / Status / Unprocessed First / Ready First
- Tracker filter: All / Done Today / Not Done Today

### Table columns
1. Profile — avatar (color by id, initials fallback), name, city
2. Status — color-coded badge
3. Profile Created + relative time
4. Account Created + relative time
5. Links — profile URL + page URL buttons
6. Requirements — 2FA / Page / Setup checkmarks
7. Daily Tracker — Mark Done button + tracker modal (date + note)
8. View → `/profile/:id`

### Actions
- Export CSV button
- Mark All Done Today
- New Profile → opens `NewProfileModal`

---

## 9. ProfileDetailPage — Current Sections

### Hero
- Colored avatar (initials), name, `work[0].position · work[0].company`
- Status (editable dropdown), tags
- ID, gender, city, DOB, requirements score (X/4)

### Left column (top to bottom)
| Section | What's there |
|---|---|
| Bio | Multiline editable, copyable |
| Personal Details | City, hometown, relationship status + since, languages (tag editor) |
| Work Experience | Editable work cards (position, company, from/to, current, city) |
| Education | College card + High School card, each fully editable |
| Hobbies | Tag editor (max 5) |
| Travel | Travel cards (place, date) |
| Other Names | Tag editor (max 5) |

### Right column (top to bottom)
| Section | What's there |
|---|---|
| Credentials | Email selector (shows all `emails[]`, highlights selected), Email Password, Facebook Password, Proxy, Proxy Location — all copyable |
| Account & Links | Profile Created, Account Created, Friends count, Profile URL, Page URL |
| Notes | Multiline textarea, operator-only |
| Tracker Log | List of `trackerLog[]` entries by date desc, Mark Tracked Today button |
| Requirements | 2FA / Page / 30+ Friends / Profile Setup — toggleable, updates score |
| Interests | Music, TV Shows, Movies, Games, Sports Teams — each a tag editor (max 5) |

**Edit pattern:** Every field uses `EditableText` (click to edit inline) or `EditableTags`. On save, calls `PATCH /api/profiles/:id`. Optimistic update with rollback on error.

---

## 10. NewProfileModal — Current State

Tab-based layout with 7 tabs:
1. Basic Information — firstName, lastName, gender, dob, status
2. Credentials — email input (converted to `emails[]`), emailPassword, facebookPassword, proxy, proxyLocation
3. Work — work entry cards (add/remove)
4. Education — college + high school
5. Personal Info — relationshipStatus, relationshipStatusSince, languages, hobbies, otherNames, bio
6. Travel — travel entry cards (add/remove)
7. Account — profileCreated, accountCreated dates

**Validation:** firstName, lastName, email, emailPassword, facebookPassword, profileCreated, accountCreated are required.

**Known issue:** Layout does not match ProfileDetailPage section grouping/style. Planned rework in Phase 3.

---

## 11. UI Constants (`src/constants/profileUi.js`)

### AVC — Avatar colors (10, cycles by id)

### SC — Status badge colors
| Status | bg | text | dot |
|---|---|---|---|
| Available | `bg-cyan-bg` | `text-cyan-t` | `bg-cyan` |
| Pending Profile | `bg-amber-bg` | `text-amber-t` | `bg-amber` |
| Active | `bg-green-bg` | `text-green-t` | `bg-green` |
| Flagged | `bg-orange-bg` | `text-orange-t` | `bg-orange` |
| Banned | `bg-red-bg` | `text-red-t` | `bg-red` |
| Ready | `bg-blue-bg` | `text-blue-t` | `bg-blue` |
| Delivered | `bg-purple-bg` | `text-purple-t` | `bg-purple` |

### STATUS_CLASS — maps status → CSS class string (for hero badge)
Available/Pending Profile → `"sp"` · Active/Ready/Delivered → `"sa"` · Flagged → `"sflag"` · Banned → `"sbn"`

### STATUS_OPTIONS — ordered array of all 7 status strings

### TC — Tag pill colors
Verified (blue) · Banned (red) · Flagged (orange) · Bot Suspect (purple) · New User (cyan) · Pending Profile (amber)

---

## 12. Design System

### CSS Variables (`index.css`)
```css
--bg        : #f5f5f7   /* page background */
--surface   : #ffffff   /* card background */
--surface2  : #fafafa   /* secondary surface */
--text      : #0a0a0a   /* primary text */
--text2     : #6e6e73   /* secondary / label text */
--text3     : #aeaeb2   /* muted / placeholder text */
--r         : 12px      /* default border radius */
--r-sm      : 8px
--r-lg      : 16px
--r-xl      : 20px
```

---

## 13. Seed Data (`src/data.js`)

- Export name: `profiles` (array, not `PROFILES`)
- 15 profiles, fully migrated to new schema:
  - `emails[]` array with 5 entries each, one `selected: true`
  - `emailPassword`, `facebookPassword` (no more `mailPw`/`bonkPw`)
  - `phone`, `recoveryEmail` populated
  - All groups 1–13 fields present
  - No top-level `workplace` or `position` fields
- Used by `server/src/seed.js` via `import { profiles } from "../../src/data.js"`

---

## 14. Task Status

| Phase | Goal | Status |
|---|---|---|
| Phase 1 | Fix DB schema | ✅ Done |
| Phase 2 | Complete backend API (search params, bulk, CSV export, tracker migration) | 🔲 Next |
| Phase 3 | Rebuild NewProfileModal layout | 🔲 Pending |
| Phase 4 | Auto-generate profiles | 🔲 Pending |
| Phase 5 | Pages section (nav, list, detail) | 🔲 Pending |

See `TASKS.md` for full sub-task breakdown.

---

## 15. Known Gaps / Constraints

- **No API query params** — `GET /api/profiles` returns all without filtering/sorting. Frontend does it client-side. Needs server-side for Phase 2.
- **No bulk insert route** — needed for auto-generate feature.
- **Tracker still localStorage** — daily tracker marks are persisted locally, not in `trackerLog`. Phase 2 migrates this.
- **No auth on API** — any request to port 4000 works without a token. Fine for local dev.
- **STATUS_CLASS maps 3 statuses to same class** — Available/Pending Profile share `"sp"`, Active/Ready/Delivered share `"sa"`. May need distinct classes as UI matures.
- **NewProfileModal uses tabs** — planned rework to scrollable sections matching ProfileDetailPage.
- **Pages section** — nav links exist but no routes or components built yet.
- **Analytics / Anti-Bot ML / Settings** — nav links exist, no pages built.

---

*End of PROJECT_BRAIN.md*
