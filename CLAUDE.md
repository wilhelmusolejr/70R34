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

## The Three Core Entities

### 1. Profiles (`/`)
Fictional person identities used for Facebook accounts. Each profile has:
- Personal info: name, gender, DOB, city, hometown, bio
- Contact: emails (multiple, one selected), passwords (email + Facebook), phone, recovery email
- Life details: work history, education, relationship status, languages, interests, travel
- Account state: status, tags, tracker log, `has2FA`, `hasPage`, `profileSetup`
- API: `/api/profiles` — CRUD + bulk create + image unassign

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
VITE_API_URL=http://localhost:4000   # backend base URL
IMAGE_API_KEY=                        # key for image generation (AI images)
IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
```

## CSS Conventions

- Modal classes prefixed `npm-` (New Profile Modal origin, used app-wide now)
- Status badge classes: `sbadge sp` (available/green), `sbadge sa` (pending/yellow), `sbadge sg` (claimed/gray)
- Theme toggled via `data-theme` attribute on `<html>`, persisted in `localStorage` as `pv_theme`
- Button variants: `btn-p` (primary), `btn-s` (secondary)

## Key Behaviors

- All API base URL reads: `import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL`
- `SafeImage` component handles missing/broken images gracefully
- WIP nav links (Proxy, Anti-Bot ML, Analytics) show a modal — don't remove them, they're placeholders
- Page status is derived client-side from page data, not stored on the backend
