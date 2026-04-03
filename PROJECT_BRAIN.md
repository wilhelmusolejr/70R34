# PROJECT BRAIN - 70R34

> Last updated: 2026-04-03
> Purpose: Central reference for architecture, current code state, data models, and planned work.

---

## 1. What This Is

**70R34** is an internal dashboard for managing and tracking synthetic Facebook persona accounts. It covers the full lifecycle of a profile, from generation/creation, through processing by a 3rd-party operator, to delivery to the main client.

Think of it as a CRM for fake personas. Each profile stores identity data, credentials, work/education history, interests, proxy config, activity tracking, and now relationships to reusable image assets.

---

## 2. Tech Stack

| Layer | Tool | Version |
|---|---|---|
| UI Framework | React | 19.2.4 |
| Routing | React Router | 7.13.2 |
| Build Tool | Vite | 8.0.1 |
| Styling | TailwindCSS + Custom CSS | 4.2.2 |
| Fonts | Poppins (body), JetBrains Mono (mono) | - |
| Backend | Node.js + Express | 5.1.0 |
| Database | MongoDB Atlas via Mongoose | 8.19.3 |
| State | React `useState` / `useEffect` | no global store |

---

## 3. File Structure (Current)

```text
profile-vault/
|-- src/
|   |-- pages/
|   |   |-- ProfilesPage.jsx
|   |   |-- ProfileDetailPage.jsx
|   |   |-- PagesPage.jsx
|   |   |-- ImagesPage.jsx
|   |   `-- ImageAssetDetailPage.jsx
|   |-- components/
|   |   `-- NewProfileModal.jsx
|   |-- api/
|   |   `-- profiles.js
|   |-- constants/
|   |   `-- profileUi.js
|   |-- data/
|   |   `-- imageAssets.js
|   |-- App.jsx
|   |-- App.css
|   |-- index.css
|   `-- main.jsx
|-- server/
|   `-- src/
|       |-- index.js
|       |-- app.js
|       |-- config/db.js
|       |-- models/
|       |   |-- Profile.js
|       |   |-- Image.js
|       |   |-- Page.js
|       |   `-- HumanAsset.js
|       |-- routes/
|       |   `-- profiles.js
|       `-- seed.js
|-- .env
|-- server/.env
|-- ProfileBotIdentification_DB_Schema_v2.1.md
`-- package.json
```

---

## 4. Routes

| Path | Component |
|---|---|
| `/` | `ProfilesPage` - list of all profiles |
| `/profile/:id` | `ProfileDetailPage` - full detail + inline editor |
| `/pages` | `PagesPage` - current WIP pages view |
| `/images` | `ImagesPage` - current WIP image asset list |
| `/images/:id` | `ImageAssetDetailPage` - current WIP image asset detail/annotation view |

Nav links for Analytics, Anti-Bot ML, Settings, Proxy, and Human Asset are not fully implemented yet.

---

## 5. Data Model

Current backend collection/model coverage in MongoDB Atlas database `70r34`:

| Collection | Model | Purpose |
|---|---|---|
| `profiles` | `Profile` | Main identity/persona records |
| `images` | `Image` | Reusable image assets assigned to profiles/pages |
| `pages` | `Page` | Page entities with linked identities and asset references |
| `humanassets` | `HumanAsset` | Human operators and their assigned profiles |

### 5.1 Profile Document

The current application still centers on the `profiles` collection.

| Field | Type | Notes |
|---|---|---|
| `id` | Number | Sequential numeric identifier, unique |
| `firstName` | String | Required |
| `lastName` | String | Required |
| `dob` | String | Format `"MM-DD-YYYY"` |
| `gender` | String | Optional |
| `emails` | `[{ address, selected }]` | Email candidates |
| `emailPassword` | String | Shared email password |
| `facebookPassword` | String | Account password |
| `proxy` | String | Current model still stores a single string |
| `proxyLocation` | String | Optional |
| `city` | String | Optional |
| `hometown` | String | Optional |
| `bio` | String | Optional |
| `status` | String | Enum lifecycle status |
| `tags` | `[String]` | UI labels |
| `profileUrl` | String | Facebook profile URL |
| `pageUrl` | String | Facebook page URL |
| `profileCreated` | String | `"YYYY-MM-DD"` |
| `accountCreated` | String | `"YYYY-MM-DD"` |
| `friends` | Number | Default `0` |
| `has2FA` | Boolean | Default `false` |
| `hasPage` | Boolean | Default `false` |
| `profileSetup` | Boolean | Default `false` |
| `recoveryEmail` | String | Optional |
| `phone` | String | Optional |
| `notes` | String | Internal notes |
| `avatarUrl` | String | Optional |
| `coverPhotoUrl` | String | Optional |
| `websites` | `[String]` | Optional |
| `socialLinks` | `[{ platform, url }]` | Optional |
| `images` | `[{ imageId, assignedAt }]` | Ref list to `images._id` |
| `trackerLog` | `[{ date, note }]` | Daily tracker history |
| `personal` | Object | Relationship/language info |
| `work` | `[WorkSchema]` | Work experience |
| `education` | Object | College + high school |
| `hobbies` | `[String]` | Optional |
| `interests` | Object | Music/TV/movies/games/sportsTeams |
| `travel` | `[{ place, date }]` | Optional |
| `otherNames` | `[String]` | Optional |
| `_id` | ObjectId | Mongo primary key |
| `createdAt` | Date | Auto timestamp |
| `updatedAt` | Date | Auto timestamp |

New profile image relationship now stored as:

```js
images: [
  {
    imageId: ObjectId,   // Ref -> images._id
    assignedAt: Date,
  }
]
```

### 5.2 Image Document

Based on `ProfileBotIdentification_DB_Schema_v2.1.md`, each image is a single reusable asset document.

| Field | Type | Notes |
|---|---|---|
| `filename` | String | Required |
| `annotation` | String | Internal descriptive tag |
| `type` | String | Enum: `profile`, `cover`, `post`, `document` |
| `sourceType` | String | Enum: `generated`, `scraped`, `stock`, `real` |
| `aiGenerated` | Boolean | Default `false` |
| `generationModel` | String or `null` | Model name if AI-generated |
| `usedBy` | `[{ userId }]` | Refs back to `profiles._id` |
| `createdAt` | Date | Auto timestamp |
| `updatedAt` | Date | Auto timestamp |

### 5.3 Page Document

Pages are now represented as their own backend model rather than only being derived from profiles.

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | String | Default `2.1` |
| `pageName` | String | Required |
| `pageId` | String | Platform-side page id |
| `category` | String | Category label |
| `followerCount` | Number | Default `0` |
| `likeCount` | Number | Default `0` |
| `generationPrompt` | String | Prompt/persona for page content |
| `linkedIdentities` | `[ObjectId]` | Refs to `profiles._id` |
| `assets` | `[{ imageId, type, postDescription, postedAt, engagementScore }]` | Refs to `images._id` |
| `createdAt` | Date | Auto timestamp |
| `updatedAt` | Date | Auto timestamp |

### 5.4 Human Asset Document

Human Asset tracks a real operator and the profiles under their management.

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required |
| `numberPossibleProfile` | Number | Operator capacity |
| `numberProfileUsing` | `[ObjectId]` | Active refs to `profiles._id` |
| `createdAt` | Date | Auto timestamp |
| `updatedAt` | Date | Auto timestamp |

### 5.5 Relationship Notes

- `profiles.images[].imageId` references `images._id`
- `images.usedBy[].userId` references `profiles._id`
- `pages.assets[].imageId` references `images._id`
- `pages.linkedIdentities[]` references `profiles._id`
- `humanassets.numberProfileUsing[]` references `profiles._id`

---

## 6. API Routes

Base URL: `http://localhost:4000`

### Implemented

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/profiles` | All profiles, sorted by `id` asc |
| `GET` | `/api/profiles/:id` | Single profile by numeric `id` |
| `POST` | `/api/profiles` | Create one profile |
| `POST` | `/api/profiles/bulk` | Bulk create profiles |
| `PATCH` | `/api/profiles/:id` | Partial update |
| `PUT` | `/api/profiles/:id` | Full replace |
| `DELETE` | `/api/profiles/:id` | Delete profile |
| `GET` | `/api/health` | Health check |

### Not Yet Built

- Query params for profile list: `?search=`, `?status=`, `?sort=`
- `GET /api/profiles/export` for CSV
- CRUD routes for `images`
- CRUD routes for `pages`
- CRUD routes for `human assets`

---

## 7. Frontend API Client

Current client-side API wrapper is still profile-focused in `src/api/profiles.js`.

| Function | Calls |
|---|---|
| `fetchProfiles()` | `GET /api/profiles` |
| `fetchProfile(id)` | `GET /api/profiles/:id` |
| `createProfile(payload)` | `POST /api/profiles` |
| `updateProfile(id, payload)` | `PATCH /api/profiles/:id` |
| `deleteProfile(id)` | `DELETE /api/profiles/:id` |

No dedicated frontend API modules exist yet for `images`, `pages`, or `human assets`.

---

## 8. Current UI State

### Profiles

- `ProfilesPage` lists profiles with filters, status pills, tracker actions, and profile links.
- `ProfileDetailPage` supports inline editing and persists changes through `PATCH /api/profiles/:id`.
- `NewProfileModal` supports manual profile creation.

### Pages

- `PagesPage` currently exists in the frontend.
- It still derives rows from profile data rather than from the new `pages` collection.

### Images

- `ImagesPage` and `ImageAssetDetailPage` exist as WIP UI.
- They currently use local mock data from `src/data/imageAssets.js`.
- They are not connected to the new backend `Image` model yet.

### Human Asset

- No frontend page or API integration yet.

---

## 9. Seed Data

- Seed source remains `src/data.js`.
- Current seed flow is still profile-only through `server/src/seed.js`.
- Seed data has not yet been expanded to create `images`, `pages`, or `humanassets`.

---

## 10. Task Status

| Phase | Goal | Status |
|---|---|---|
| Phase 1 | Fix DB schema | Done |
| Phase 2 | Complete backend API, search params, CSV export, tracker migration, and new collection CRUD | Next |
| Phase 3 | Rebuild `NewProfileModal` layout | Pending |
| Phase 4 | Auto-generate profiles | Pending |
| Phase 5 | Connect Pages/Image/Human Asset sections to real backend collections | Pending |

---

## 11. Known Gaps / Constraints

- `Image`, `Page`, and `HumanAsset` now exist as Mongoose models, but there are no routes/controllers for them yet.
- The frontend `PagesPage` still uses derived profile data instead of the `pages` collection.
- The frontend image section still uses mock data instead of the `images` collection.
- `Profile.proxy` is still a single string in the live backend model, even though the schema document discusses a more advanced proxy structure.
- `GET /api/profiles` still returns all profiles without server-side filtering/sorting.
- CSV export is still missing.
- Tracker persistence is still limited to the current profile flow.
- No auth enforcement exists on the API.

---

*End of PROJECT_BRAIN.md*
