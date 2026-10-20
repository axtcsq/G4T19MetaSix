import { readMoods } from "./mood.js";

// Bump when the rules in mood.js change, then recompute both readings from the
// stored features and lyrics.
export const MOOD_VERSION = 1;

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

// "Dark and driving" -> "darkAndDriving", the key used in dailyMoods.moodCounts.
export function moodSlug(name) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join("");
}
