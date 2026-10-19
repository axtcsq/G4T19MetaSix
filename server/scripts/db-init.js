// Creates every collection and its indexes. Run it once per database, and
// again whenever an index is added or changed:
//   npm run db:init
import "dotenv/config";
import dns from "node:dns/promises";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import DailyMood from "../models/DailyMood.js";
import Listen from "../models/Listen.js";
import MoodLog from "../models/MoodLog.js";
import SyncGap from "../models/SyncGap.js";
import Track from "../models/Track.js";
import User from "../models/User.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const MODELS = [User, Listen, Track, DailyMood, SyncGap, MoodLog];

async function init() {
  await connectDB();

  for (const model of MODELS) {
    // Creates the collection up front so it shows in Atlas straight away.
    await model.createCollection();
    // Only creates missing indexes. Don't use syncIndexes(): it also drops
    // any index that isn't in the schema.
    await model.createIndexes();

    const indexes = await model.collection.indexes();
    console.log(
      `[db-init] ${model.collection.collectionName}: ${indexes.map((index) => index.name).join(", ")}`,
    );
  }
}

try {
  await init();
  console.log(`[db-init] Done (${mongoose.connection.name})`);
} catch (error) {
  console.error("[db-init] Failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
