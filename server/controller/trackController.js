import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { strongestAxis } from "../services/mood/axes.js";
import { MAX_ATTEMPTS } from "../services/mood/index.js";
import { FEATURES, contrastLabel, readMoods, strength } from "../services/mood/mood.js";
import { addSoundMood } from "../services/mood/sound.js";

const MAX_IDS = 100;
// Sound moods for new songs, per request and per user per window.
const MAX_NEW_SONGS = 10;
const NEW_SONG_LIMIT = 100;
const NEW_SONG_WINDOW_MS = 10 * 60 * 1000;
// Answer with whatever is ready by then; Vercel stops a request soon after.
const NEW_SONG_DEADLINE_MS = 8000;
const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/;
const STILL_ANALYSING = ["pending", "failed"];
const LIKELY_INSTRUMENTAL = 0.5;

// Explain why lyrics were not included in a track's mood.
function lyricsNote(track, useLyrics) {
  if (!useLyrics) return null;
  // Don't label confirmed or audio-classified instrumental tracks as waiting for lyrics. ReccoBeats uses the same 0–1 instrumentalness scale as Spotify.
  if (
    ["not-found", "instrumental"].includes(track.lyrics?.status) ||
    track.features?.instrumentalness >= LIKELY_INSTRUMENTAL
  ) return null;
  if (!track.moods.lyrics) {
    const outOfRetries = track.analysis?.status === "partial" && (track.analysis.attempts ?? 0) >= MAX_ATTEMPTS;
    return outOfRetries ? "unavailable" : "pending";
  }
  // The same test mood.js uses to blend the lyrics in.
  const used = track.lyrics?.status === "found" && track.lyrics.valence != null;
  return used ? null : "none";
}

function reading(mood) {
  return mood ? { name: mood.name, axis: strongestAxis(mood.name) } : null;
}

// Return stored mood data or its current analysis status.
export function toMoods(track, useLyrics) {
  const { status, attempts = 0 } = track.analysis ?? {};
  // No sound data: a rough mood from the lyrics alone, shown only when lyrics are on.
  if (!track.moods?.sound && track.moods?.lyrics?.lyricsOnly) {
    if (!useLyrics) return { noMood: "no-data" };
    return {
      sound: null,
      lyrics: reading(track.moods.lyrics),
      lyricsLanguage: track.lyrics?.translatedFrom || "EN",
      lyricsNote: "lyrics-only",
    };
  }
  if (track.moods?.sound) {
    return {
      sound: reading(track.moods.sound),
      lyrics: useLyrics ? reading(track.moods.lyrics) : null,
      lyricsLanguage: useLyrics && track.lyrics?.status === "found"
        ? track.lyrics.translatedFrom || "EN"
        : null,
      lyricsNote: lyricsNote(track, useLyrics),
      ...(Number.isFinite(track.features?.tempo) && track.features.tempo > 0
        ? { tempo: track.features.tempo }
        : {}),
    };
  }
  if (STILL_ANALYSING.includes(status) && attempts < MAX_ATTEMPTS) {
    return { analysing: true };
  }
  if (status === "no-data" || status === "failed") {
    return { noMood: status };
  }
  return null;
}

const TAG_FIELDS = {
  "features.tempo": 1,
  "features.instrumentalness": 1,
  "moods.sound": 1,
  "moods.lyrics": 1,
  "lyrics.status": 1,
  "lyrics.translatedFrom": 1,
  "lyrics.valence": 1,
  "analysis.status": 1,
  "analysis.attempts": 1,
};

// The tags of these stored tracks, keyed by track ID.
async function tagsFor(ids, user) {
  const tracks = await Track.find({ _id: { $in: ids } }, TAG_FIELDS).lean();
  const useLyrics = user.preferences?.moodLens !== "sound";
  const moods = {};
  for (const track of tracks) {
    const tag = toMoods(track, useLyrics);
    if (tag) {
      moods[track._id] = tag;
    }
  }
  // Stored songs still waiting for their first reading, and unstored ones.
  const waiting = new Set(tracks.filter((track) => moods[track._id]?.analysing).map((track) => track._id));
  const stored = new Set(tracks.map((track) => track._id));
  const needsSound = ids.filter((id) => SPOTIFY_ID.test(id) && (waiting.has(id) || !stored.has(id)));
  return { moods, needsSound };
}

// GET /api/tracks/moods?ids=<id>,<id>: return moods and tracks needing analysis.
export async function getTrackMoods(req, res) {
  const ids = [...new Set(String(req.query.ids ?? "").split(",").map((id) => id.trim()).filter(Boolean))];
  if (!ids.length || ids.length > MAX_IDS) {
    return res.status(400).json({ error: `ids must list 1 to ${MAX_IDS} track IDs` });
  }

  const { moods, needsSound } = await tagsFor(ids, req.user);
  res.json({ moods, needsSound });
}

// Counts new songs per login, so one user can't send ReccoBeats and Spotify thousands of requests. Returns how many more are allowed right now.
function newSongAllowance(session, now = Date.now()) {
  const window = session.newSongs;
  if (!window || now - window.startedAt > NEW_SONG_WINDOW_MS) {
    session.newSongs = { startedAt: now, count: 0 };
  }
  return NEW_SONG_LIMIT - session.newSongs.count;
}

// POST /api/tracks/moods/sound: analyse up to 10 tracks and return their moods.
export async function addSoundMoods(req, res) {
  const ids = [...new Set(Array.isArray(req.body?.ids) ? req.body.ids : [])];
  if (!ids.length || ids.length > MAX_NEW_SONGS || !ids.every((id) => SPOTIFY_ID.test(id))) {
    return res.status(400).json({ error: `ids must list 1 to ${MAX_NEW_SONGS} Spotify track IDs` });
  }

  const { needsSound } = await tagsFor(ids, req.user);
  const allowed = newSongAllowance(req.session);
  const fresh = needsSound.slice(0, Math.max(allowed, 0));
  req.session.newSongs.count += fresh.length;

  const work = Promise.all(
    fresh.map(async (id) => {
      try {
        await addSoundMood(id);
      } catch (error) {
        // Spotify doesn't know the ID, or is down: no tag for now.
        console.warn(`[tracks] ${id}: sound mood failed: ${error.message}`);
      }
    }),
  );
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, NEW_SONG_DEADLINE_MS))]);

  // Songs that were already stored, or saved in time, answer from the database.
  const { moods } = await tagsFor(ids, req.user);
  res.json({ moods });
}

// One reading for the song page: its name, description and journal mood.
function describe(mood) {
  return { name: mood.name, blurb: mood.blurb, axis: strongestAxis(mood.name) };
}

const MAX_EMOTIONS = 3;
const MIN_EMOTION = 0.05;

// Build the song page's mood explanation from stored analysis.
export function explainTrack(track, useLyrics) {
  const tag = toMoods(track, useLyrics);
  const explained = { tag, lyricsOff: !useLyrics };
  const features = track.features;
  if (features?.valence == null) {
    // No sound data, but the lyrics gave a rough mood.
    if (tag?.lyricsNote === "lyrics-only") explained.lyricsOnly = tag.lyrics;
    return explained;
  }

  const lyrics = useLyrics ? track.lyrics : null;
  explained.lyricsStatus = lyrics?.status ?? null;
  explained.instrumental = Boolean(
    lyrics?.status === "instrumental" || features.instrumentalness >= LIKELY_INSTRUMENTAL,
  );
  const { sound, lyrics: withLyrics, blend } = readMoods(features, lyrics);
  // Lyrics not read yet (or failed every retry): there is no lyrics reading.
  const lyricsRead = Boolean(lyrics) && !["pending", "unavailable"].includes(tag?.lyricsNote);

  explained.sound = describe(sound);
  explained.withLyrics = lyricsRead && withLyrics ? describe(withLyrics) : null;
  explained.features = FEATURES.map((feature) => ({
    ...feature,
    value: features[feature.key],
    strength: strength(features[feature.key]),
  }));
  explained.energy = features.energy;
  explained.blend = lyricsRead
    ? { ...blend, contrastLabel: contrastLabel(blend.contrast) }
    : { valence: blend.audio, audio: blend.audio, lyrics: null, weight: 0, contrast: null, contrastLabel: null };

  if (lyricsRead) {
    explained.lyrics = {
      status: lyrics.status,
      translatedFrom: lyrics.translatedFrom ?? null,
      emotionalShare: lyrics.emotionalShare ?? null,
      // The strongest feelings in the words, e.g. [["anger", 0.41], ["fear", 0.18]].
      emotions: Object.entries(lyrics.emotions ?? {})
        .filter(([emotion, share]) => emotion !== "neutral" && share >= MIN_EMOTION)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_EMOTIONS),
      darkThemes: lyrics.darkThemes ?? [],
      highlights: { positive: lyrics.highlights?.positive ?? [], negative: lyrics.highlights?.negative ?? [] },
    };
  }
  return explained;
}

// GET /api/tracks/:id: return track details, play count, and mood analysis.
export async function getTrackDetail(req, res) {
  const { id } = req.params;
  if (!SPOTIFY_ID.test(id)) {
    return res.status(400).json({ error: "That isn't a Spotify track ID" });
  }
  const track = await Track.findById(id).lean();
  if (!track) {
    return res.status(404).json({ error: "We haven't seen this song yet" });
  }

  const [plays, lastPlay] = await Promise.all([
    Listen.countDocuments({ userId: req.user._id, trackId: id }),
    Listen.findOne({ userId: req.user._id, trackId: id }, { playedAt: 1 }).sort({ playedAt: -1 }).lean(),
  ]);
  const useLyrics = req.user.preferences?.moodLens !== "sound";

  res.json({
    id,
    name: track.name,
    artists: (track.artists ?? []).map((artist) => artist.name),
    album: { name: track.album?.name ?? null, imageUrl: track.album?.imageUrl ?? null },
    spotifyUrl: `https://open.spotify.com/track/${id}`,
    plays,
    lastPlayedAt: lastPlay?.playedAt ?? null,
    ...explainTrack(track, useLyrics),
  });
}

