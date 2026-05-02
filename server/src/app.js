import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRouter from "./routes/auth.js";
import humanAssetsRouter from "./routes/humanAssets.js";
import pagesRouter from "./routes/pages.js";
import profilesRouter from "./routes/profiles.js";
import proxiesRouter from "./routes/proxies.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicImagesDir = path.resolve(__dirname, "../../public/images");

export function createApp() {
  const app = express();

  app.set("trust proxy", true);

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/dev/images", (_req, res) => {
    try {
      const entries = fs.readdirSync(publicImagesDir, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const stat = fs.statSync(path.join(publicImagesDir, entry.name));
          return { name: entry.name, size: stat.size, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
      res.json({ files });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/human-assets", humanAssetsRouter);
  app.use("/api/pages", pagesRouter);
  app.use("/api/profiles", profilesRouter);
  app.use("/api/proxies", proxiesRouter);

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "API route not found" });
  });

  app.use(function errorHandler(err, _req, res, next) {
    void next;
    console.error("Unhandled error:", err.message);
    res.status(500).json({
      message: err.message || "Internal server error",
    });
  });

  return app;
}

