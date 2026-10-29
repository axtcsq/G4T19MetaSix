import { api } from './http'
import { spotifyLoginUrl } from './auth'
import { useAuthStore } from '@/stores/auth'

// Spotify access for the browser goes through our server. Logging in to MetaFor
// is the only Spotify login: the server keeps the refresh token and hands out
// short-lived access tokens from /api/spotify/token.
let cached = null
let refreshPromise
let generation = 0

// True when the logged-in user can get a Spotify token. False when logged out,
// for the demo account, and when the user has to log in again.
export function hasSpotifySession() {
  return Boolean(useAuthStore().user?.spotifyLinked)
}

// Forgets the cached access token. It doesn't log out of MetaFor.
export function clearSpotifySession() {
  generation++
  cached = null
}

// Spotify is connected by logging in, so "Connect Spotify" goes to the login.
export async function authorizeSpotify() {
  window.location.assign(spotifyLoginUrl(`${location.pathname}${location.search}`))
}

export async function spotifyToken(force = false) {
  if (!hasSpotifySession()) throw new Error('Log in with Spotify to start listening.')
  if (!force && cached?.expiresAt > Date.now() + 60000) return cached.accessToken
  if (!refreshPromise) {
    const epoch = generation
    refreshPromise = api
      .get('/api/spotify/token')
      .then((token) => {
        if (epoch !== generation) throw new Error('Spotify was disconnected.')
        cached = token
        return token.accessToken
      })
      .catch((failure) => {
        const auth = useAuthStore()
        // 401: the MetaFor session ended. 403: Spotify access has to be granted again.
        if (failure.status === 401) auth.user = null
        else if (failure.status === 403 && auth.user) auth.user.spotifyLinked = false
        throw failure
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function spotifyRequest(path, { method = 'GET', body, signal } = {}, retried = false) {
  const token = await spotifyToken()
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (response.status === 401 && !retried) {
    await spotifyToken(true)
    return spotifyRequest(path, { method, body, signal }, true)
  }
  if (!response.ok) {
    if (response.status === 401) clearSpotifySession()
    const messages = {
      401: 'Spotify sign-in expired. Log in again.',
      403: 'Spotify denied access. Check your Premium subscription and that your account is on the app’s allowed users.',
      404: 'The player is unavailable. Reconnect the player and try again.',
      429: `Spotify needs a short break. Try again in ${response.headers.get('Retry-After') || 'a few'} seconds.`,
    }
    throw new Error(
      messages[response.status] ||
        (response.status >= 500
          ? `Spotify is temporarily unavailable (HTTP ${response.status}). Try again shortly.`
          : `Spotify rejected the request (HTTP ${response.status}). Try logging in again.`),
    )
  }
  if (response.status === 204) return null

  // Spotify normally answers playback commands with 204, but some successful
  // commands return an empty or plain-text 200 response. Don't try to parse
  // those response bodies as JSON.
  const responseBody = await response.text()
  if (!responseBody.trim()) return null
  try {
    return JSON.parse(responseBody)
  } catch {
    if (method !== 'GET') return null
    throw new Error('Spotify returned an unreadable response. Please try again.')
  }
}

export const searchSpotify = (query, signal, offset = 0) => {
  const params = new URLSearchParams({ q: query, type: 'track', limit: '10' })
  if (offset > 0) params.set('offset', String(offset))
  return spotifyRequest(`/search?${params}`, { signal })
}
export const recentSpotify = (signal) =>
  spotifyRequest('/me/player/recently-played?limit=50', { signal })
// Starts at the first song. Shuffle is a setting on the whole Spotify account,
// so without the offset a play request with shuffle on starts on a random song.
export const playSpotify = (device, uris) =>
  spotifyRequest(`/me/player/play?device_id=${encodeURIComponent(device)}`, {
    method: 'PUT',
    body: { uris, offset: { position: 0 } },
  })

let sdkPromise
export function loadSpotifySDK() {
  if (window.Spotify) return Promise.resolve(window.Spotify)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sdkPromise = null
      reject(new Error('Spotify’s player could not load. Check your connection and retry.'))
    }, 15000)
    window.onSpotifyWebPlaybackSDKReady = () => {
      clearTimeout(timer)
      resolve(window.Spotify)
    }
    const existing = document.querySelector('script[data-spotify-sdk]')
    existing?.remove()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.dataset.spotifySdk = 'true'
    script.onerror = () => {
      clearTimeout(timer)
      sdkPromise = null
      script.remove()
      reject(new Error('Spotify’s player could not load. Check your connection and retry.'))
    }
    document.head.append(script)
  })
  return sdkPromise
}
