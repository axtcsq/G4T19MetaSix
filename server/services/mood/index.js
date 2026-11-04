import { lyricsOnlyMood, readMoods } from "./mood.js";

// Bump when the rules in mood.js change, then recompute both readings from the
// stored features and lyrics.
export const MOOD_VERSION = 1;

// How many times the analysis job tries a song before giving up on it.
export const MAX_ATTEMPTS = 3;

// The tracks.moods shape for a song: two readings that are never mixed.
// moods.lyrics is null while the lyrics have failed temporarily.
export function trackMoods(features, lyrics = null) {
  const { sound, lyrics: withLyrics, blend } = readMoods(features, lyrics);

  return {
    sound: { name: sound.name, family: sound.tone },
    lyrics: withLyrics && {
      name: withLyrics.name,
      family: withLyrics.tone,
      contrast: blend.contrast ?? undefined,
    },
    version: MOOD_VERSION,
  };
}

// The tracks.moods shape for a song with no sound data: a lyrics reading only.
// null when the lyrics can't give a mood either.
export function lyricsOnlyMoods(lyrics) {
  const mood = lyricsOnlyMood(lyrics);
  return mood && {
    sound: null,
    lyrics: { name: mood.name, family: mood.tone, lyricsOnly: true },
    version: MOOD_VERSION,
  };
}

// "Dark and driving" -> "darkAndDriving", the key used in dailyMoods.moodCounts.
export function moodSlug(name) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join("");
}
