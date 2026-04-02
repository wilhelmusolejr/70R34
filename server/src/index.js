/* global process */
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { connectToDatabase } from "./config/db.js";

dotenv.config();

const PORT = Number.parseInt(process.env.PORT || "4000", 10);
const MONGODB_URI = process.env.MONGODB_URI;

await connectToDatabase(MONGODB_URI);

const app = createApp();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../../dist");

app.use(express.static(distPath));

app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`70R34 server listening on http://localhost:${PORT}`);
});
