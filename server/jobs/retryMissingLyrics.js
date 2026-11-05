// Requeue tracks marked not found: node jobs/retryMissingLyrics.js [--apply] [trackId].
import "dotenv/config";
import dns from "node:dns/promises";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Track from "../models/Track.js";
import { findLyrics } from "../services/mood/lyrics.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// LRCLIB is a free service, so don't rush it.
const WAIT_MS = 200;

// Songs with sound data wait as "partial" and show "Lyrics pending". The job picks up "no-data" songs once their lyrics are cleared.
function queueUpdate(track) {
  if (track.analysis?.status === "no-data") {
    return { $set: { lyrics: null } };
  }
  return {
    $set: { lyrics: null, "moods.lyrics": null, "analysis.status": "partial", "analysis.attempts": 0 },
  };
}

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const trackId = args.find((arg) => !arg.startsWith("--"));
  await connectDB();

  const filter = { "lyrics.status": "not-found", ...(trackId ? { _id: trackId } : {}) };
  const tracks = await Track.find(filter, { name: 1, artists: 1, album: 1, durationMs: 1, analysis: 1 }).lean();
  console.log(`[retry-lyrics] ${mongoose.connection.name}: checking ${tracks.length} songs`);

  let queued = 0;
  for (const track of tracks) {
    try {
      const found = await findLyrics({
        name: track.name,
        artists: track.artists,
        album: track.album,
        duration_ms: track.durationMs,
      });
      if (found) {
        console.log(`[retry-lyrics] ${track._id} ${track.name}: ${found.instrumental ? "instrumental" : "lyrics"}`);
        if (apply) {
          await Track.updateOne({ _id: track._id }, queueUpdate(track));
        }
        queued += 1;
      }
    } catch (error) {
      console.warn(`[retry-lyrics] ${track._id} ${track.name}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  }
  console.log(`[retry-lyrics] ${queued} songs ${apply ? "queued" : "would be queued (add --apply)"}`);
}

try {
  await run();
} catch (error) {
  console.error("[retry-lyrics] Failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
