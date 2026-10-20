import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'

// Real HTTP stand-in for Spotify; only the destination host changes. Request
// serialization, timeout signals, status handling and token refresh run for real.
let server, base, api, calls, mode
const transport = globalThis.fetch
beforeAll(async () => {
  server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    calls.push({
      path: req.url,
      method: req.method,
      body,
      authorization: req.headers.authorization,
    })
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/token') {
      res.end(
        JSON.stringify({
          access_token: 'refreshed-access',
          refresh_token: 'rotated-refresh',
          expires_in: 3600,
        }),
      )
    } else if (mode === 'expired' && req.headers.authorization === 'Bearer original-access') {
      res.writeHead(401)
      res.end('{}')
    } else if (mode === 'limited') {
      res.writeHead(429, { 'Retry-After': '12' })
      res.end('{}')
    } else if (mode === 'forbidden') {
      res.writeHead(403)
      res.end('{}')
    } else if (req.url === '/v1/me/player/recently-played?limit=50') {
      res.end(
        JSON.stringify({
          items: [
            {
              played_at: new Date().toISOString(),
              track: {
                id: 'recent',
                uri: 'spotify:track:recent',
                name: 'Recent song',
                artists: [{ id: 'artist', name: 'Artist' }],
                album: { images: [] },
                duration_ms: 180000,
              },
            },
          ],
        }),
      )
    } else if (req.method === 'PUT') {
      res.writeHead(204)
      res.end()
    } else {
      res.end(
        JSON.stringify({
          tracks: {
            items: [
              {
                id: 'song',
                uri: 'spotify:track:song',
                name: 'A song',
                artists: [{ name: 'An artist' }],
                album: { images: [] },
                duration_ms: 180000,
              },
            ],
          },
        }),
      )
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(4905, '127.0.0.1', resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => new Promise((resolve) => server.close(resolve)))
beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'public-test-client')
  calls = []
  mode = 'ok'
  sessionStorage.clear()
  history.replaceState(null, '', '/listen')
  vi.stubGlobal('fetch', (url, init) =>
    transport(`${base}${new URL(url).pathname}${new URL(url).search}`, init),
  )
  api = await import('../api/spotify')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
const session = (expires) =>
  sessionStorage.setItem(
    'metafor.spotify.session',
    JSON.stringify({ access_token: 'original-access', refresh_token: 'refresh', expires }),
  )

describe('Spotify HTTP integration against a local stand-in', () => {
  it('loads authenticated recent history with the explicit 50-play limit', async () => {
    session(Date.now() + 3600000)
    const history = await api.recentSpotify()
    expect(history.items[0].track.uri).toBe('spotify:track:recent')
    expect(calls[0].path).toBe('/v1/me/player/recently-played?limit=50')
    expect(calls[0].authorization).toBe('Bearer original-access')
  })
  it('rejects a mismatched OAuth state before sending credentials and clears the callback', async () => {
    sessionStorage.setItem(
      'metafor.spotify.flow',
      JSON.stringify({ state: 'expected', verifier: 'verifier', created: Date.now() }),
    )
    history.replaceState(null, '', '/listen?code=private-code&state=wrong')
    await expect(api.finishSpotifyCallback()).rejects.toThrow('could not be verified')
    expect(calls).toHaveLength(0)
    expect(location.search).toBe('')
    expect(sessionStorage.getItem('metafor.spotify.flow')).toBeNull()
  })
  it('exchanges a valid code with PKCE and never sends a client secret', async () => {
    sessionStorage.setItem(
      'metafor.spotify.flow',
      JSON.stringify({ state: 'expected', verifier: 'test-verifier', created: Date.now() }),
    )
    history.replaceState(null, '', '/listen?code=private-code&state=expected')
    await api.finishSpotifyCallback()
    const body = new URLSearchParams(calls[0].body)
    expect(body.get('code_verifier')).toBe('test-verifier')
    expect(body.get('client_id')).toBe('public-test-client')
    expect(body.has('client_secret')).toBe(false)
    expect(api.hasSpotifySession()).toBe(true)
    expect(location.search).toBe('')
  })
  it('refreshes once for concurrent requests and searches within the development-mode limit', async () => {
    session(Date.now() - 1)
    await Promise.all([api.searchSpotify('Björk & air'), api.searchSpotify('Laufey')])
    expect(calls.filter((call) => call.path === '/api/token')).toHaveLength(1)
    const searches = calls.filter((call) => call.path.startsWith('/v1/search'))
    expect(searches).toHaveLength(2)
    expect(new URL(searches[0].path, base).searchParams.get('q')).toBe('Björk & air')
    expect(new URL(searches[0].path, base).searchParams.get('limit')).toBe('10')
    expect(searches[0].authorization).toBe('Bearer refreshed-access')
  })
  it('retries a 401 after refreshing and accepts an empty successful playback response', async () => {
    session(Date.now() + 3600000)
    mode = 'expired'
    await expect(api.playSpotify('device id', ['spotify:track:song'])).resolves.toBeNull()
    const play = calls.filter((call) => call.method === 'PUT')
    expect(play).toHaveLength(2)
    expect(play[1].path).toBe('/v1/me/player/play?device_id=device%20id')
    expect(JSON.parse(play[1].body)).toEqual({ uris: ['spotify:track:song'] })
  })
  it('surfaces Premium/allowlist failures and rate-limit retry guidance', async () => {
    session(Date.now() + 3600000)
    mode = 'forbidden'
    await expect(api.searchSpotify('song')).rejects.toThrow('Premium')
    mode = 'limited'
    await expect(api.searchSpotify('song')).rejects.toThrow('12 seconds')
  })
  it('does not refresh a disconnected session', async () => {
    session(Date.now() - 1)
    api.clearSpotifySession()
    await expect(api.searchSpotify('song')).rejects.toThrow('Connect Spotify')
    expect(calls).toHaveLength(0)
  })
})
