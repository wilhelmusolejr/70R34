import { Buffer } from "node:buffer";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { User } from "../models/User.js";

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

router.patch("/users/:userId/profiles/:profileId", async (req, res, next) => {
  try {
    const userId = String(req.params.userId || "").trim();
    const profileId = Number.parseInt(req.params.profileId, 10);
    const assignmentStatus = String(req.body?.assignmentStatus || "").trim();

    if (!userId || Number.isNaN(profileId)) {
      return res.status(400).json({ message: "Invalid user or profile id." });
    }

    if (!["pending", "completed"].includes(assignmentStatus)) {
      return res.status(400).json({ message: "Invalid assignment status." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const entry = (user.profiles || []).find((item) => item.profileId === profileId);
    if (!entry) {
      return res.status(404).json({ message: "Profile assignment not found." });
    }

    entry.assignmentStatus = assignmentStatus;
    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
