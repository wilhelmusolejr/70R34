/* global process */

import dotenv from "dotenv";
import { createApp } from "./app.js";
import { connectToDatabase } from "./config/db.js";

dotenv.config();

const PORT = Number.parseInt(process.env.PORT || "4000", 10);
const MONGODB_URI = process.env.MONGODB_URI;

await connectToDatabase(MONGODB_URI);

const app = createApp();

app.listen(PORT, () => {
  console.log(`70R34 server listening on http://localhost:${PORT}`);
});


