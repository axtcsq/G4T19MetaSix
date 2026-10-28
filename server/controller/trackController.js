import Track from "../models/Track.js";
import { strongestAxis } from "../services/mood/axes.js";
import { MAX_ATTEMPTS } from "../services/mood/index.js";

const MAX_IDS = 100;
const STILL_ANALYSING = ["pending", "failed"];

function reading(mood) {
  return mood ? { name: mood.name, axis: strongestAxis(mood.name) } : null;
}

// What the mood tag shows for one track, or null for no tag: the song isn't
// stored, or it can never get a mood (no audio features, or out of retries).
export function toMoods(track, useLyrics) {
  const { status, attempts = 0 } = track.analysis ?? {};
  if (track.moods?.sound) {
    return {
      sound: reading(track.moods.sound),
      lyrics: useLyrics ? reading(track.moods.lyrics) : null,
      // The lyrics failed for now and are retried; false when the user turned them off.
      lyricsPending: useLyrics && !track.moods.lyrics,
    };
  }
  if (STILL_ANALYSING.includes(status) && attempts < MAX_ATTEMPTS) {
    return { analysing: true };
  }
  return null;
}

// GET /api/tracks/moods?ids=<id>,<id>
// The stored moods of up to 100 songs, keyed by Spotify track ID. IDs with no
// tag are left out.
export async function getTrackMoods(req, res) {
  const ids = [...new Set(String(req.query.ids ?? "").split(",").map((id) => id.trim()).filter(Boolean))];
  if (!ids.length || ids.length > MAX_IDS) {
    return res.status(400).json({ error: `ids must list 1 to ${MAX_IDS} track IDs` });
  }

  const tracks = await Track.find(
    { _id: { $in: ids } },
    { "moods.sound": 1, "moods.lyrics": 1, "analysis.status": 1, "analysis.attempts": 1 },
  ).lean();
  const useLyrics = req.user.preferences?.moodLens !== "sound";

  const moods = {};
  for (const track of tracks) {
    const tag = toMoods(track, useLyrics);
    if (tag) {
      moods[track._id] = tag;
    }
  }
  res.json({ moods });
}
