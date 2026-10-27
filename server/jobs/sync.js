// Saves every active user's newest Spotify plays. GitHub Actions runs it every
// 15 minutes (.github/workflows/sync.yml); run it by hand from the server folder with
//   node jobs/sync.js
// The paused demo user and users who revoked access are skipped. Exits with an
// error code if any user failed, so GitHub reports the failed run.
import "dotenv/config";
import dns from "node:dns/promises";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import { recordSyncFailure, syncUser } from "../services/sync.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

async function run() {
  await connectDB();
  const users = await User.find(
    { "tracking.status": "active", isDemo: { $ne: true }, "preferences.savePlays": { $ne: false } },
    { displayName: 1 },
  ).lean();
  console.log(`[sync] ${mongoose.connection.name}: ${users.length} active users`);

  let failed = 0;
  for (const user of users) {
    // One user at a time keeps well inside Spotify's rate limits.
    try {
      const result = await syncUser(user._id);
      if (result.status === "revoked") {
        console.log(`[sync] ${user._id}: access revoked, tracking stopped`);
      } else {
        const gap = result.gap ? ", gap recorded" : "";
        console.log(`[sync] ${user._id}: ${result.added} new plays${gap}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[sync] ${user._id}: failed: ${error.message}`);
      await recordSyncFailure(user._id, error);
    }
  }

  console.log(`[sync] Done: ${users.length - failed} synced, ${failed} failed`);
  if (failed) {
    process.exitCode = 1;
  }
}

try {
  await run();
} catch (error) {
  console.error("[sync] Failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
