/* ------------------------------------------------------------------ */
/*  Lyric translation with DeepL (https://www.deepl.com/pro-api).      */
/*  The emotion model only reads English, so other languages are       */
/*  translated first. English lyrics never reach DeepL, so they cost   */
/*  no quota and score exactly as before.                              */
/* ------------------------------------------------------------------ */

// Free-plan keys end in ":fx" and use a separate host.
const host = (key) => (key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com')
// DeepL takes at most 50 texts per request.
const MAX_TEXTS = 50
// DeepL's established source languages. Its newer long-tail guesses (Wolof, Lombard, Tsonga…)
// mostly appear on romanised lyrics or chants, and the "translation" is then invented.
const TRUSTED = new Set(`AR BG CS DA DE EL EN ES ET FI FR HE HU ID IT JA KO LT LV NB NL PL PT RO RU SK SL SV TH TR UK VI ZH`.split(' '))
// Below this share of trusted text, the song is treated as untranslatable.
const MIN_TRUSTED = 0.5

// Very common English words. English lyrics are 37–62% these; other languages,
// romanised ones included, stay under 15%.
const COMMON = new Set(`the and you i to a me my it in is of that on your we be for all what so this but no just love know
like don't i'm can it's oh not with when do up now out get go want got see one baby yeah are was have will they he she
her his there how if at our from by never time way make let take more back down say been cause 'cause can't won't`.split(/\s+/))
const MIN_COMMON = 0.25
// Below this share of plain a–z words, the lyrics are mostly another script or heavily accented.
const MIN_LATIN = 0.9

export function isEnglish(text) {
  const words = text.toLowerCase().replaceAll('’', "'").match(/\p{L}[\p{L}']*/gu) ?? []
  if (!words.length) return true
  const latin = words.filter((w) => /^[a-z']+$/.test(w)).length
  const common = words.filter((w) => COMMON.has(w)).length
  return latin / words.length >= MIN_LATIN && common / words.length >= MIN_COMMON
}

/**
 * Translates each verse chunk to English (one DeepL text per chunk, so they stay paired).
 * Returns { from, english } where `from` is DeepL's detected language code, e.g. "ES",
 * and `english` maps each chunk to its translation, or to null when DeepL's guess at
 * the language isn't trustworthy. Returns { from: null } when too little of the song
 * is: that won't change, so the caller can cache it.
 * Throws when there's no key or DeepL refuses (quota, bad key), so the caller can
 * fall back to the audio and try again later.
 */
export async function translateToEnglish(chunks) {
  const key = process.env.DEEPL_API_KEY?.trim()
  if (!key) throw new Error('DEEPL_API_KEY is not set')

  // A repeated chorus is only translated (and charged) once.
  const verses = [...new Set(chunks)]
  const out = []
  // Short chunks ("Oh", "Ay") get odd guesses, so every chunk votes, weighted by length.
  const votes = {}
  const languages = []
  for (let i = 0; i < verses.length; i += MAX_TEXTS) {
    const res = await fetch(`${host(key)}/v2/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: verses.slice(i, i + MAX_TEXTS), target_lang: 'EN-US', preserve_formatting: true }),
    })
    // 456 = monthly quota used up, 403 = bad key, 429 = too many requests.
    if (!res.ok) throw new Error(`DeepL returned ${res.status}`)
    const { translations } = await res.json()
    translations.forEach((t, j) => {
      out.push(t.text)
      languages.push(t.detected_source_language)
      votes[t.detected_source_language] = (votes[t.detected_source_language] ?? 0) + verses[i + j].length
    })
  }
  const total = Object.values(votes).reduce((a, n) => a + n, 0)
  const trusted = Object.entries(votes).filter(([l]) => TRUSTED.has(l)).reduce((a, [, n]) => a + n, 0)
  if (!total || trusted / total < MIN_TRUSTED) return { from: null, english: null }

  const from = Object.entries(votes).filter(([l]) => TRUSTED.has(l)).sort((a, b) => b[1] - a[1])[0][0]
  return { from, english: Object.fromEntries(verses.map((v, i) => [v, TRUSTED.has(languages[i]) ? out[i] : null])) }
}
