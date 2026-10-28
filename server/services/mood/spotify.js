/* ------------------------------------------------------------------ */
/*  Track details and search for the ISRC fallback. App-only login     */
/*  (client credentials), so it needs no user.                         */
/* ------------------------------------------------------------------ */
import { HttpError } from './errors.js'

const BASE_URL = 'https://api.spotify.com'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

function credentials() {
  const id = process.env.SPOTIFY_CLIENT_ID?.trim()
  const secret = process.env.SPOTIFY_CLIENT_SECRET?.trim()
  if (!id || !secret) {
    throw new HttpError(500, 'SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set.')
  }
  return Buffer.from(`${id}:${secret}`).toString('base64')
}

// App tokens last an hour; reuse one until shortly before it expires.
let token = null
async function accessToken() {
  if (token && Date.now() < token.expiresAt) return token.value
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new HttpError(500, `Spotify login failed: ${body?.error_description ?? body?.error ?? res.status}.`)
  }
  token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 }
  return token.value
}

// JSON request: throws HttpError with the API's own error message on failure.
async function get(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  const res = await fetch(`${BASE_URL}${path}${qs.size ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) token = null // revoked or expired early; fetch a fresh one next time
    throw new HttpError(res.status, body?.error?.message ?? `Spotify API returned ${res.status}.`)
  }
  return body
}

// Spotify caps search at 10 results for development-mode apps; anything higher is a 400.
async function searchTracks(q, { limit = 10, market = 'US' } = {}) {
  const body = await get('/v1/search', { q, type: 'track', limit, market })
  return body?.tracks?.items ?? []
}

/** One track's details. Development-mode apps can't fetch several at once. */
export const getTrack = (id) => get(`/v1/tracks/${encodeURIComponent(id)}`)

/** Other Spotify IDs for the same recording (same ISRC), e.g. the single or a compilation. */
export async function sameRecordingIds({ id, isrc }) {
  if (!isrc) return []
  const hits = await searchTracks(`isrc:${isrc}`)
  return [...new Set(hits.filter((h) => h.external_ids?.isrc === isrc && h.id !== id).map((h) => h.id))]
}
