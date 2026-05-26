import { Router } from "express";
import mongoose from "mongoose";
import {
  Sharer,
  SHARER_TYPES,
  SHARER_STATUSES,
} from "../models/Sharer.js";

const router = Router();

function formatSharer(sharer) {
  return {
    id: String(sharer._id),
    url: sharer.url,
    country: sharer.country,
    type: sharer.type,
    status: sharer.status,
    label: sharer.label,
    notes: sharer.notes,
    tags: sharer.tags || [],
    lastUsedAt: sharer.lastUsedAt,
    createdAt: sharer.createdAt,
    updatedAt: sharer.updatedAt,
  };
}

function normalizeCountry(raw) {
  const value = String(raw || "").trim().toUpperCase();
  if (value.length !== 2) return null;
  return value;
}

function normalizeUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!parsed.protocol.startsWith("http")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

router.get("/", async (req, res, next) => {
  try {
    const filter = {};

    const country = normalizeCountry(req.query.country);
    if (req.query.country && !country) {
      return res
        .status(400)
        .json({ message: "country must be a 2-letter code (e.g. US, IT)" });
    }
    if (country) filter.country = country;

    const typeInput = String(req.query.type || "").trim();
    if (typeInput) {
      if (!SHARER_TYPES.includes(typeInput)) {
        return res.status(400).json({
          message: `type must be one of: ${SHARER_TYPES.join(", ")}`,
        });
      }
      filter.type = typeInput;
    }

    const statusInput = String(req.query.status || "").trim();
    if (statusInput) {
      if (!SHARER_STATUSES.includes(statusInput)) {
        return res.status(400).json({
          message: `status must be one of: ${SHARER_STATUSES.join(", ")}`,
        });
      }
      filter.status = statusInput;
    }

    const limitInput = Number.parseInt(req.query.limit, 10);
    const limit =
      Number.isInteger(limitInput) && limitInput > 0 && limitInput <= 500
        ? limitInput
        : null;

    const skipInput = Number.parseInt(req.query.skip, 10);
    const skip = Number.isInteger(skipInput) && skipInput > 0 ? skipInput : 0;

    let query = Sharer.find(filter).sort({ createdAt: -1 });
    if (skip) query = query.skip(skip);
    if (limit !== null) query = query.limit(limit);

    const sharers = await query.lean();
    res.json(sharers.map(formatSharer));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const url = normalizeUrl(req.body?.url);
    if (!url) {
      return res
        .status(400)
        .json({ message: "url is required and must be a valid http(s) URL" });
    }

    const country = normalizeCountry(req.body?.country);
    if (!country) {
      return res
        .status(400)
        .json({ message: "country is required (2-letter code, e.g. US, IT)" });
    }

    const typeInput = String(req.body?.type || "profile").trim();
    if (!SHARER_TYPES.includes(typeInput)) {
      return res.status(400).json({
        message: `type must be one of: ${SHARER_TYPES.join(", ")}`,
      });
    }

    const statusInput = String(req.body?.status || "active").trim();
    if (!SHARER_STATUSES.includes(statusInput)) {
      return res.status(400).json({
        message: `status must be one of: ${SHARER_STATUSES.join(", ")}`,
      });
    }

    const label = req.body?.label ? String(req.body.label).trim() || null : null;
    const notes = req.body?.notes ? String(req.body.notes).trim() || null : null;
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    try {
      const created = await Sharer.create({
        url,
        country,
        type: typeInput,
        status: statusInput,
        label,
        notes,
        tags,
      });
      return res.status(201).json(formatSharer(created.toObject()));
    } catch (err) {
      if (err?.code === 11000) {
        return res
          .status(409)
          .json({ message: "A sharer with this url already exists" });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/bulk", async (req, res, next) => {
  try {
    const rawEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (!rawEntries.length) {
      return res
        .status(400)
        .json({ message: "Provide at least one entry." });
    }

    const country = normalizeCountry(req.body?.country);
    if (!country) {
      return res
        .status(400)
        .json({ message: "country is required (2-letter code, e.g. US, IT)" });
    }

    const typeInput = String(req.body?.type || "profile").trim();
    if (!SHARER_TYPES.includes(typeInput)) {
      return res.status(400).json({
        message: `type must be one of: ${SHARER_TYPES.join(", ")}`,
      });
    }

    const statusInput = String(req.body?.status || "active").trim();
    if (!SHARER_STATUSES.includes(statusInput)) {
      return res.status(400).json({
        message: `status must be one of: ${SHARER_STATUSES.join(", ")}`,
      });
    }

    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    const parsed = [];
    const invalid = [];

    rawEntries.forEach((entry, index) => {
      const url = normalizeUrl(entry);
      if (!url) {
        invalid.push({
          index,
          raw: String(entry || ""),
          reason: "Invalid URL",
        });
        return;
      }
      parsed.push({
        url,
        country,
        type: typeInput,
        status: statusInput,
        tags,
      });
    });

    if (!parsed.length) {
      return res
        .status(400)
        .json({ message: "No valid entries found.", invalid });
    }

    let createdDocs = [];
    try {
      createdDocs = await Sharer.insertMany(parsed, {
        ordered: false,
        rawResult: false,
      });
    } catch (err) {
      if (err?.writeErrors && Array.isArray(err.writeErrors)) {
        createdDocs = Array.isArray(err.insertedDocs) ? err.insertedDocs : [];
        err.writeErrors.forEach((writeErr) => {
          const failed = parsed[writeErr.index];
          invalid.push({
            index: writeErr.index,
            raw: failed ? failed.url : "",
            reason:
              writeErr.code === 11000
                ? "Duplicate (this url already exists)"
                : writeErr.errmsg || "Insert failed",
          });
        });
      } else {
        throw err;
      }
    }

    res.status(201).json({
      created: createdDocs.map(formatSharer),
      createdCount: createdDocs.length,
      invalid,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid sharer id" });
    }

    const sharer = await Sharer.findById(id).lean();
    if (!sharer) {
      return res.status(404).json({ message: "Sharer not found" });
    }

    res.json(formatSharer(sharer));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid sharer id" });
    }

    const body = req.body || {};
    const update = {};

    if (Object.prototype.hasOwnProperty.call(body, "url")) {
      const url = normalizeUrl(body.url);
      if (!url) {
        return res
          .status(400)
          .json({ message: "url must be a valid http(s) URL" });
      }
      update.url = url;
    }

    if (Object.prototype.hasOwnProperty.call(body, "country")) {
      const country = normalizeCountry(body.country);
      if (!country) {
        return res
          .status(400)
          .json({ message: "country must be a 2-letter code (e.g. US, IT)" });
      }
      update.country = country;
    }

    if (Object.prototype.hasOwnProperty.call(body, "type")) {
      const value = String(body.type || "").trim();
      if (!SHARER_TYPES.includes(value)) {
        return res.status(400).json({
          message: `type must be one of: ${SHARER_TYPES.join(", ")}`,
        });
      }
      update.type = value;
    }

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const value = String(body.status || "").trim();
      if (!SHARER_STATUSES.includes(value)) {
        return res.status(400).json({
          message: `status must be one of: ${SHARER_STATUSES.join(", ")}`,
        });
      }
      update.status = value;
    }

    for (const field of ["label", "notes"]) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
      const raw = body[field];
      update[field] =
        raw === null || raw === undefined || String(raw).trim() === ""
          ? null
          : String(raw).trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, "tags")) {
      update.tags = Array.isArray(body.tags)
        ? body.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [];
    }

    if (Object.prototype.hasOwnProperty.call(body, "lastUsedAt")) {
      const raw = body.lastUsedAt;
      if (raw === null || raw === "") {
        update.lastUsedAt = null;
      } else {
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
          return res
            .status(400)
            .json({ message: "lastUsedAt must be a valid date" });
        }
        update.lastUsedAt = date;
      }
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    let sharer;
    try {
      sharer = await Sharer.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      }).lean();
    } catch (err) {
      if (err?.code === 11000) {
        return res
          .status(409)
          .json({ message: "Another sharer already exists with this url" });
      }
      throw err;
    }

    if (!sharer) {
      return res.status(404).json({ message: "Sharer not found" });
    }

    res.json(formatSharer(sharer));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid sharer id" });
    }

    const deleted = await Sharer.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Sharer not found" });
    }

    res.json({ ok: true, id: String(deleted._id) });
  } catch (error) {
    next(error);
  }
});

export default router;
