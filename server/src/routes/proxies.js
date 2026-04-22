import { Router } from "express";
import mongoose from "mongoose";
import {
  Proxy,
  PROXY_PROTOCOLS,
  PROXY_STATUSES,
  PROXY_TYPES,
} from "../models/Proxy.js";

const router = Router();

function parseProxyLine(raw) {
  const line = String(raw || "").trim();
  if (!line) return null;

  const parts = line.split(":").map((part) => part.trim());
  if (parts.length < 2) return null;

  const [host, portStr, username = null, password = null] = parts;
  const port = Number.parseInt(portStr, 10);

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return {
    host,
    port,
    username: username || null,
    password: password || null,
  };
}

function formatProxy(proxy) {
  return {
    id: String(proxy._id),
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password,
    source: proxy.source,
    type: proxy.type,
    protocol: proxy.protocol,
    label: proxy.label,
    status: proxy.status,
    country: proxy.country,
    city: proxy.city,
    notes: proxy.notes,
    tags: proxy.tags || [],
    lastCheckedAt: proxy.lastCheckedAt,
    lastKnownIp: proxy.lastKnownIp,
    expiresAt: proxy.expiresAt,
    cost: proxy.cost,
    currency: proxy.currency,
    createdAt: proxy.createdAt,
    updatedAt: proxy.updatedAt,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const filter = {};

    const statusInput = String(req.query.status || "").trim();
    if (statusInput) {
      if (!PROXY_STATUSES.includes(statusInput)) {
        return res.status(400).json({
          message: `Status must be one of: ${PROXY_STATUSES.join(", ")}`,
        });
      }
      filter.status = statusInput;
    }

    const typeInput = String(req.query.type || "").trim();
    if (typeInput) {
      if (!PROXY_TYPES.includes(typeInput)) {
        return res.status(400).json({
          message: `Type must be one of: ${PROXY_TYPES.join(", ")}`,
        });
      }
      filter.type = typeInput;
    }

    const limitInput = Number.parseInt(req.query.limit, 10);
    const limit =
      Number.isInteger(limitInput) && limitInput > 0 && limitInput <= 500
        ? limitInput
        : null;

    const skipInput = Number.parseInt(req.query.skip, 10);
    const skip = Number.isInteger(skipInput) && skipInput > 0 ? skipInput : 0;

    let query = Proxy.find(filter).sort({ createdAt: -1 });
    if (skip) query = query.skip(skip);
    if (limit !== null) query = query.limit(limit);

    const proxies = await query.lean();
    res.json(proxies.map(formatProxy));
  } catch (error) {
    next(error);
  }
});

router.post("/bulk", async (req, res, next) => {
  try {
    const rawEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (!rawEntries.length) {
      return res.status(400).json({ message: "Provide at least one proxy entry." });
    }

    const type = String(req.body?.type || "").trim();
    if (!PROXY_TYPES.includes(type)) {
      return res.status(400).json({
        message: `Type must be one of: ${PROXY_TYPES.join(", ")}`,
      });
    }

    const protocolInput = String(req.body?.protocol || "").trim();
    const protocol = protocolInput
      ? PROXY_PROTOCOLS.includes(protocolInput)
        ? protocolInput
        : null
      : null;
    if (protocolInput && !protocol) {
      return res.status(400).json({
        message: `Protocol must be one of: ${PROXY_PROTOCOLS.join(", ")}`,
      });
    }

    const statusInput = String(req.body?.status || "pending").trim();
    const status = PROXY_STATUSES.includes(statusInput) ? statusInput : "pending";

    const source = req.body?.source ? String(req.body.source).trim() || null : null;
    const country = req.body?.country ? String(req.body.country).trim() || null : null;
    const city = req.body?.city ? String(req.body.city).trim() || null : null;
    const notes = req.body?.notes ? String(req.body.notes).trim() || null : null;
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];

    const parsed = [];
    const invalid = [];

    rawEntries.forEach((entry, index) => {
      const result = parseProxyLine(entry);
      if (!result) {
        invalid.push({
          index,
          raw: String(entry || ""),
          reason: "Invalid format (expected host:port[:user:pass])",
        });
        return;
      }
      parsed.push({
        ...result,
        source,
        type,
        protocol,
        status,
        country,
        city,
        notes,
        tags,
      });
    });

    if (!parsed.length) {
      return res.status(400).json({
        message: "No valid proxy entries found.",
        invalid,
      });
    }

    let createdDocs = [];
    try {
      createdDocs = await Proxy.insertMany(parsed, {
        ordered: false,
        rawResult: false,
      });
    } catch (err) {
      if (err?.writeErrors && Array.isArray(err.writeErrors)) {
        createdDocs = Array.isArray(err.insertedDocs) ? err.insertedDocs : [];
        err.writeErrors.forEach((writeErr) => {
          const failedEntry = parsed[writeErr.index];
          invalid.push({
            index: writeErr.index,
            raw: failedEntry
              ? [
                  failedEntry.host,
                  failedEntry.port,
                  failedEntry.username || "",
                  failedEntry.password || "",
                ]
                  .filter(Boolean)
                  .join(":")
              : "",
            reason:
              writeErr.code === 11000
                ? "Duplicate (same host:port:user:pass already exists)"
                : writeErr.errmsg || "Insert failed",
          });
        });
      } else {
        throw err;
      }
    }

    res.status(201).json({
      created: createdDocs.map(formatProxy),
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
      return res.status(400).json({ message: "Invalid proxy id" });
    }

    const proxy = await Proxy.findById(id).lean();
    if (!proxy) {
      return res.status(404).json({ message: "Proxy not found" });
    }

    res.json(formatProxy(proxy));
  } catch (error) {
    next(error);
  }
});

const UPDATABLE_STRING_FIELDS = [
  "host",
  "source",
  "label",
  "country",
  "city",
  "notes",
  "lastKnownIp",
  "currency",
];

const ENUM_FIELDS = {
  type: PROXY_TYPES,
  protocol: PROXY_PROTOCOLS,
  status: PROXY_STATUSES,
};

router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid proxy id" });
    }

    const body = req.body || {};
    const update = {};

    for (const field of UPDATABLE_STRING_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
      const raw = body[field];
      if (raw === null || raw === undefined || String(raw).trim() === "") {
        update[field] = null;
      } else {
        update[field] = String(raw).trim();
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "port")) {
      const port = Number.parseInt(body.port, 10);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return res.status(400).json({ message: "Port must be 1–65535" });
      }
      update.port = port;
    }

    if (Object.prototype.hasOwnProperty.call(body, "username")) {
      const raw = body.username;
      update.username =
        raw === null || raw === undefined || String(raw).trim() === ""
          ? null
          : String(raw).trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, "password")) {
      const raw = body.password;
      update.password =
        raw === null || raw === undefined || String(raw).trim() === ""
          ? null
          : String(raw);
    }

    for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
      const raw = body[field];

      if (field === "protocol" && (raw === null || raw === "")) {
        update.protocol = null;
        continue;
      }

      const value = String(raw || "").trim();
      if (!allowed.includes(value)) {
        return res.status(400).json({
          message: `${field} must be one of: ${allowed.join(", ")}`,
        });
      }
      update[field] = value;
    }

    if (Object.prototype.hasOwnProperty.call(body, "tags")) {
      update.tags = Array.isArray(body.tags)
        ? body.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [];
    }

    if (Object.prototype.hasOwnProperty.call(body, "cost")) {
      if (body.cost === null || body.cost === "") {
        update.cost = null;
      } else {
        const cost = Number(body.cost);
        if (!Number.isFinite(cost)) {
          return res.status(400).json({ message: "Cost must be a number" });
        }
        update.cost = cost;
      }
    }

    for (const field of ["lastCheckedAt", "expiresAt"]) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
      const raw = body[field];
      if (raw === null || raw === "") {
        update[field] = null;
        continue;
      }
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: `${field} must be a valid date` });
      }
      update[field] = date;
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    let proxy;
    try {
      proxy = await Proxy.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      }).lean();
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({
          message: "Another proxy already exists with this host:port:user:pass",
        });
      }
      throw err;
    }

    if (!proxy) {
      return res.status(404).json({ message: "Proxy not found" });
    }

    res.json(formatProxy(proxy));
  } catch (error) {
    next(error);
  }
});

export default router;
