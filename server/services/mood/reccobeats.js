/* ------------------------------------------------------------------ */
/* Audio features from ReccoBeats (https://reccobeats.com). Free, no */
/* key. Same 0–1 values as Spotify's retired audio-features endpoint. */
/* ------------------------------------------------------------------ */
import { HttpError, busyStatus } from './errors.js'

const BASE_URL = 'https://api.reccobeats.com/v1'

function failed(res) {
  const error = new HttpError(502, `ReccoBeats returned ${res.status}.`)
  error.temporary = busyStatus(res.status)
  return error
}

/** Features for whichever of these Spotify IDs ReccoBeats knows, in the order given. */
async function lookup(ids) {
  if (!ids.length) return []
  const res = await fetch(`${BASE_URL}/audio-features?${new URLSearchParams({ ids: ids.join(',') })}`, { signal: AbortSignal.timeout(10000) })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw failed(res)

  // Unknown IDs get left out and `id` is ReccoBeats' own, so match on the Spotify URL instead.
  return ids.map((id) => body?.content?.find((f) => f.href?.endsWith(`/track/${id}`))).filter(Boolean)
}

// ReccoBeats search matches titles only (adding the artist finds nothing) and stops at 200 results.
const SEARCH_PAGE = 50
const SEARCH_PAGES = 4
// Search answers 400 for shorter text, e.g. two-character Japanese titles like "灯火".
const MIN_SEARCH_LENGTH = 3

/** Find ReccoBeats track IDs for an ISRC. */
export async function idsForIsrc(title, isrc) {
  if (!title || !isrc || title.trim().length < MIN_SEARCH_LENGTH) return []
  for (let page = 0; page < SEARCH_PAGES; page++) {
    const params = new URLSearchParams({ searchText: title, page, size: SEARCH_PAGE })
    const res = await fetch(`${BASE_URL}/track/search?${params}`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw failed(res)
    const body = await res.json()
    const ids = (body.content ?? []).filter((t) => t.isrc === isrc).map((t) => t.href?.split('/').pop())
    if (ids.length) return ids.filter(Boolean)
    if (page + 1 >= (body.totalPages ?? 0)) break
  }
  return []
}

/** Fetch audio features, trying alternate IDs when needed. */
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
