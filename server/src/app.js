import cors from "cors";
import express from "express";
import authRouter from "./routes/auth.js";
import humanAssetsRouter from "./routes/humanAssets.js";
import pagesRouter from "./routes/pages.js";
import profilesRouter from "./routes/profiles.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/human-assets", humanAssetsRouter);
  app.use("/api/pages", pagesRouter);
  app.use("/api/profiles", profilesRouter);

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

