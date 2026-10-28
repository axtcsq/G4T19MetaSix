/* ------------------------------------------------------------------ */
/*  Audio features from ReccoBeats (https://reccobeats.com). Free, no  */
/*  key. Same 0–1 values as Spotify's retired audio-features endpoint. */
/* ------------------------------------------------------------------ */
import { HttpError } from './errors.js'

const BASE_URL = 'https://api.reccobeats.com/v1'

/** Features for whichever of these Spotify IDs ReccoBeats knows, in the order given. */
async function lookup(ids) {
  if (!ids.length) return []
  const res = await fetch(`${BASE_URL}/audio-features?${new URLSearchParams({ ids: ids.join(',') })}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new HttpError(502, `ReccoBeats returned ${res.status}.`)

  // Unknown IDs are left out rather than reported, and `id` is ReccoBeats' own,
  // so match on the Spotify URL instead.
  return ids.map((id) => body?.content?.find((f) => f.href?.endsWith(`/track/${id}`))).filter(Boolean)
}

// ReccoBeats search matches titles only (adding the artist finds nothing) and stops at 200 results.
const SEARCH_PAGE = 50
const SEARCH_PAGES = 4

/**
 * Spotify IDs that ReccoBeats files under this ISRC, found by searching its catalogue
 * for the title. Catches releases Spotify's own search doesn't return.
 */
export async function idsForIsrc(title, isrc) {
  if (!title || !isrc) return []
  for (let page = 0; page < SEARCH_PAGES; page++) {
    const params = new URLSearchParams({ searchText: title, page, size: SEARCH_PAGE })
    const res = await fetch(`${BASE_URL}/track/search?${params}`)
    if (!res.ok) throw new HttpError(502, `ReccoBeats returned ${res.status}.`)
    const body = await res.json()
    const ids = (body.content ?? []).filter((t) => t.isrc === isrc).map((t) => t.href?.split('/').pop())
    if (ids.length) return ids.filter(Boolean)
    if (page + 1 >= (body.totalPages ?? 0)) break
  }
  return []
}

/**
 * Audio features for a Spotify track ID:
 * { id, sourceId, valence, energy, danceability, acousticness, instrumentalness,
 *   liveness, speechiness, loudness, tempo, key, mode }
 * `sourceId` is the Spotify ID ReccoBeats matched, which differs from `id` when a
 * fallback found the recording.
 *
 * Spotify lists one recording under several IDs (album, single, compilation) and
 * ReccoBeats often knows only one of them. Each of `fallbacks` returns other IDs for
 * the same recording; they are tried in order, only while nothing has matched.
 */
export async function getAudioFeatures(id, { fallbacks = [] } = {}) {
  let [match] = await lookup([id])
  for (const otherIds of fallbacks) {
    if (match) break
    ;[match] = await lookup(await otherIds())
  }
  if (!match) throw new HttpError(404, 'No audio features found for this track.')
  const { id: _reccoId, href, isrc: _isrc, ...features } = match
  return { id, sourceId: href.split('/').pop(), ...features }
}
