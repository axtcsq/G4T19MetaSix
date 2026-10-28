/* ------------------------------------------------------------------ */
/*  Lyric emotion with a local transformer model (Transformers.js).    */
/*  The model (~83 MB) downloads once into server/.models; after that  */
/*  it runs offline with no API and no limits.                         */
/*                                                                     */
/*  Unlike a word list, the model reads a whole verse in context, so   */
/*  "outrun my gun" reads as anger rather than "better" = positive.    */
/* ------------------------------------------------------------------ */
import { env, pipeline } from '@huggingface/transformers'
import { fileURLToPath } from 'node:url'

// Bump when the scoring changes, so cached lyric scores are recomputed.
export const SCORER_VERSION = 'emotion-v6' // v6: adds darkThemes

const MODEL = 'onnx-community/emotion-english-distilroberta-base-ONNX'
env.cacheDir = fileURLToPath(new URL('../../.models/', import.meta.url))

// How positive each of the model's seven emotions is, on the 0–1 valence scale.
const EMOTION_VALENCE = {
  joy: 0.95,
  surprise: 0.6,
  neutral: 0.5,
  sadness: 0.1,
  fear: 0.15,
  anger: 0.1,
  disgust: 0.1,
}
const EMOTIONS = Object.keys(EMOTION_VALENCE)

// Violent or dark subjects (guns, death, drugs) that the emotion model misses: it reads
// "outrun my gun" as mild anger. Used to spot cheerful-sounding songs about dark things.
const DARK_WORDS = new Set(`gun guns bullet bullets shoot shoots shot shooting kill kills killed killer killing
murder murdered dead death die dies died dying blood bloody suicide knife grave funeral meth overdose bomb bombs
corpse coffin cocaine heroin`.split(/\s+/))
// A theme needs at least two different such words, at 1 in 200 words or more, so a lone
// "shooting star" or "killing me softly" doesn't count.
const MIN_DARK_WORDS = 2
const MIN_DARK_RATE = 0.005

/** The dark-theme words in the text, or [] when they don't amount to a theme. */
export function darkThemes(text) {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? []
  const hits = words.filter((w) => DARK_WORDS.has(w))
  const distinct = [...new Set(hits)].sort()
  return distinct.length >= MIN_DARK_WORDS && hits.length / words.length >= MIN_DARK_RATE ? distinct : []
}

// Verses longer than this are split so each chunk stays well within the model's input limit.
const MAX_LINES_PER_CHUNK = 8
const HIGHLIGHTS = 2

let classifier
// Load once, shared by every request. Reset on failure so the next request retries.
function getClassifier() {
  classifier ??= pipeline('text-classification', MODEL, { dtype: 'q8' }).catch((err) => {
    classifier = undefined
    throw err
  })
  return classifier
}

/** Loads the model, rejecting if it can't. The job calls this before analysing anything. */
export const loadModel = getClassifier

// Start loading at boot so the first song doesn't wait for it.
export function warmUp() {
  getClassifier()
    .then(() => console.log('Emotion model ready'))
    .catch((err) => console.warn('Emotion model failed to load:', err.message))
}

/** Splits lyrics into verses (blank-line separated), capping very long ones. */
export function toChunks(text) {
  const chunks = []
  for (const verse of text.split(/\n\s*\n/)) {
    // LRCLIB marks instrumental breaks with "♪"; those aren't lyrics.
    const lines = verse.split('\n').map((l) => l.trim()).filter((l) => l && !/^[♪\s]+$/.test(l))
    for (let i = 0; i < lines.length; i += MAX_LINES_PER_CHUNK) chunks.push(lines.slice(i, i + MAX_LINES_PER_CHUNK))
  }
  return chunks.filter((c) => c.length)
}

/**
 * `translations` maps each verse chunk (lines joined by "\n") to its English, for
 * non-English lyrics. The model reads the English; highlights keep the original.
 * Chunks mapped to null couldn't be translated reliably and are left out.
 */
export async function scoreLyrics(text, { translations = null } = {}) {
  const classify = await getClassifier()

  // Score each distinct verse once, but weight it by its line count and how often it
  // appears: a repeated chorus is emphasis and should count more.
  const verses = new Map()
  for (const lines of toChunks(text)) {
    const key = lines.join('\n')
    const v = verses.get(key) ?? { lines, english: translations?.[key] ?? null, repeats: 0 }
    v.repeats++
    verses.set(key, v)
  }

  const scored = []
  for (const [key, v] of verses) {
    if (translations && v.english == null) continue
    const out = await classify(v.english ?? key, { top_k: null })
    const probs = Object.fromEntries(out.map((o) => [o.label, o.score]))
    const emotional = 1 - (probs.neutral ?? 0)
    // Valence of the non-neutral part only, so mostly-neutral verses don't flatten everything to 0.5.
    const valence =
      emotional > 0
        ? EMOTIONS.filter((e) => e !== 'neutral').reduce((a, e) => a + (probs[e] ?? 0) * EMOTION_VALENCE[e], 0) / emotional
        : 0.5
    scored.push({ ...v, probs, emotional, valence, weight: v.lines.length * v.repeats })
  }

  const totalWeight = scored.reduce((a, s) => a + s.weight, 0)
  if (!totalWeight) return { valence: null, emotionalShare: 0, totalLines: 0, emotions: {}, darkThemes: [], highlights: { positive: [], negative: [] } }

  // Song-level emotion mix, weighted the same way as the verses.
  const emotions = Object.fromEntries(
    EMOTIONS.map((e) => [e, scored.reduce((a, s) => a + (s.probs[e] ?? 0) * s.weight, 0) / totalWeight]),
  )
  const emotionalShare = 1 - emotions.neutral
  // Verses with more emotion count for more in the final valence.
  const emoWeight = scored.reduce((a, s) => a + s.weight * s.emotional, 0)
  const valence = emoWeight > 0 ? scored.reduce((a, s) => a + s.valence * s.weight * s.emotional, 0) / emoWeight : null

  // Opening two lines of the most clearly positive and negative verses, as evidence.
  // Full lyrics are deliberately not sent to the client.
  // Translated chunks keep their line breaks, so the first two lines line up with the original's.
  const excerpt = (s) => ({
    text: s.lines.slice(0, 2).join(' / '),
    ...(s.english && { translation: s.english.split('\n').filter((l) => l.trim()).slice(0, 2).join(' / ') }),
  })
  const clear = scored.filter((s) => s.emotional >= 0.5)
  const byValence = [...clear].sort((a, b) => b.valence - a.valence)

  // Choruses that differ only after their first lines would otherwise show the same excerpt twice.
  const pick = (list) => {
    const seen = new Set()
    return list.map(excerpt).filter((e) => !seen.has(e.text) && seen.add(e.text)).slice(0, HIGHLIGHTS)
  }

  // Themes are read from what the model read (the translation, if any), repeats included.
  const read = scored.flatMap((s) => Array(s.repeats).fill(s.english ?? s.lines.join('\n'))).join('\n')

  return {
    valence,
    emotionalShare,
    darkThemes: darkThemes(read),
    totalLines: scored.reduce((a, s) => a + s.lines.length * s.repeats, 0),
    emotions,
    highlights: {
      positive: pick(byValence.filter((s) => s.valence >= 0.6)),
      negative: pick(byValence.filter((s) => s.valence <= 0.4).reverse()),
    },
  }
}
