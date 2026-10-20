// Browser-only Authorization Code + PKCE. No client secret belongs in this app.
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${location.origin}/dashboard`
const SESSION = 'metafor.spotify.session'
const FLOW = 'metafor.spotify.flow'
export const spotifyConfigured = Boolean(CLIENT_ID)
let refreshPromise
let generation = 0

function read(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}
export function hasSpotifySession() {
  return Boolean(read(SESSION)?.refresh_token)
}
export function clearSpotifySession() {
  generation++
  sessionStorage.removeItem(SESSION)
  sessionStorage.removeItem(FLOW)
}
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(48)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('')

export async function authorizeSpotify() {
  if (!CLIENT_ID)
    throw new Error('Spotify is not configured yet. Follow the setup instructions below.')
  const verifier = random()
  const state = random()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  sessionStorage.setItem(FLOW, JSON.stringify({ verifier, state, created: Date.now() }))
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope:
      'streaming user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-recently-played',
  })
  location.assign(`https://accounts.spotify.com/authorize?${params}`)
}

async function exchange(body) {
  const epoch = generation
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...body }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) clearSpotifySession()
    throw new Error('Spotify sign-in expired. Connect Spotify again.')
  }
  const token = await response.json()
  if (epoch !== generation) throw new Error('Spotify was disconnected.')
  const saved = {
    ...token,
    refresh_token: token.refresh_token || read(SESSION)?.refresh_token,
    expires: Date.now() + token.expires_in * 1000,
  }
  sessionStorage.setItem(SESSION, JSON.stringify(saved))
  return saved.access_token
}

export async function finishSpotifyCallback() {
  const params = new URLSearchParams(location.search)
  if (!params.has('code') && !params.has('error')) return
  const flow = read(FLOW)
  const code = params.get('code')
  const denied = params.has('error')
  const valid = flow && params.get('state') === flow.state && Date.now() - flow.created < 600000
  for (const key of ['code', 'state', 'error', 'error_description']) params.delete(key)
  history.replaceState(
    null,
    '',
    `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`,
  )
  sessionStorage.removeItem(FLOW)
  if (!valid) throw new Error('Spotify sign-in could not be verified. Please connect again.')
  if (denied || !code)
    throw new Error('Spotify access was not granted. You can connect again when you are ready.')
  await exchange({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT,
    code_verifier: flow.verifier,
  })
}

export async function spotifyToken(force = false) {
  const saved = read(SESSION)
  if (!saved?.refresh_token) throw new Error('Connect Spotify to start listening.')
  if (!force && saved.expires > Date.now() + 60000) return saved.access_token
  if (!refreshPromise)
    refreshPromise = exchange({
      grant_type: 'refresh_token',
      refresh_token: saved.refresh_token,
    }).finally(() => {
      refreshPromise = null
    })
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
      401: 'Spotify sign-in expired. Connect Spotify again.',
      403: 'Spotify denied access. Reconnect to grant listening-history access and check your Premium subscription and the app’s allowed users.',
      404: 'The player is unavailable. Reconnect the player and try again.',
      429: `Spotify needs a short break. Try again in ${response.headers.get('Retry-After') || 'a few'} seconds.`,
    }
    throw new Error(
      messages[response.status] ||
        (response.status >= 500
          ? `Spotify is temporarily unavailable (HTTP ${response.status}). Try again shortly.`
          : `Spotify rejected the request (HTTP ${response.status}). Try reconnecting your account.`),
    )
  }
  return response.status === 204 ? null : response.json()
}

export const searchSpotify = (query, signal) =>
  spotifyRequest(`/search?${new URLSearchParams({ q: query, type: 'track', limit: '10' })}`, {
    signal,
  })
export const recentSpotify = (signal) =>
  spotifyRequest('/me/player/recently-played?limit=50', { signal })
export const playSpotify = (device, uris) =>
  spotifyRequest(`/me/player/play?device_id=${encodeURIComponent(device)}`, {
    method: 'PUT',
    body: { uris },
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
