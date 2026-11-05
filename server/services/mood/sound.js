// Sound-only analysis runs immediately; lyric analysis runs in the background.
import Track from "../../models/Track.js";
import { MOOD_VERSION, trackMoods } from "./index.js";
import { getAudioFeatures, idsForIsrc } from "./reccobeats.js";
import { getTrack, sameRecordingIds } from "./spotify.js";

const defaultDeps = { getTrack, getAudioFeatures, idsForIsrc, sameRecordingIds, sameRecording };

// Another stored copy of the same recording (same ISRC) that already has its features, e.g. the album and deluxe editions of a song. null when there's none.
export function sameRecording(track) {
  if (!track.isrc) {
    return null;
  }
  return Track.findOne(
    { _id: { $ne: track._id }, isrc: track.isrc, "features.valence": { $ne: null } },
    { features: 1, lyrics: 1 },
  ).lean();
}

// Fetch audio features, trying matching recording IDs as fallbacks.
export async function fetchFeatures(track, deps) {
  try {
    const { id: _id, ...features } = await deps.getAudioFeatures(track._id, {
      fallbacks: [
        () => deps.idsForIsrc(track.name, track.isrc),
        () => deps.sameRecordingIds({ id: track._id, isrc: track.isrc }),
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
export function fromSpotify(track) {
  return {
    name: track.name,
    artists: (track.artists ?? []).map((artist) => ({ id: artist.id, name: artist.name })),
    album: { name: track.album?.name, imageUrl: track.album?.images?.[0]?.url },
    durationMs: track.duration_ms,
    isrc: track.external_ids?.isrc,
  };
}

// Add a sound-based mood immediately; the background job handles lyrics.
export async function addSoundMood(trackId, deps = defaultDeps) {
  const stored = await Track.findById(trackId, { name: 1, artists: 1, isrc: 1, features: 1 }).lean();
  if (stored?.features?.valence != null) {
    return;
  }
  const song = stored ?? { _id: trackId, ...fromSpotify(await deps.getTrack(trackId)) };

  let features;
  try {
    features = (await deps.sameRecording(song))?.features ?? (await fetchFeatures(song, deps));
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
