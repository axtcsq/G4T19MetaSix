/* ------------------------------------------------------------------ */
/*  Mood from valence, energy and danceability.                        */
/*                                                                     */
/*  Valence (sad → happy) and energy (calm → intense) place a song in   */
/*  one of four quadrants of Russell's circumplex model of affect.     */
/*  Danceability then picks the flavour within that quadrant.          */
/*  All values are 0–1, as returned by ReccoBeats' /v1/audio-features. */
/*                                                                     */
/*  "Tense" is decided by how harsh the sound is, not by valence:      */
/*  audio valence is unreliable for heavy music, and plenty of sad     */
/*  songs are loud. Negative songs that aren't harsh are sad.          */
/*                                                                     */
/*  When lyrics are available, their emotion score is blended into     */
/*  valence, and their emotion mix (joy, anger) helps decide tension.  */
/*  If the sound and the words clearly disagree, that clash is the     */
/*  mood.                                                              */
/*                                                                     */
/*  Thresholds were tuned on 89 labelled songs and checked on 67       */
/*  others: 81% land in the right family (sad, happy, calm, angry).    */
/* ------------------------------------------------------------------ */

const MIDPOINT = 0.5
const DANCEABLE = 0.6
// Sad songs with a full band still reach 0.6–0.8 energy. Above this they're anguished, not quiet.
const LOUD = 0.6

// Harsh sound: very energetic and not acoustic. Loudness is left out on purpose,
// since older recordings are mastered quieter.
const HARSH_ENERGY = 0.85
const MAX_ACOUSTIC = 0.15
// Angry or disgusted lyrics over an energetic, non-acoustic, non-danceable track are tense too.
const ANGRY_WORDS = 0.35 // anger + disgust share of the lyrics
const ANGRY_ENERGY = 0.7
// Lyrics with this much joy are never tense: it's what separates "Levitating" from "Bodies".
const JOYFUL = 0.1

// The lyric model reads ordinary lyrics as about 0.25 rather than 0.5, so that point is treated as neutral.
const LYRIC_NEUTRAL = 0.25
// How much the lyrics can move valence at most (0 = ignore, 1 = lyrics only).
const LYRIC_WEIGHT = 0.3
// Below this share of non-neutral emotion, the lyric score is too thin to fully trust.
const MIN_EMOTIONAL_SHARE = 0.4
// Sound and words on opposite sides, each at least this clear, count as a clash.
const CLEAR_SOUND = 0.6 // audio valence ≥ 0.6 or ≤ 0.4
const CLEAR_WORDS = 0.65 // lyric valence ≤ 0.35 or ≥ 0.65

const MOODS = {
  happy: {
    danceable: { name: 'Euphoric', blurb: 'Bright, high-energy and made for moving. Party territory.' },
    still: { name: 'Uplifting', blurb: 'Positive and energetic, but more anthem than dance floor.' },
  },
  calm: {
    danceable: { name: 'Breezy', blurb: 'Warm and relaxed with an easy groove. Sunday-afternoon music.' },
    still: { name: 'Serene', blurb: 'Gentle and content. Good for winding down.' },
  },
  tense: {
    danceable: { name: 'Dark and driving', blurb: 'Intense and moody, with a beat that keeps pushing forward.' },
    still: { name: 'Aggressive', blurb: 'Loud, heavy and unsettled. Anger or tension more than fun.' },
  },
  sad: {
    danceable: { name: 'Bittersweet', blurb: 'Sad underneath, but with a rhythm that keeps it moving. Crying on the dance floor.' },
    loud: { name: 'Cathartic', blurb: 'Sad at heart, but big and loud. Heartache you can shout along to.' },
    still: { name: 'Melancholic', blurb: 'Low, quiet and downcast. Rainy-window music.' },
  },
}

const hasLyrics = (lyrics) => lyrics?.status === 'found' && lyrics.valence != null

/** Harsh sound, or angry words over a heavy track, unless the lyrics are joyful. */
function isTense({ valence, energy, acousticness, danceability }, lyrics) {
  const found = hasLyrics(lyrics)
  if (found && (lyrics.emotions?.joy ?? 0) >= JOYFUL) return false
  if (acousticness > MAX_ACOUSTIC) return false
  // Without lyrics, a harsh track only counts as tense if it also sounds negative. Same for
  // translated lyrics: translation flattens joy, so its absence isn't evidence of anger.
  if (energy >= HARSH_ENERGY) return (found && !lyrics.translatedFrom) || valence < MIDPOINT
  const angry = (lyrics?.emotions?.anger ?? 0) + (lyrics?.emotions?.disgust ?? 0)
  return found && angry >= ANGRY_WORDS && energy >= ANGRY_ENERGY && danceability < DANCEABLE
}

export function quadrantOf(features, lyrics = null) {
  if (isTense(features, lyrics)) return 'tense'
  if (features.valence >= MIDPOINT) return features.energy >= MIDPOINT ? 'happy' : 'calm'
  return 'sad'
}

function variantOf(quadrant, { energy, danceability }) {
  if (danceability >= DANCEABLE) return 'danceable'
  return quadrant === 'sad' && energy >= LOUD ? 'loud' : 'still'
}

// When sound and words pull in opposite directions, averaging hides the point of the
// song, so the clash gets its own mood. `tone` picks the colour.
const CONTRAST_MOODS = {
  'dark-words': {
    tone: 'tense',
    label: 'Upbeat sound, darker words',
    name: 'Deceptively upbeat',
    blurb: 'Bright, catchy music wrapped around dark or troubling lyrics. Easy to sing along to without noticing what it’s about.',
  },
  'hopeful-words': {
    tone: 'calm',
    label: 'Heavy sound, hopeful words',
    name: 'Hope in the dark',
    blurb: 'Sombre or heavy music carrying hopeful, positive words.',
  },
}

/** `features` carries the blended valence; `lyrics` is the server's lyric analysis, if any. */
export function describeMood(features, contrast = null, lyrics = null) {
  const quadrant = quadrantOf(features, lyrics)
  if (contrast) return { quadrant, contrast: true, ...CONTRAST_MOODS[contrast] }
  return { quadrant, tone: quadrant, contrast: false, ...MOODS[quadrant][variantOf(quadrant, features)] }
}

// Lyric failures that a later retry may fix. Until then there is no lyrics reading yet.
const TEMPORARY_LYRIC_FAILURES = ['unavailable', 'untranslated']

/**
 * Both readings of a song, which are stored side by side and never mixed:
 * `sound` uses the audio features alone; `lyrics` blends in the lyric analysis.
 * Without usable lyrics (instrumental, not found, neutral) the two are the same mood.
 * `lyrics` is null while the lyrics failed temporarily; callers fall back to `sound`.
 */
export function readMoods(features, lyrics = null) {
  const blend = blendValence(features, lyrics)
  const sound = describeMood(features)
  if (TEMPORARY_LYRIC_FAILURES.includes(lyrics?.status)) return { sound, lyrics: null, blend }
  return { sound, lyrics: describeMood({ ...features, valence: blend.valence }, blend.contrast, lyrics), blend }
}

export const contrastLabel = (contrast) => CONTRAST_MOODS[contrast]?.label ?? null

// Stretches the lyric score so LYRIC_NEUTRAL lands on 0.5, keeping 0 and 1 in place.
const recentre = (v) =>
  v < LYRIC_NEUTRAL ? (0.5 * v) / LYRIC_NEUTRAL : 0.5 + (0.5 * (v - LYRIC_NEUTRAL)) / (1 - LYRIC_NEUTRAL)

/**
 * Blends audio valence with lyric valence.
 * Found lyrics mean the song has vocals, so the audio's instrumentalness is ignored:
 * it often misreads heavily processed vocals as instrumental.
 * The lyric weight only shrinks when the lyrics are mostly emotionally neutral.
 */
export function blendValence(features, lyrics) {
  const audio = features.valence
  if (!hasLyrics(lyrics)) {
    return { valence: audio, audio, lyrics: null, weight: 0, contrast: null }
  }
  const words = recentre(lyrics.valence)
  const coverage = Math.min(1, lyrics.emotionalShare / MIN_EMOTIONAL_SHARE)
  const weight = LYRIC_WEIGHT * coverage

  // A tense track is already defined by the clash between harsh sound and dark words.
  let contrast = null
  if (coverage >= 0.5 && !isTense(features, lyrics)) {
    // Dark subjects (guns, death, drugs) count even when the emotion score misses them.
    if (audio >= CLEAR_SOUND && (words <= 1 - CLEAR_WORDS || lyrics.darkThemes?.length)) contrast = 'dark-words'
    // "Heavy" sound: a quiet song with kind words is just calm, not a clash.
    else if (audio <= 1 - CLEAR_SOUND && features.energy >= LOUD && words >= CLEAR_WORDS) contrast = 'hopeful-words'
  }
  return { valence: (1 - weight) * audio + weight * words, audio, lyrics: words, weight, contrast }
}

// Short plain-language reading of each feature for the breakdown list.
export const FEATURES = [
  {
    key: 'valence',
    label: 'Valence (sound)',
    low: 'Sad',
    high: 'Happy',
    about: 'How musically positive the track sounds.',
  },
  {
    key: 'energy',
    label: 'Energy',
    low: 'Calm',
    high: 'Intense',
    about: 'Perceived intensity: loudness, speed and noise.',
  },
  {
    key: 'danceability',
    label: 'Danceability',
    low: 'Hard to dance to',
    high: 'Very danceable',
    about: 'How suitable the rhythm is for dancing: tempo, beat strength and regularity.',
  },
]

export function strength(value) {
  if (value >= 0.75) return 'high'
  if (value >= 0.5) return 'fairly high'
  if (value >= 0.25) return 'fairly low'
  return 'low'
}
