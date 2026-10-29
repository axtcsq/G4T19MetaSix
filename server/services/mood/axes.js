// Maps each music mood onto the daily log's five moods. Each row adds up to 1,
// so every analysed play counts once. Bump AXES_VERSION when the table changes,
// then recompute dailyMoods from the stored moodCounts.
export const AXES_VERSION = 1;

export const AXES = ["happy", "relaxed", "sad", "angry", "anxious"];

const AXES_BY_MOOD = {
  Euphoric: { happy: 1 },
  Uplifting: { happy: 1 },
  Breezy: { relaxed: 1 },
  Serene: { relaxed: 1 },
  Melancholic: { sad: 1 },
  Cathartic: { sad: 1 },
  Bittersweet: { happy: 0.4, sad: 0.6 },
  "Hope in the dark": { happy: 0.5, sad: 0.5 },
  Aggressive: { angry: 1 },
  "Dark and driving": { anxious: 1 },
  "Deceptively upbeat": { anxious: 1 },
};

// Every music mood's name, e.g. for turning dailyMoods' slugs back into names.
export const MOOD_NAMES = Object.keys(AXES_BY_MOOD);

export function axesOf(moodName) {
  return AXES_BY_MOOD[moodName] ?? {};
}

// The journal mood a music mood counts towards most, which picks its colour in
// the client. Ties go to the earlier axis in AXES, so "Hope in the dark" is happy.
export function strongestAxis(moodName) {
  let best = null;
  for (const axis of AXES) {
    const weight = axesOf(moodName)[axis] ?? 0;
    if (weight > 0 && (!best || weight > best.weight)) {
      best = { axis, weight };
    }
  }
  return best?.axis ?? null;
}
