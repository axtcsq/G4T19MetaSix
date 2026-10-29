// Works out the moods of songs the sync job saved, then rebuilds the days they
// were played on. GitHub Actions runs it straight after jobs/sync.js
// (.github/workflows/sync.yml); run it by hand from the server folder with
//   node jobs/analyse.js
// Songs are analysed one at a time, at most MAX_TRACKS per run and only until
// TIME_BUDGET_MS has passed, so a run stays inside the free APIs' limits and the
// workflow's timeout. Whatever is left is picked up by the next run.
import "dotenv/config";
import dns from "node:dns/promises";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Track from "../models/Track.js";
import { rebuildDaysWithTracks } from "../services/dailyMoods.js";
import { MAX_ATTEMPTS, analyseTrack } from "../services/mood/analyse.js";
import { loadModel } from "../services/mood/emotion.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const MAX_TRACKS = 100;
const TIME_BUDGET_MS = 10 * 60 * 1000;

async function run() {
  const started = Date.now();
  await connectDB();

  const filter = {
    "analysis.status": { $in: ["pending", "partial", "failed"] },
    "analysis.attempts": { $lt: MAX_ATTEMPTS },
  };
  // Without a DeepL key, songs waiting on a translation would only fail again.
  // They're retried once a key is set.
  if (!process.env.DEEPL_API_KEY?.trim()) {
    console.warn("[analyse] DEEPL_API_KEY is not set: non-English lyrics are skipped");
    filter.$nor = [{ "analysis.status": "partial", "lyrics.status": "untranslated" }];
  }

  // New songs first, then retries.
  const tracks = await Track.find(filter, { _id: 1, name: 1 })
    .sort({ "analysis.attempts": 1 })
    .limit(MAX_TRACKS)
    .lean();
  console.log(`[analyse] ${mongoose.connection.name}: ${tracks.length} songs to analyse`);
  if (!tracks.length) {
    return;
  }

  // Load the emotion model once, before any song, so a broken download stops
  // the run instead of marking every song's lyrics unavailable.
  await loadModel();

  const counts = {};
  const changed = [];
  for (const track of tracks) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      console.log("[analyse] Out of time; the rest wait for the next run");
      break;
    }
    const result = await analyseTrack(track._id);
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    if (result.moodsChanged) {
      changed.push(track._id);
    }
    const note = result.error ? `: ${result.error.message}` : "";
    console.log(`[analyse] ${track._id} ${track.name}: ${result.status}${note}`);
  }

  const days = await rebuildDaysWithTracks(changed);
  const summary = Object.entries(counts)
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
  console.log(`[analyse] Done: ${summary}; ${days} days rebuilt`);
}

try {
  await run();
} catch (error) {
  console.error("[analyse] Failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
