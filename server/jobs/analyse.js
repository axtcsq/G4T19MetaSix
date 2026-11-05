// Analyse synced tracks and rebuild their daily summaries. Run with `node jobs/analyse.js` from server/.
import "dotenv/config";
import dns from "node:dns/promises";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Track from "../models/Track.js";
import { rebuildDaysWithTracks } from "../services/dailyMoods.js";
import { MAX_ATTEMPTS, analyseTrack } from "../services/mood/analyse.js";
import { SCORER_VERSION, loadModel } from "../services/mood/emotion.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const MAX_TRACKS = 100;
const TIME_BUDGET_MS = 10 * 60 * 1000;

async function run() {
  const started = Date.now();
  await connectDB();

  const filter = {
    $or: [
      {
        "analysis.status": { $in: ["pending", "partial", "failed"] },
        "analysis.attempts": { $lt: MAX_ATTEMPTS },
      },
      // Songs with no sound data get one lyrics read for a lyrics-only mood.
      { "analysis.status": "no-data", "lyrics.scorerVersion": { $ne: SCORER_VERSION } },
    ],
  };
  // No DeepL key means songs waiting on a translation would just fail again, so they wait until there's a key.
  if (!process.env.DEEPL_API_KEY?.trim()) {
    console.warn("[analyse] DEEPL_API_KEY is not set: non-English lyrics are skipped");
    filter.$nor = [{ "analysis.status": "partial", "lyrics.status": "untranslated" }];
  }

  // New songs first, then retries (least recently tried first) so songs stuck on a busy service don't crowd out the rest.
  const tracks = await Track.find(filter, { _id: 1, name: 1 })
    .sort({ "analysis.attempts": 1, "analysis.analysedAt": 1 })
    .limit(MAX_TRACKS)
    .lean();
  console.log(`[analyse] ${mongoose.connection.name}: ${tracks.length} songs to analyse`);
  if (!tracks.length) {
    return;
  }

  // Load the emotion model before any song, so a broken download stops the run instead of marking every song's lyrics unavailable.
  await loadModel();

  const counts = {};
  const changed = [];
  for (const track of tracks) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      console.log("[analyse] Out of time; the rest wait for the next run");
      break;
    }
    const songStarted = Date.now();
    const result = await analyseTrack(track._id);
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    if (result.moodsChanged) {
      changed.push(track._id);
    }
    const note = result.error ? `: ${result.error.message}` : "";
    // Where the time went, e.g. "(3.1s: sound 0.8s, lyrics 1.9s)". The rest is the database.
    const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
    const steps = Object.entries(result.timings ?? {}).map(([step, ms]) => `${step} ${seconds(ms)}`);
    const took = [seconds(Date.now() - songStarted), ...(steps.length ? [steps.join(", ")] : [])].join(": ");
    console.log(`[analyse] ${track._id} ${track.name}: ${result.status}${note} (${took})`);
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
