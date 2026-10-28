// The sound-only half of the analysis: audio features and the sound reading.
// It needs no emotion model, so the web app can run it while someone waits,
// e.g. for songs in search results. The analysis job adds the lyrics later.
import Track from "../../models/Track.js";
import { MOOD_VERSION, trackMoods } from "./index.js";
import { getAudioFeatures, idsForIsrc } from "./reccobeats.js";
import { getTrack, sameRecordingIds } from "./spotify.js";

const defaultDeps = { getTrack, getAudioFeatures, idsForIsrc, sameRecordingIds };

// Audio features for a stored track, trying other IDs for the same recording
// when ReccoBeats doesn't know this one. null when it has none at all.
export async function fetchFeatures(track, deps) {
  try {
    const { id: _id, ...features } = await deps.getAudioFeatures(track._id, {
      fallbacks: [
        () => deps.sameRecordingIds({ id: track._id, isrc: track.isrc }),
        () => deps.idsForIsrc(track.name, track.isrc),
      ],
    });
    return features;
  } catch (error) {
    // ReccoBeats doesn't have the song under any of its IDs.
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

// The tracks fields for a song from Spotify's track object, as sync saves them.
function fromSpotify(track) {
  return {
    name: track.name,
    artists: (track.artists ?? []).map((artist) => ({ id: artist.id, name: artist.name })),
    album: { name: track.album?.name, imageUrl: track.album?.images?.[0]?.url },
    durationMs: track.duration_ms,
    isrc: track.external_ids?.isrc,
  };
}

// Gives one song its sound reading straight away, so its tag doesn't wait
// hours for the analysis job. A song nobody has played yet (a search result) is
// added to tracks first; one the sync saved is filled in. Either way the job
// adds the lyrics reading (or retries ReccoBeats) on its next run. Spotify's
// details are fetched here rather than taken from the browser, since tracks is
// shared by every user.
export async function addSoundMood(trackId, deps = defaultDeps) {
  const stored = await Track.findById(trackId, { name: 1, artists: 1, isrc: 1, features: 1 }).lean();
  if (stored?.features?.valence != null) {
    return;
  }
  const song = stored ?? { _id: trackId, ...fromSpotify(await deps.getTrack(trackId)) };

  let features;
  try {
    features = await fetchFeatures(song, deps);
  } catch {
    // ReccoBeats is down: the job tries again later.
    features = undefined;
  }
  const sound = features && {
    features,
    "moods.sound": trackMoods(features).sound,
    "moods.lyrics": null,
    "moods.version": MOOD_VERSION,
  };

  if (!stored) {
    const fields = { ...song, analysis: { status: "pending", attempts: 0 } };
    if (features) {
      fields.features = features;
      fields.moods = { sound: sound["moods.sound"], lyrics: null, version: MOOD_VERSION };
    } else if (features === null) {
      fields.analysis = { status: "no-data", attempts: 1, analysedAt: new Date() };
    }
    // If the sync saved the song in the meantime, that copy wins.
    await Track.updateOne({ _id: trackId }, { $setOnInsert: fields }, { upsert: true });
  } else if (features) {
    // Only if the job hasn't filled it in meanwhile.
    await Track.updateOne({ _id: trackId, "features.valence": { $exists: false } }, { $set: sound });
  } else if (features === null) {
    await Track.updateOne(
      { _id: trackId, "analysis.status": "pending" },
      { $set: { "analysis.status": "no-data", "analysis.analysedAt": new Date() }, $inc: { "analysis.attempts": 1 } },
    );
  }
}
