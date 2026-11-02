/* ------------------------------------------------------------------ */
/*  Lyrics from LRCLIB (https://lrclib.net). Free, no key.             */
/* ------------------------------------------------------------------ */
import { existsSync } from 'node:fs'
import { busyStatus } from './errors.js'

const BASE_URL = 'https://lrclib.net/api'
// LRCLIB asks clients to identify themselves.
const HEADERS = { 'User-Agent': 'MetaFor (SMU WAD2 project, github.com/axtcsq/G4T19MetaSix)' }

// When LRCLIB is busy it answers 503 or 429 with Retry-After (usually 1 second).
const RETRIES = 2
const MAX_WAIT_SECONDS = 10

async function lrclib(path, params) {
  for (let retry = 0; ; retry++) {
    const res = await fetch(`${BASE_URL}${path}?${new URLSearchParams(params)}`, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
    if (res.status === 404) return null
    if (res.ok) return res.json()
    if (busyStatus(res.status) && retry < RETRIES) {
      const seconds = Math.min(Number(res.headers.get('retry-after')) || 1, MAX_WAIT_SECONDS)
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000 * (retry + 1)))
      continue
    }
    const error = new Error(`LRCLIB returned ${res.status}`)
    error.temporary = busyStatus(res.status)
    throw error
  }
}

const toResult = (rec) => (rec ? { instrumental: Boolean(rec.instrumental), text: rec.plainLyrics ?? '' } : null)

/* ------------------------------------------------------------------ */
/*  Optional local copy of LRCLIB's database (lrclib.net/db-dumps),    */
/*  for running the analysis job on a laptop while the live API is     */
/*  overloaded. Set LRCLIB_DB_PATH in .env to the downloaded SQLite    */
/*  file. It's only read; songs it doesn't have go to the live API.    */
/* ------------------------------------------------------------------ */
const DUMP_COLUMNS = {
  tracks: ['name_lower', 'artist_name_lower', 'album_name_lower', 'duration', 'last_lyrics_id'],
  lyrics: ['id', 'plain_lyrics', 'instrumental'],
}

// LRCLIB lowercases names and may strip accents, so both forms are looked up.
function nameForms(text = '') {
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim()
  return [lower, lower.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC')]
}

/** Open a local LRCLIB dump for lyric lookups. */
export async function openLyricsDump(path) {
  // Loaded here so the server and the GitHub job never need node:sqlite.
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(path, { readOnly: true })
  for (const [table, columns] of Object.entries(DUMP_COLUMNS)) {
    const present = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name))
    const missing = columns.filter((column) => !present.has(column))
    if (missing.length) {
      console.warn(`[lyrics] ${path} has no ${table}.${missing.join(', ')}; using the live API`)
      db.close()
      return null
    }
  }

  // Same rules as the live search: lyrics or an instrumental mark, within 10s,
  // preferring the same album and then the closest duration.
  const query = db.prepare(`
    SELECT l.plain_lyrics AS plainLyrics, l.instrumental AS instrumental
    FROM tracks t JOIN lyrics l ON l.id = t.last_lyrics_id
    WHERE t.name_lower IN (?, ?) AND t.artist_name_lower IN (?, ?)
      AND abs(t.duration - ?) <= 10
      AND (l.instrumental OR coalesce(l.plain_lyrics, '') != '')
    ORDER BY t.album_name_lower IN (?, ?) DESC, abs(t.duration - ?)
    LIMIT 1`)

  return (track) => {
    const seconds = (track.duration_ms ?? 0) / 1000
    const row = query.get(
      ...nameForms(track.name),
      ...nameForms(track.artists?.[0]?.name),
      seconds,
      ...nameForms(track.album?.name),
      seconds,
    )
    return toResult(row ?? null)
  }
}

// Opened once per run. Any problem with the file falls back to the live API.
let dump
function localDump() {
  const path = process.env.LRCLIB_DB_PATH?.trim()
  if (!path) return null
  if (dump === undefined) {
    if (existsSync(path)) {
      dump = openLyricsDump(path).catch((error) => {
        console.warn(`[lyrics] Can't read ${path} (${error.message}); using the live API`)
        return null
      })
    } else {
      console.warn(`[lyrics] LRCLIB_DB_PATH ${path} not found; using the live API`)
      dump = Promise.resolve(null)
    }
  }
  return dump
}

/** Find lyrics for a Spotify track. */
export async function findLyrics(track) {
  const local = (await localDump())?.(track)
  if (local) return local

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
