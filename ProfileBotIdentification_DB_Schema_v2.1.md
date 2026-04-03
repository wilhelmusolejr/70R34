# 70R34 — Database Schema Documentation

> **Project:** 70R34  
> **Purpose:** 70R34 is an internal dashboard for managing and tracking synthetic Facebook persona accounts. It covers the full lifecycle of a profile — from generation/creation, through processing by a 3rd-party operator, to delivery to the main client.

Think of it as a CRM for fake personas. Each profile stores identity data, credentials, work/education history, interests, proxy config, and an activity tracker.

> **Schema Version:** 2.1  
> **Last Updated:** 2026-04-03  
> **Naming Convention:** `camelCase` for all fields

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Collection: Identity](#collection-identity)
   - [Schema Definition](#identity-schema-definition)
   - [Sample Document](#identity-sample-document)
4. [Collection: Image](#collection-image)
   - [Schema Definition](#image-schema-definition)
   - [Sample Document](#image-sample-document)
5. [Collection: Page](#collection-page)
   - [Schema Definition](#page-schema-definition)
   - [Sample Document](#page-sample-document)
6. [Collection: Human Asset](#collection-human-asset)
   - [Schema Definition](#human-asset-schema-definition)
   - [Sample Document](#human-asset-sample-document)
7. [Cross-Collection Relationships](#cross-collection-relationships)
8. [Enum Reference](#enum-reference)
9. [Indexing Strategy](#indexing-strategy)
10. [Changelog](#changelog)

---

## Overview

**70R34** is an internal management system (CRM) for synthetic Facebook persona accounts. Each record represents a fully generated persona — with identity data, Facebook credentials, proxy configuration, work/education history, interests, and a daily activity tracker.

The system tracks each profile through a defined lifecycle:

1. **Profile is generated** (auto or manual) and enters the pool as `Available`
2. **A 3rd-party operator** picks it up and registers/builds the Facebook account (`Pending Profile`)
3. **The account goes live** and is actively farmed on the platform (`Active`)
4. **Issues may occur** — restrictions, bans, platform errors (`Flagged`, `Banned`)
5. **When fully set up** — 2FA enabled, page created, friends reached, profile filled — it's marked `Ready`
6. **Delivered to the main client** — end of lifecycle (`Delivered`)

> ⚠️ **All data in this system is entirely synthetic and fictional.** No real users, real images, or real credentials are stored. All sample data below is illustrative only.

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────┐
│                        Identity                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │  identity   │  │ credentials │  │   proxy[ ]       │   │
│  └─────────────┘  └─────────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                     facebook                         │  │
│  │  profile / page / trackerLog / work / education /    │  │
│  │  interest / travels / relationship / otherName       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │  social     │  │  internal   │  │   images[]       │──► Image Collection
│  └─────────────┘  └─────────────┘  └──────────────────┘   │
└────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────┐
│               Page                    │
│  pageName / generationPrompt /        │
│  assets[] / linkedIdentities[]        │
└───────────────────────────────────────┘

┌───────────────────────────────────────┐
│            Human Asset                │
│  name / numberPossibleProfile /       │
│  numberProfileUsing[]                 │
└───────────────────────────────────────┘
```

**Database:** MongoDB  
**Collections:** `identities`, `images`, `pages`, `humanAssets`  
**Relationships:** Reference-based (ObjectId) across collections

---

## Collection: Identity

### Identity Schema Definition

```js
{
  // --- Root Meta ---
  _id:           ObjectId,          // Auto-generated
  schemaVersion: String,            // e.g. "2.1"
  status:        String,            // Enum: see LifecycleStatus — main workflow state
  tags:          [String],          // Enum: see ProfileTag — UI label pills
  createdAt:     Date,
  updatedAt:     Date,

  // --- Identity ---
  identity: {
    firstName:        String,
    middleName:       String,
    lastName:         String,
    dateOfBirth:      Date,
    gender:           String,       // Enum: see Gender
    narrativePrompt:  String,       // AI prompt used to generate this persona's backstory
    generatedAt:      Date,
  },

  // --- Credentials ---
  credentials: {
    emails: [
      {
        address:    String,
        provider:   String,         // Enum: ["gmail", "yahoo", "outlook", "proton", "other"]
        isSelected: Boolean,        // True = the active chosen email for this profile
      }
    ],
    emailPassword:    String,       // Shared password for all email options (stored hashed)
    facebookPassword: String,       // Facebook account password (stored hashed)
    recoveryEmail:    String,       // Backup/recovery email address
    phone:            String,       // Phone number linked to the account
  },

  // --- Proxy (Array — supports multiple proxy entries per identity) ---
  proxy: [
    {
      config: {
        host:     String,
        port:     Number,
        protocol: String,           // Enum: ["http", "https", "socks5"]
        username: String,
        password: String,
      },
      proxyIP:       String,
      proxyLocation: String,
      proxyProvider: String,        // e.g. "BrightData", "Oxylabs"
      proxyType:     String,        // Enum: ["residential", "datacenter", "mobile"]
      isActive:      Boolean,
      lastUsed:      Date,
    }
  ],

  // --- Facebook ---
  facebook: {
    profileUrl:     String,
    page: {
      url: String,
      id:  String,
    },
    has2FA:         Boolean,
    hasPage:        Boolean,        // Whether a Facebook Page has been created
    profileSetup:   Boolean,        // Whether the Facebook profile is fully filled out
    accountStatus:  String,         // Enum: see AccountStatus — platform-level FB status
    accountCreated: Date,           // Date the Facebook account was actually registered
    profileCreated: Date,           // Date the profile was first opened in an antidetect browser
    bio:            String,
    city:           String,
    hometown:       String,
    friendCount:    Number,
    trackerLog: [
      {
        date:  Date,
        notes: String,
      }
    ],
    relationship: {
      status:    String,            // Enum: see RelationshipStatus
      startDate: Date,
      endDate:   Date,
    },
    languages: [String],
    work: [
      {
        company:   String,
        position:  String,
        startDate: Date,
        endDate:   Date,
        current:   Boolean,         // True if this is the active job
        city:      String,
      }
    ],
    education: [
      {
        level:       String,        // Enum: ["highSchool", "college", "graduate"]
        name:        String,
        startDate:   Date,
        endDate:     Date,
        degree:      String,
        isGraduated: Boolean,
      }
    ],
    hobbies: [String],
    interest: {
      music:       [{ name: String }],
      tvShows:     [{ name: String }],
      movies:      [{ name: String }],
      games:       [{ name: String }],
      sportsTeams: [{ name: String }],
    },
    travels: [
      {
        place: String,
        date:  Date,
      }
    ],
    otherNames: [
      {
        name: String,
        type: String,               // Enum: ["nickname", "maiden", "alias"]
      }
    ],
  },

  // --- Social (other platforms) ---
  social: {
    websites:    [String],          // Personal/blog URLs
    socialLinks: [
      {
        platform: String,           // e.g. "Instagram", "Twitter", "TikTok"
        url:      String,
      }
    ],
  },

  // --- Internal (operator-only, not shown on public profile) ---
  internal: {
    notes:         String,          // Operator notes and observations
    avatarUrl:     String,          // Profile photo URL (initials used as fallback)
    coverPhotoUrl: String,          // Cover photo URL
  },

  // --- Images (References to Image Collection) ---
  images: [
    {
      imageId:    ObjectId,         // Ref → images._id
      assignedAt: Date,
    }
  ],
}
```

---

### Identity Sample Document

```json
{
  "_id": "64f3c2a1e4b09d2f1a3c5e77",
  "schemaVersion": "2.1",
  "status": "active",
  "tags": ["Verified"],
  "createdAt": "2025-11-01T08:00:00Z",
  "updatedAt": "2026-03-15T14:22:00Z",

  "identity": {
    "firstName": "Marian",
    "middleName": "Cruz",
    "lastName": "Dela Rosa",
    "dateOfBirth": "1993-06-14T00:00:00Z",
    "gender": "female",
    "narrativePrompt": "Generate a 30-year-old Filipino woman from Manila who works in retail and is active on social media.",
    "generatedAt": "2025-11-01T07:55:00Z"
  },

  "credentials": {
    "emails": [
      {
        "address": "marian.delarosa93@gmail.com",
        "provider": "gmail",
        "isSelected": true
      },
      {
        "address": "marian_cr@yahoo.com",
        "provider": "yahoo",
        "isSelected": false
      }
    ],
    "emailPassword": "$2b$10$Xv3kLmNqRpT8wYzAcBdEfOuIjKlMnOpQrStUvWxYzAbCdEfGhIjKl",
    "facebookPassword": "$2b$10$Ab1cDe2fGh3iJk4lMn5oPq6rSt7uVw8xYz9AbCdEfGhIjKlMnOpQr",
    "recoveryEmail": "marian.backup@gmail.com",
    "phone": "+63 917 555 0142"
  },

  "proxy": [
    {
      "config": {
        "host": "proxy.brightdata.com",
        "port": 22225,
        "protocol": "http",
        "username": "usr_syn_ph_001",
        "password": "$2b$10$hashedproxypassword"
      },
      "proxyIP": "112.204.45.88",
      "proxyLocation": "Manila, Philippines",
      "proxyProvider": "BrightData",
      "proxyType": "residential",
      "isActive": true,
      "lastUsed": "2026-03-15T14:00:00Z"
    },
    {
      "config": {
        "host": "proxy.oxylabs.io",
        "port": 10000,
        "protocol": "https",
        "username": "usr_syn_ph_002",
        "password": "$2b$10$hashedproxypassword2"
      },
      "proxyIP": "103.56.22.14",
      "proxyLocation": "Cebu, Philippines",
      "proxyProvider": "Oxylabs",
      "proxyType": "datacenter",
      "isActive": false,
      "lastUsed": "2025-12-20T09:00:00Z"
    }
  ],

  "facebook": {
    "profileUrl": "https://www.facebook.com/marian.delarosa.ph",
    "page": {
      "url": "https://www.facebook.com/MariansLifeUpdates",
      "id": "100087654321098"
    },
    "has2FA": true,
    "hasPage": true,
    "profileSetup": true,
    "accountStatus": "active",
    "accountCreated": "2018-03-22T00:00:00Z",
    "profileCreated": "2025-11-01T08:00:00Z",
    "bio": "Living life one sale at a time 🛍️ | Proud Manileña | Coffee addict ☕",
    "city": "Manila",
    "hometown": "Caloocan City",
    "friendCount": 487,
    "trackerLog": [
      {
        "date": "2026-01-10T09:12:00Z",
        "notes": "Standard login via residential proxy. No issues."
      },
      {
        "date": "2026-02-14T18:30:00Z",
        "notes": "Posted Valentine's Day image. Engagement: 34 likes, 5 comments."
      },
      {
        "date": "2026-03-05T11:00:00Z",
        "notes": "Identity verification triggered. Resolved via phone number."
      }
    ],
    "relationship": {
      "status": "inARelationship",
      "startDate": "2021-02-14T00:00:00Z",
      "endDate": null
    },
    "languages": ["Filipino", "English"],
    "work": [
      {
        "company": "SM Supermalls",
        "position": "Sales Associate",
        "startDate": "2019-06-01T00:00:00Z",
        "endDate": null,
        "current": true,
        "city": "Manila"
      }
    ],
    "education": [
      {
        "level": "highSchool",
        "name": "Caloocan National Science and Technology High School",
        "startDate": "2007-06-01T00:00:00Z",
        "endDate": "2011-03-30T00:00:00Z",
        "degree": "High School Diploma",
        "isGraduated": true
      },
      {
        "level": "college",
        "name": "Polytechnic University of the Philippines",
        "startDate": "2011-06-01T00:00:00Z",
        "endDate": "2015-04-15T00:00:00Z",
        "degree": "BS Business Administration",
        "isGraduated": true
      }
    ],
    "hobbies": ["Baking", "Thrift shopping", "Watching K-dramas"],
    "interest": {
      "music": [{ "name": "Ben&Ben" }, { "name": "BINI" }],
      "tvShows": [{ "name": "Crash Landing on You" }],
      "movies": [{ "name": "Four Sisters and a Wedding" }],
      "games": [{ "name": "Mobile Legends" }],
      "sportsTeams": [{ "name": "Gilas Pilipinas" }]
    },
    "travels": [
      { "place": "Palawan, Philippines", "date": "2023-04-10T00:00:00Z" },
      { "place": "Bohol, Philippines", "date": "2024-12-26T00:00:00Z" }
    ],
    "otherNames": [{ "name": "Mari", "type": "nickname" }]
  },

  "social": {
    "websites": [],
    "socialLinks": []
  },

  "internal": {
    "notes": "Operator Reyes is handling this profile. Passed verification on 2026-03-05.",
    "avatarUrl": null,
    "coverPhotoUrl": null
  },

  "images": [
    {
      "imageId": "64f3c2a1e4b09d2f1a3c5e01",
      "assignedAt": "2025-11-01T08:05:00Z"
    },
    {
      "imageId": "64f3c2a1e4b09d2f1a3c5e02",
      "assignedAt": "2025-11-01T08:10:00Z"
    }
  ]
}
```

---

## Collection: Image

> Each document in this collection represents a **single image asset**. The `usedBy` array tracks which identities and pages are using it, enabling the dashboard to show utilization and avoid assigning the same profile photo to multiple identities.

### Image Schema Definition

```js
{
  _id:             ObjectId,
  filename:        String,          // e.g. "fp_female_07_001.jpg"
  annotation:      String,          // Internal descriptive tag/label
  type:            String,          // Enum: ["profile", "cover", "post", "document"]
  sourceType:      String,          // Enum: ["generated", "scraped", "stock", "real"]
  aiGenerated:     Boolean,
  generationModel: String,          // e.g. "stable-diffusion-3", null if not AI-generated

  usedBy: [
    {
      userId: ObjectId,             // Ref → identities._id
    }
  ],

  createdAt: Date,
  updatedAt: Date,
}
```

---

### Image Sample Document

```json
{
  "_id": "64f3c2a1e4b09d2f1a3c5e01",
  "filename": "fp_female_07_001.jpg",
  "annotation": "asian_woman_30s_casual_smile",
  "type": "profile",
  "sourceType": "generated",
  "aiGenerated": true,
  "generationModel": "stable-diffusion-3",
  "usedBy": [
    { "userId": "64f3c2a1e4b09d2f1a3c5e77" }
  ],
  "createdAt": "2025-10-20T06:05:00Z",
  "updatedAt": "2026-01-15T12:00:00Z"
}
```

```json
{
  "_id": "64f3c2a1e4b09d2f1a3c5e02",
  "filename": "beach_cover_sunset_002.jpg",
  "annotation": "beach_cover_photo_sunset",
  "type": "cover",
  "sourceType": "stock",
  "aiGenerated": false,
  "generationModel": null,
  "usedBy": [{ "userId": "64f3c2a1e4b09d2f1a3c5e77" }],
  "createdAt": "2025-10-20T06:08:00Z",
  "updatedAt": "2025-11-01T08:10:00Z"
}
```

---

## Collection: Page

### Page Schema Definition

```js
{
  _id:              ObjectId,
  schemaVersion:    String,
  pageName:         String,
  pageId:           String,         // Platform-side page ID
  category:         String,         // Enum: see PageCategory
  followerCount:    Number,
  likeCount:        Number,
  createdAt:        Date,
  updatedAt:        Date,

  generationPrompt: String,         // Prompt used to define this page's content/persona

  linkedIdentities: [ObjectId],     // Refs → identities._id (identities that manage this page)

  assets: [
    {
      imageId:         ObjectId,    // Ref → images._id
      type:            String,      // Enum: ["photo", "video", "link", "story"]
      postDescription: String,
      postedAt:        Date,
      engagementScore: Number,      // Composite: likes + comments + shares
    }
  ],
}
```

---

### Page Sample Document

```json
{
  "_id": "64f3c2a1e4b09d2f1a3c5f10",
  "schemaVersion": "2.1",
  "pageName": "Marian's Life Updates",
  "pageId": "100087654321098",
  "category": "personalBlog",
  "followerCount": 312,
  "likeCount": 298,
  "createdAt": "2018-04-01T00:00:00Z",
  "updatedAt": "2026-03-15T14:30:00Z",

  "generationPrompt": "A casual lifestyle page for a young Filipina woman in Manila. Content should feel personal, include local culture, Filipino holidays, food, K-drama reactions, and occasional shopping hauls.",

  "linkedIdentities": ["64f3c2a1e4b09d2f1a3c5e77"],

  "assets": [
    {
      "imageId": "64f3c2a1e4b09d2f1a3c5e02",
      "type": "photo",
      "postDescription": "Happy Valentine's Day everyone! 💕 Grateful for all the love. #ValentinesDay #Blessed",
      "postedAt": "2026-02-14T18:30:00Z",
      "engagementScore": 47
    },
    {
      "imageId": "64f3c2a1e4b09d2f1a3c5e03",
      "type": "link",
      "postDescription": "OMG just finished Crash Landing on You again. Still crying 😭 #CLOY #KDrama",
      "postedAt": "2026-01-22T21:00:00Z",
      "engagementScore": 31
    },
    {
      "imageId": "64f3c2a1e4b09d2f1a3c5e04",
      "type": "photo",
      "postDescription": "Palawan goals 🌊 Still dreaming of this view. #Palawan #TravelPH",
      "postedAt": "2025-12-28T10:15:00Z",
      "engagementScore": 89
    }
  ]
}
```

---

## Collection: Human Asset

> A **Human Asset** represents a real human operator who manages a pool of synthetic profiles. This tracks how many profiles an operator is authorized to handle and which are currently active under their management.

### Human Asset Schema Definition

```js
{
  _id:                   ObjectId,
  name:                  String,    // Name of the operator
  numberPossibleProfile: Number,    // Max profiles this operator is allowed to manage
  numberProfileUsing: [
    ObjectId                        // Refs → identities._id (currently active profiles)
  ],
  createdAt:             Date,
  updatedAt:             Date,
}
```

---

### Human Asset Sample Document

```json
{
  "_id": "64f3c2a1e4b09d2f1a3c6a01",
  "name": "Operator Reyes",
  "numberPossibleProfile": 10,
  "numberProfileUsing": [
    "64f3c2a1e4b09d2f1a3c5e77",
    "64f3c2a1e4b09d2f1a3c5e99",
    "64f3c2a1e4b09d2f1a3c5eab"
  ],
  "createdAt": "2025-10-01T00:00:00Z",
  "updatedAt": "2026-03-20T10:00:00Z"
}
```

```json
{
  "_id": "64f3c2a1e4b09d2f1a3c6a02",
  "name": "Researcher Tan",
  "numberPossibleProfile": 5,
  "numberProfileUsing": ["64f3c2a1e4b09d2f1a3c5ec1"],
  "createdAt": "2026-01-15T00:00:00Z",
  "updatedAt": "2026-02-10T08:30:00Z"
}
```

> `numberProfileUsing.length` vs `numberPossibleProfile` gives you a quick utilization ratio per operator.

---

## Cross-Collection Relationships

```
identities._id
    │
    ├──► images[].usedBy[].userId     (Image tracks which identity uses it)
    │
    └──► pages.linkedIdentities[]     (Identity manages/owns a Page)

humanAssets.numberProfileUsing[]
    └──► identities._id               (Operator manages Identity)

images._id
    ├──► identities.images[].imageId  (Identity references Image)
    └──► pages.assets[].imageId       (Page references Image)
```

| Relationship           | Type         | Description                                              |
| ---------------------- | ------------ | -------------------------------------------------------- |
| Identity → Image       | Many-to-many | Identities are assigned images from the shared pool      |
| Identity → Page        | One-to-many  | One identity can manage multiple pages                   |
| Page → Image           | Many-to-many | Pages reuse images from the shared image pool            |
| Human Asset → Identity | One-to-many  | One operator manages a pool of profiles                  |

---

## Enum Reference

### LifecycleStatus

The main workflow state for a profile in the 70R34 system.

| Value             | Meaning                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `available`       | Profile is generated and ready. An operator can pick it up. **Default.**                 |
| `pendingProfile`  | Operator has taken the profile and is actively registering/building it on Facebook       |
| `active`          | Account is live and currently being farmed on the platform                               |
| `flagged`         | Account is active but hitting platform errors (e.g. can't create a page, restricted)    |
| `banned`          | Account permanently banned by Facebook                                                   |
| `ready`           | Fully set up — 2FA, page, friends, profile filled — ready to hand off to the client     |
| `delivered`       | Handed to the main client. End of lifecycle.                                             |

### ProfileTag

UI label pills shown on the profile card and detail view.

`"Verified"` `"Bot Suspect"` `"New User"` `"Flagged"` `"Pending Profile"` `"Banned"`

### Gender

`"male"` `"female"` `"other"` `"unspecified"`

### AccountStatus

Facebook platform-level account status (distinct from lifecycle status above).

`"active"` `"restricted"` `"disabled"` `"memorialized"` `"checkpoint"`

### RelationshipStatus

`"single"` `"inARelationship"` `"engaged"` `"married"` `"complicated"` `"separated"` `"widowed"` `"unspecified"`

### ProxyType

`"residential"` `"datacenter"` `"mobile"`

### ProxyProtocol

`"http"` `"https"` `"socks5"`

### EmailProvider

`"gmail"` `"yahoo"` `"outlook"` `"proton"` `"other"`

### ImageType

`"profile"` `"cover"` `"post"` `"document"`

### ImageSourceType

`"generated"` `"scraped"` `"stock"` `"real"`

### AssetType

`"photo"` `"video"` `"link"` `"story"`

### PageCategory

`"news"` `"business"` `"community"` `"entertainment"` `"personalBlog"` `"advocacy"` `"commerce"`

### OtherNameType

`"nickname"` `"maiden"` `"alias"`

### EducationLevel

`"highSchool"` `"college"` `"graduate"`

---

## Requirements Score

Four boolean/numeric fields determine a profile's readiness score (0–4). Displayed on both the list and detail views.

| Requirement        | Field                      | Condition         |
| ------------------ | -------------------------- | ----------------- |
| 2FA enabled        | `facebook.has2FA`          | `=== true`        |
| Page created       | `facebook.hasPage`         | `=== true`        |
| 30+ friends        | `facebook.friendCount`     | `>= 30`           |
| Profile filled out | `facebook.profileSetup`    | `=== true`        |

**Score logic:** `has2FA + hasPage + (friendCount >= 30) + profileSetup` → 0–4  
- 4/4 → green · 2–3 → amber · <2 → red

When all four conditions are met, the lifecycle status should progress to `ready`.

---

## Indexing Strategy

```js
// identities collection
db.identities.createIndex(
  { "credentials.emails.address": 1 },
  { unique: true },
);
db.identities.createIndex({ "proxy.proxyIP": 1 });
db.identities.createIndex({ "facebook.profileUrl": 1 }, { unique: true });
db.identities.createIndex({ status: 1 });
db.identities.createIndex({ createdAt: -1 });

// images collection
db.images.createIndex({ "usedBy.userId": 1 });
db.images.createIndex({ type: 1, sourceType: 1 });
db.images.createIndex({ aiGenerated: 1 });

// pages collection
db.pages.createIndex({ pageId: 1 }, { unique: true });
db.pages.createIndex({ linkedIdentities: 1 });

// humanAssets collection
db.humanAssets.createIndex({ name: 1 });
db.humanAssets.createIndex({ numberProfileUsing: 1 });
```

---

## Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                            |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2025-06-01 | Initial schema — Identity, Image, Page                                                                                                                                                                                                                                                                                             |
| 1.5     | 2025-09-15 | Added `trackerLog.actionType`, normalized Education to array                                                                                                                                                                                                                                                                       |
| 2.0     | 2026-04-03 | Added `accountAge`, `proxyType`, `aiGenerated`, `engagementScore`, `linkedIdentities`, `schemaVersion`, standardized all enums to camelCase                                                                                                                                                                                        |
| 2.1     | 2026-04-03 | Removed ML/bot-detection framing — reframed as CRM lifecycle tool. Removed `label` field. Added `status` (lifecycle), `tags`, `hasPage`, `profileSetup`, `profileCreated`, `recoveryEmail`, `phone`, `social`, `internal` sections. Renamed `accountAge` → `accountCreated`. Added `current` to work entries. Added `Requirements Score` section. Added Human Asset collection. Proxy changed to array. Image collection restructured to single-document-per-image with flat `usedBy[]`. |

---

_70R34 — Internal Use Only_
