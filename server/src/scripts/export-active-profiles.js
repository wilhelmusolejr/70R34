/* global process */

import dotenv from "dotenv";
import { connectToDatabase } from "../config/db.js";
import { Profile } from "../models/Profile.js";

dotenv.config();

await connectToDatabase(process.env.MONGODB_URI);

const result = await Profile.aggregate([
  { $match: { status: "Active" } },
  {
    $project: {
      _id: 0,
      email: {
        $let: {
          vars: {
            sel: {
              $first: {
                $filter: {
                  input: "$emails",
                  as: "e",
                  cond: { $eq: ["$$e.selected", true] },
                },
              },
            },
          },
          in: "$$sel.address",
        },
      },
      emailPassword: 1,
      facebookPassword: 1,
      friends: 1,
      profileUrl: 1,
    },
  },
]);

console.log(JSON.stringify(result, null, 2));
process.exit(0);
