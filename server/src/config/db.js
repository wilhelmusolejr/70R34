import mongoose from "mongoose";

export async function connectToDatabase(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);

  try {
    await mongoose.connection.collection("profiles").dropIndex("id_1");
  } catch {
    // index already dropped or never existed
  }

  try {
    await mongoose.connection.collection("proxies").dropIndex("host_1_port_1");
  } catch {
    // index already dropped or never existed
  }
}
