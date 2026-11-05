// Recompute stored song moods and daily summaries after mood-rule changes. Run manually with `node jobs/recompute.js` from the server directory.
import "dotenv/config";
import dns from "node:dns/promises";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { rebuildDailyMoods } from "../services/dailyMoods.js";
import { trackMoods } from "../services/mood/index.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const BATCH = 500;

async function run() {
  await connectDB();
  console.log(`[recompute] ${mongoose.connection.name}`);

  const cursor = Track.find(
    { "analysis.status": { $in: ["done", "partial"] }, "features.valence": { $ne: null } },
    { features: 1, lyrics: 1 },
  )
    .lean()
    .cursor();

  let writes = [];
  let songs = 0;
  for await (const track of cursor) {
    const moods = trackMoods(track.features, track.lyrics);
    writes.push({
      updateOne: {
        filter: { _id: track._id },
        update: { $set: { moods, "analysis.status": moods.lyrics ? "done" : "partial" } },
      },
    });
    songs += 1;
    if (writes.length === BATCH) {
      await Track.bulkWrite(writes, { ordered: false });
      writes = [];
    }
  }
  if (writes.length) {
    await Track.bulkWrite(writes, { ordered: false });
  }
  console.log(`[recompute] ${songs} songs recomputed`);

  const userIds = await Listen.distinct("userId");
  let days = 0;
  for (const userId of userIds) {
    days += await rebuildDailyMoods(userId);
  }
  console.log(`[recompute] Done: ${days} days rebuilt for ${userIds.length} users`);
}

try {
  await run();
} catch (error) {
  console.error("[recompute] Failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
