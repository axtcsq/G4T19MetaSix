import Track from "../../models/Track.js";
import { SCORER_VERSION, scoreLyrics, toChunks } from "./emotion.js";
import { MAX_ATTEMPTS, trackMoods } from "./index.js";
import { findLyrics } from "./lyrics.js";
import { getAudioFeatures, idsForIsrc } from "./reccobeats.js";
import { sameRecordingIds } from "./spotify.js";
import { fetchFeatures } from "./sound.js";
import { isEnglish, translateToEnglish } from "./translate.js";

// Lyric statuses worth another try on a later run.
const TEMPORARY_LYRIC_FAILURES = ["untranslated", "unavailable"];
const HIGHLIGHTS = 2;

export { MAX_ATTEMPTS };

const defaultDeps = {
  getAudioFeatures,
  idsForIsrc,
  sameRecordingIds,
  findLyrics,
  isEnglish,
  translateToEnglish,
  scoreLyrics,
  toChunks,
};

// Only the scores are kept, never the lyrics text. Highlights are capped at two
// short excerpts each way, in the original language.
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
      return toStoredLyrics("untranslated");
    }
    // DeepL couldn't tell the language (often romanised lyrics); retrying won't help.
    if (!translated.from) return toStoredLyrics("untranslatable");
    const scores = await deps.scoreLyrics(found.text, { translations: translated.english });
    return toStoredLyrics("found", scores, translated.from);
  } catch (error) {
    console.warn(`[analyse] ${track._id}: lyrics failed: ${error.message}`);
    return toStoredLyrics("unavailable");
  }
}

// Works out a song's features, lyric scores and both mood readings, without
// touching the database. A retry reuses what an earlier run already stored:
// features never change, and lyrics are only redone after a temporary failure
// or when the scorer changes.
export async function analyseSong(track, deps = defaultDeps) {
  const features = track.features?.valence != null ? track.features : await fetchFeatures(track, deps);
  if (!features) {
    return { status: "no-data" };
  }

  const keepLyrics =
    track.lyrics?.scorerVersion === SCORER_VERSION &&
    !TEMPORARY_LYRIC_FAILURES.includes(track.lyrics.status);
  const lyrics = keepLyrics ? track.lyrics : await analyseLyrics(track, deps);
  const moods = trackMoods(features, lyrics);

  // trackMoods leaves the lyrics reading out only after a temporary lyric failure.
  return { status: moods.lyrics ? "done" : "partial", features, lyrics, moods };
}

// Analyses one stored track and saves the result. Returns the new status, and
// whether its moods changed, so the caller knows which days to rebuild.
export async function analyseTrack(trackId, deps = defaultDeps) {
  const track = await Track.findById(trackId).lean();
  if (!track) {
    throw new Error(`Track ${trackId} not found`);
  }

  const analysis = { "analysis.analysedAt": new Date() };
  try {
    const result = await analyseSong(track, deps);
    const update =
      result.status === "no-data"
        ? { "moods.sound": null, "moods.lyrics": null }
        : { features: result.features, lyrics: result.lyrics, moods: result.moods };

    await Track.updateOne(
      { _id: trackId },
      {
        $set: { ...update, ...analysis, "analysis.status": result.status },
        $inc: { "analysis.attempts": 1 },
        $unset: { "analysis.lastError": "" },
      },
    );
    return { status: result.status, moodsChanged: result.status !== "no-data" };
  } catch (error) {
    // A song that already has its sound reading keeps it (and stays counted);
    // anything else is marked failed and retried until MAX_ATTEMPTS.
    const status = track.moods?.sound ? track.analysis.status : "failed";
    await Track.updateOne(
      { _id: trackId },
      {
        $set: { ...analysis, "analysis.status": status, "analysis.lastError": error.message },
        $inc: { "analysis.attempts": 1 },
      },
    );
    return { status, moodsChanged: false, error };
  }
}
