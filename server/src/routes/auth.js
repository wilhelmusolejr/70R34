import { Buffer } from "node:buffer";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { User, USER_DEFAULT_COUNTRIES } from "../models/User.js";

const router = Router();

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = String(storedHash || "").split(":");
  if (!salt || !originalHash) return false;

  const derived = scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, "hex");
  if (derived.length !== originalBuffer.length) return false;

  return timingSafeEqual(derived, originalBuffer);
}

function sanitizeUser(user) {
  return {
    id: user._id,
    username: user.username,
    role: user.role,
    defaultCountry: user.defaultCountry || "US",
    profiles: user.profiles || [],
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const existing = await User.findOne({ username }).lean();
    if (existing) {
      return res.status(409).json({ message: "Username already exists." });
    }

    const user = await User.create({
      username,
      passwordHash: hashPassword(password),
      role: "guest",
      profiles: [],
    });

    res.status(201).json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const user = await User.findOne({ username });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:userId/default-country", async (req, res, next) => {
  try {
    const userId = String(req.params.userId || "").trim();
    const country = String(req.body?.country || "").trim();

    if (!userId) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (!USER_DEFAULT_COUNTRIES.includes(country)) {
      return res.status(400).json({
        message: `Country must be one of: ${USER_DEFAULT_COUNTRIES.join(", ")}`,
      });
    }

    const result = await User.updateOne(
      { _id: userId },
      { $set: { defaultCountry: country } },
    );
    if (!result.matchedCount) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = await User.findById(userId).lean();
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:userId/profiles/:profileId", async (req, res, next) => {
  try {
    const userId = String(req.params.userId || "").trim();
    const profileId = String(req.params.profileId || "").trim();
    const assignmentStatus = String(req.body?.assignmentStatus || "").trim();

    if (!userId || !profileId) {
      return res.status(400).json({ message: "Invalid user or profile id." });
    }

    if (!["pending", "completed"].includes(assignmentStatus)) {
      return res.status(400).json({ message: "Invalid assignment status." });
    }

    const update = { "profiles.$.assignmentStatus": assignmentStatus };
    if (assignmentStatus === "completed") {
      update["profiles.$.submittedAt"] = new Date().toISOString();
    }

    const result = await User.updateOne(
      { _id: userId, "profiles.profileId": profileId },
      { $set: update },
    );
    if (!result.matchedCount) {
      return res.status(404).json({ message: "User or profile assignment not found." });
    }

    const user = await User.findById(userId).lean();
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

// List of users for dashboard filters and per-maker charts.
router.get("/users", async (_req, res, next) => {
  try {
    const users = await User.find({}, { passwordHash: 0 }).lean();
    res.json(users.map((user) => sanitizeUser(user)));
  } catch (error) {
    next(error);
  }
});

export default router;
