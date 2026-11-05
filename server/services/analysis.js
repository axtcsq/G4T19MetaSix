import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { rebuildDailyMoods } from "./dailyMoods.js";
import { busyStatus, isTemporary } from "./mood/errors.js";
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

// ReccoBeats audio features by Spotify track ID. Songs it doesn't know just aren't in the result.
export async function fetchFeatures(trackIds) {
  const response = await fetch(`${RECCOBEATS_URL}?ids=${trackIds.join(",")}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = new Error(`ReccoBeats ${response.status}`);
    error.temporary = busyStatus(response.status);
    throw error;
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

// Reuse features from another track with the same ISRC.
async function featuresFromCopies(ids) {
  const songs = await Track.find({ _id: { $in: ids }, isrc: { $ne: null } }, { isrc: 1 }).lean();
  if (!songs.length) {
    return new Map();
  }
  const copies = await Track.find(
    { isrc: { $in: songs.map((song) => song.isrc) }, "features.valence": { $ne: null } },
    { isrc: 1, features: 1 },
  ).lean();
  const byIsrc = new Map(copies.map((copy) => [copy.isrc, copy.features]));
  return new Map(songs.filter((song) => byIsrc.has(song.isrc)).map((song) => [song._id, byIsrc.get(song.isrc)]));
}

// Add sound-only mood data to pending tracks. The background job handles lyrics.
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
      // Try this batch again on the next run. An outage doesn't use up an attempt.
      await Track.updateMany(
        { _id: { $in: batch } },
        {
          $inc: { "analysis.attempts": isTemporary(error) ? 0 : 1 },
          $set: { "analysis.lastError": error.message },
        },
      );
      continue;
    }

    const copies = await featuresFromCopies(batch.filter((id) => !featuresById.has(id)));
    const found = batch.filter((id) => featuresById.has(id) || copies.has(id));
    if (!found.length) {
      continue;
    }

    const analysedAt = new Date();
    await Track.bulkWrite(
      found.map((id) => {
        const features = featuresById.has(id) ? { ...featuresById.get(id), sourceId: id } : copies.get(id);
        const update = {
          $set: {
            features,
            // No lyrics reading until the analysis job gets to it, so the song shows "Lyrics pending" and not "No lyrics".
            moods: { ...trackMoods(features), lyrics: null },
            "analysis.status": "partial",
            "analysis.analysedAt": analysedAt,
          },
          $inc: { "analysis.attempts": 1 },
        };
        return { updateOne: { filter: { _id: id }, update } };
      }),
      { ordered: false },
    );
    analysed.push(...found);
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
