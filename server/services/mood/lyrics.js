/* ------------------------------------------------------------------ */
/*  Lyrics from LRCLIB (https://lrclib.net). Free, no key.             */
/* ------------------------------------------------------------------ */
const BASE_URL = 'https://lrclib.net/api'
// LRCLIB asks clients to identify themselves.
const HEADERS = { 'User-Agent': 'MetaFor (SMU WAD2 project, github.com/axtcsq/G4T19MetaSix)' }

async function lrclib(path, params) {
  const res = await fetch(`${BASE_URL}${path}?${new URLSearchParams(params)}`, { headers: HEADERS })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`LRCLIB returned ${res.status}`)
  return res.json()
}

const toResult = (rec) => (rec ? { instrumental: Boolean(rec.instrumental), text: rec.plainLyrics ?? '' } : null)

/**
 * Finds lyrics for a Spotify track object.
 * Returns { instrumental, text } or null when nothing matches.
 */
export async function findLyrics(track) {
  const artist = track.artists?.[0]?.name ?? ''
  const seconds = Math.round((track.duration_ms ?? 0) / 1000)

  // Exact match first: LRCLIB matches on name, artist, album and duration (±2s).
  const exact = await lrclib('/get', {
    track_name: track.name,
    artist_name: artist,
    album_name: track.album?.name ?? '',
    duration: seconds,
  })
  if (exact) return toResult(exact)

  // Fallback: fuzzy search, then pick the closest duration. Catches remasters,
  // "feat." credits and album-name mismatches.
  const hits = (await lrclib('/search', { track_name: track.name, artist_name: artist })) ?? []
  const best = hits
    .filter((h) => h.instrumental || h.plainLyrics)
    .map((h) => ({ h, diff: Math.abs((h.duration ?? 0) - seconds) }))
    .filter(({ diff }) => diff <= 10)
    .sort((a, b) => a.diff - b.diff)[0]
  return toResult(best?.h ?? null)
}
