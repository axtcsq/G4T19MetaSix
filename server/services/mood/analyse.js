import Track from "../../models/Track.js";
import { SCORER_VERSION, scoreLyrics, toChunks } from "./emotion.js";
import { MAX_ATTEMPTS, lyricsOnlyMoods, trackMoods } from "./index.js";
import { findLyrics } from "./lyrics.js";
import { getAudioFeatures, idsForIsrc } from "./reccobeats.js";
import { isTemporary } from "./errors.js";
import { sameRecordingIds } from "./spotify.js";
import { fetchFeatures, sameRecording } from "./sound.js";
import { isEnglish, translateToEnglish } from "./translate.js";

// Lyric statuses worth another try on a later run.
const TEMPORARY_LYRIC_FAILURES = ["untranslated", "unavailable"];
const HIGHLIGHTS = 2;

export { MAX_ATTEMPTS };

const defaultDeps = {
  getAudioFeatures,
  idsForIsrc,
  sameRecordingIds,
  sameRecording,
  findLyrics,
  isEnglish,
  translateToEnglish,
  scoreLyrics,
  toChunks,
};

// Only the scores are kept, never the lyrics. Highlights are capped at two short excerpts each way, in the original language.
function toStoredLyrics(status, scores = {}, translatedFrom) {
  const excerpts = (list = []) => list.slice(0, HIGHLIGHTS).map((excerpt) => excerpt.text);
  return {
    status,
    translatedFrom,
    valence: scores.valence,
    emotionalShare: scores.emotionalShare,
    emotions: scores.emotions,
    darkThemes: scores.darkThemes,
    highlights: scores.highlights && {
      positive: excerpts(scores.highlights.positive),
      negative: excerpts(scores.highlights.negative),
    },
    scorerVersion: SCORER_VERSION,
  };
}

// Lyrics are a bonus: if LRCLIB or DeepL fails, the sound reading still works.
async function analyseLyrics(track, deps) {
  try {
    const found = await deps.findLyrics({
      name: track.name,
      artists: track.artists,
      album: track.album,
      duration_ms: track.durationMs,
    });
    if (!found) return toStoredLyrics("not-found");
    if (found.instrumental) return toStoredLyrics("instrumental");
    if (deps.isEnglish(found.text)) return toStoredLyrics("found", await deps.scoreLyrics(found.text));

    // The emotion model only reads English; scoring other languages directly gives noise.
    let translated;
    try {
      const chunks = deps.toChunks(found.text).map((lines) => lines.join("\n"));
      translated = await deps.translateToEnglish(chunks);
    } catch (error) {
      console.warn(`[analyse] ${track._id}: translation failed: ${error.message}`);
      return { ...toStoredLyrics("untranslated"), busy: isTemporary(error) };
    }
    // DeepL couldn't tell the language (often romanised lyrics); retrying won't help.
    if (!translated.from) return toStoredLyrics("untranslatable");
    const scores = await deps.scoreLyrics(found.text, { translations: translated.english });
    return toStoredLyrics("found", scores, translated.from);
  } catch (error) {
    console.warn(`[analyse] ${track._id}: lyrics failed: ${error.message}`);
    // `busy` isn't saved: it tells analyseTrack not to count this attempt.
    return { ...toStoredLyrics("unavailable"), busy: isTemporary(error) };
  }
}

// Lyric scores worth keeping: from the current scorer, and not a temporary failure.
function finalLyrics(lyrics) {
  return lyrics?.scorerVersion === SCORER_VERSION && !TEMPORARY_LYRIC_FAILURES.includes(lyrics.status);
}

// No sound data: read the lyrics once for a rough lyrics-only mood.
async function analyseLyricsOnly(track, deps) {
  let lyrics = track.lyrics;
  let lyricsBusy = false;
  if (lyrics?.scorerVersion !== SCORER_VERSION) {
    ({ busy: lyricsBusy = false, ...lyrics } = await analyseLyrics(track, deps));
  }
  const moods = lyricsOnlyMoods(lyrics);
  return { status: moods ? "done" : "no-data", features: null, lyrics, moods, lyricsBusy };
}

// Analyse a track, reusing saved features and lyrics when possible.
export async function analyseSong(track, deps = defaultDeps) {
  // ReccoBeats already had no sound data; asking again would only spend Spotify searches.
  if (track.analysis?.status === "no-data" && track.features?.valence == null) {
    return analyseLyricsOnly(track, deps);
  }
  const stored = track.features?.valence != null;
  const copy = stored && finalLyrics(track.lyrics) ? null : await deps.sameRecording(track);
  const features = stored ? track.features : (copy?.features ?? (await fetchFeatures(track, deps)));
  if (!features) {
    return analyseLyricsOnly(track, deps);
  }

  let lyrics = track.lyrics;
  let lyricsBusy = false;
  if (finalLyrics(copy?.lyrics) && !finalLyrics(lyrics)) {
    lyrics = copy.lyrics;
  } else if (!finalLyrics(lyrics)) {
    ({ busy: lyricsBusy = false, ...lyrics } = await analyseLyrics(track, deps));
  }
  const moods = trackMoods(features, lyrics);

  // trackMoods only leaves the lyrics reading out after a temporary failure. lyricsBusy means the lyrics site or DeepL was busy, so the retry is free.
  return { status: moods.lyrics ? "done" : "partial", features, lyrics, moods, lyricsBusy };
}

// The steps the job's log times, by dependency. Fallback searches count towards "sound".
const TIMED_STEPS = {
  sameRecording: "copy",
  getAudioFeatures: "sound",
  findLyrics: "lyrics",
  translateToEnglish: "deepl",
  scoreLyrics: "model",
};

// The same dependencies, adding each call's time to `timings` by step.
function timed(deps, timings) {
  const wrapped = { ...deps };
  for (const [name, step] of Object.entries(TIMED_STEPS)) {
    wrapped[name] = async (...args) => {
      const started = performance.now();
      try {
        return await deps[name](...args);
      } finally {
        timings[step] = (timings[step] ?? 0) + performance.now() - started;
      }
    };
  }
  return wrapped;
}

// Analyses one stored track and saves it. Returns the new status and whether its moods changed, so the caller knows which days to rebuild.
export async function analyseTrack(trackId, deps = defaultDeps) {
  const track = await Track.findById(trackId).lean();
  if (!track) {
    throw new Error(`Track ${trackId} not found`);
  }

  const analysis = { "analysis.analysedAt": new Date() };
  const timings = {};
  try {
    const result = await analyseSong(track, timed(deps, timings));
    // Without features, keep the lyric scores so the lyrics are only read once.
    const update = result.features
      ? { features: result.features, lyrics: result.lyrics, moods: result.moods }
      : {
          lyrics: result.lyrics ?? null,
          moods: result.moods ?? { sound: null, lyrics: null, version: track.moods?.version },
        };

    await Track.updateOne(
      { _id: trackId },
      {
        $set: { ...update, ...analysis, "analysis.status": result.status },
        $inc: { "analysis.attempts": result.lyricsBusy ? 0 : 1 },
        $unset: { "analysis.lastError": "" },
      },
    );
    return { status: result.status, moodsChanged: result.status !== "no-data", timings };
  } catch (error) {
    // Temporary service failures do not use up retry attempts.
    const status = track.moods?.sound || track.moods?.lyrics ? track.analysis.status : "failed";
    await Track.updateOne(
      { _id: trackId },
      {
        $set: { ...analysis, "analysis.status": status, "analysis.lastError": error.message },
        $inc: { "analysis.attempts": isTemporary(error) ? 0 : 1 },
      },
    );
    return { status, moodsChanged: false, error, timings };
  }
}
