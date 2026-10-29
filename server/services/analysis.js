import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { rebuildDailyMoods } from "./dailyMoods.js";
import { trackMoods } from "./mood/index.js";

const RECCOBEATS_URL = "https://api.reccobeats.com/v1/audio-features";
// ReccoBeats answers up to 40 songs per request.
const BATCH_SIZE = 40;
// A song that keeps failing is left alone after this many tries.
const MAX_ATTEMPTS = 3;

const FEATURE_KEYS = [
  "valence",
  "energy",
  "danceability",
  "acousticness",
  "instrumentalness",
  "speechiness",
  "liveness",
  "loudness",
  "tempo",
  "key",
  "mode",
];

// Audio features from ReccoBeats, keyed by Spotify track ID. Songs ReccoBeats
// doesn't know are missing from the result.
export async function fetchFeatures(trackIds) {
  const response = await fetch(`${RECCOBEATS_URL}?ids=${trackIds.join(",")}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`ReccoBeats ${response.status}`);
  }
  const body = await response.json();

  // Results come back in any order, so match them by the Spotify link.
  const features = new Map();
  for (const item of body.content ?? []) {
    const id = item.href?.split("/track/")[1];
    if (id) {
      features.set(
        id,
        Object.fromEntries(FEATURE_KEYS.map((key) => [key, item[key]])),
      );
    }
  }
  return features;
}

// Gives pending songs a mood from their sound. Lyrics aren't read here, so the
// lyrics reading is the same as the sound one, and the song is "partial".
// Pass trackIds to analyse only those songs; omit them to work through the
// oldest pending songs, up to `limit`. Returns how many songs got a mood.
export async function analysePendingTracks({ trackIds, limit = 400 } = {}) {
  const filter = {
    "analysis.status": "pending",
    "analysis.attempts": { $lt: MAX_ATTEMPTS },
  };
  if (trackIds) {
    filter._id = { $in: trackIds };
  }
  const tracks = await Track.find(filter, { _id: 1 }).limit(limit).lean();
  const ids = tracks.map((track) => track._id);

  const analysed = [];
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = ids.slice(start, start + BATCH_SIZE);
    let featuresById;
    try {
      featuresById = await fetchFeatures(batch);
    } catch (error) {
      // Try this batch again on the next run.
      await Track.updateMany(
        { _id: { $in: batch } },
        { $inc: { "analysis.attempts": 1 }, $set: { "analysis.lastError": error.message } },
      );
      continue;
    }

    const analysedAt = new Date();
    await Track.bulkWrite(
      batch.map((id) => {
        const features = featuresById.get(id);
        const update = features
          ? {
              $set: {
                features: { ...features, sourceId: id },
                moods: trackMoods(features),
                "analysis.status": "partial",
                "analysis.analysedAt": analysedAt,
              },
              $inc: { "analysis.attempts": 1 },
            }
          : {
              // ReccoBeats has no sound data for this song.
              $set: { "analysis.status": "no-data", "analysis.analysedAt": analysedAt },
              $inc: { "analysis.attempts": 1 },
            };
        return { updateOne: { filter: { _id: id }, update } };
      }),
      { ordered: false },
    );
    analysed.push(...batch.filter((id) => featuresById.has(id)));
  }

  // The days these songs were played on now have more moods to count.
  if (analysed.length) {
    const days = await Listen.aggregate([
      { $match: { trackId: { $in: analysed } } },
      { $group: { _id: "$userId", dates: { $addToSet: "$localDate" } } },
    ]);
    for (const { _id: userId, dates } of days) {
      await rebuildDailyMoods(userId, dates);
    }
  }

  return analysed.length;
}
