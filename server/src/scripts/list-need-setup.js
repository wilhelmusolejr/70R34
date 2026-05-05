/* global process */

import dotenv from "dotenv";
import { connectToDatabase } from "../config/db.js";
import { Profile } from "../models/Profile.js";

dotenv.config();

await connectToDatabase(process.env.MONGODB_URI);

const idsOnly = process.argv.includes("--ids");
const asJson = process.argv.includes("--json");

const result = await Profile.find({ status: "Need Setup" })
  .select("_id firstName lastName status")
  .lean();

if (asJson) {
  console.log(JSON.stringify(result.map((p) => String(p._id))));
} else if (idsOnly) {
  for (const p of result) console.log(String(p._id));
} else {
  console.log(`Total: ${result.length}\n`);
  for (const p of result) {
    console.log(`${p._id}  ${p.firstName} ${p.lastName}`);
  }
}

process.exit(0);
