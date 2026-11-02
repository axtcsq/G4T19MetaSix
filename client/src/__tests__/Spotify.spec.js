import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { createPinia, setActivePinia } from 'pinia'

// Test Spotify request handling with a mocked token endpoint.
const { getToken } = vi.hoisted(() => ({ getToken: vi.fn() }))
vi.mock('../api/http', () => ({ api: { get: getToken, defaults: { baseURL: '' } } }))

let server, base, api, auth, calls, mode, tokens
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
    if (mode === 'expired' && req.headers.authorization === 'Bearer original-access') {
      res.writeHead(401)
      res.end('{}')
    } else if (mode === 'unavailable') {
      res.writeHead(503)
      res.end('{}')
    } else if (mode === 'limited') {
      res.writeHead(429, { 'Retry-After': '12' })
      res.end('{}')
    } else if (mode === 'forbidden') {
      res.writeHead(403)
      res.end('{}')
    } else if (
      mode === 'reconnecting' &&
      req.method === 'PUT' &&
      calls.filter((call) => call.path === req.url && call.method === 'PUT').length === 1
    ) {
      res.writeHead(404)
      res.end(JSON.stringify({ error: { status: 404, message: 'Device not found' } }))
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
  setActivePinia(createPinia())
  calls = []
  mode = 'ok'
  tokens = ['original-access', 'refreshed-access']
  getToken.mockReset()
  getToken.mockImplementation(async (path) => {
    if (path !== '/api/spotify/token') throw new Error(`Unexpected token request: ${path}`)
    return { accessToken: tokens.shift() ?? 'refreshed-access', expiresAt: Date.now() + 3600000 }
  })
  vi.stubGlobal('fetch', (url, init) =>
    transport(`${base}${new URL(url).pathname}${new URL(url).search}`, init),
  )
  api = await import('../api/spotify')
  const { useAuthStore } = await import('../stores/auth')
  auth = useAuthStore()
  auth.user = { id: '1', displayName: 'Listener', spotifyLinked: true }
})
afterEach(() => {
  vi.unstubAllGlobals()
})
const tokenCalls = () => getToken.mock.calls.length

describe('Spotify HTTP integration against a local stand-in', () => {
  it('starts a fresh token request on reconnect and ignores the old session failure', async () => {
    const previous = Promise.withResolvers()
    const current = Promise.withResolvers()
    getToken.mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise)
    const oldToken = api.spotifyToken().catch((failure) => failure)
    api.clearSpotifySession()
    const newToken = api.spotifyToken()
    previous.reject(Object.assign(new Error('Old session expired'), { status: 401 }))
    await oldToken
    const concurrent = api.spotifyToken()
    expect(tokenCalls()).toBe(2)
    expect(api.hasSpotifySession()).toBe(true)
    current.resolve({ accessToken: 'new-access', expiresAt: Date.now() + 3600000 })
    await expect(newToken).resolves.toBe('new-access')
    await expect(concurrent).resolves.toBe('new-access')
    await expect(api.spotifyToken()).resolves.toBe('new-access')
  })

  it('plays again after disconnect, delayed device registration and a playback 404', async () => {
    let nextDevice = 0
    vi.stubGlobal('Spotify', {
      Player: class {
        listeners = {}
        addListener(event, callback) {
          this.listeners[event] = callback
        }
        removeListener(event) {
          delete this.listeners[event]
        }
        async connect() {
          this.listeners.ready({ device_id: `browser-${++nextDevice}` })
          return true
        }
        disconnect() {}
        async activateElement() {}
        async getCurrentState() {
          return null
        }
      },
    })
    const { useListeningRoom } = await import('../composables/useListeningRoom')
    const room = useListeningRoom()
    try {
      await room.initialize()
      const song = room.records.value[0]
      await room.selectRecord(song)
      expect(room.error.value).toBe('')
      room.disconnect()
      calls = []
      mode = 'reconnecting'
      await room.connect()
      await room.selectRecord(song)
      const commands = calls.filter((call) => call.method === 'PUT')
      expect(commands.map((call) => call.path)).toEqual([
        '/v1/me/player',
        '/v1/me/player',
        '/v1/me/player/play?device_id=browser-2',
        '/v1/me/player',
        '/v1/me/player/play?device_id=browser-2',
      ])
      expect(JSON.parse(commands[0].body)).toEqual({ device_ids: ['browser-2'], play: false })
      expect(room.connected.value).toBe(true)
      expect(room.ready.value).toBe(true)
      expect(room.track.value.id).toBe(song.id)
      expect(room.error.value).toBe('')
    } finally {
      room.disconnect()
    }
  })

  it('loads authenticated recent history with the explicit 50-play limit', async () => {
    const history = await api.recentSpotify()
    expect(history.items[0].track.uri).toBe('spotify:track:recent')
    expect(calls[0].path).toBe('/v1/me/player/recently-played?limit=50')
    expect(calls[0].authorization).toBe('Bearer original-access')
  })
  it('gets one token from the server for concurrent requests and reuses it', async () => {
    await Promise.all([api.searchSpotify('Björk & air'), api.searchSpotify('Laufey')])
    await api.searchSpotify('again')
    expect(tokenCalls()).toBe(1)
    const searches = calls.filter((call) => call.path.startsWith('/v1/search'))
    expect(searches).toHaveLength(3)
    expect(new URL(searches[0].path, base).searchParams.get('q')).toBe('Björk & air')
    expect(new URL(searches[0].path, base).searchParams.get('limit')).toBe('10')
    expect(searches[0].authorization).toBe('Bearer original-access')
  })
  it('asks the server for a new token after a 401 and accepts an empty playback response', async () => {
    mode = 'expired'
    await expect(api.playSpotify('device id', ['spotify:track:song'])).resolves.toBeNull()
    const play = calls.filter((call) => call.method === 'PUT')
    expect(play).toHaveLength(2)
    expect(play[1].authorization).toBe('Bearer refreshed-access')
    expect(play[1].path).toBe('/v1/me/player/play?device_id=device%20id')
    expect(JSON.parse(play[1].body)).toEqual({
      uris: ['spotify:track:song'],
      offset: { position: 0 },
      position_ms: 0,
    })
    expect(tokenCalls()).toBe(2)
  })
  it('surfaces Premium/allowlist failures and rate-limit retry guidance', async () => {
    mode = 'forbidden'
    await expect(api.searchSpotify('song')).rejects.toThrow('Premium')
    mode = 'limited'
    await expect(api.searchSpotify('song')).rejects.toThrow('12 seconds')
  })
  it('makes no requests without a linked Spotify login', async () => {
    auth.user = { id: 'demo', displayName: 'Demo', spotifyLinked: false }
    expect(api.hasSpotifySession()).toBe(false)
    await expect(api.searchSpotify('song')).rejects.toThrow('Log in with Spotify')
    expect(tokenCalls()).toBe(0)
    expect(calls).toHaveLength(0)
  })
  it('marks Spotify as unlinked when the server says access must be granted again', async () => {
    getToken.mockRejectedValueOnce(Object.assign(new Error('Log in again'), { status: 403 }))
    await expect(api.recentSpotify()).rejects.toThrow('Log in again')
    expect(auth.user.spotifyLinked).toBe(false)
    expect(api.hasSpotifySession()).toBe(false)
  })
  it('forgets the user when the MetaFor session has ended', async () => {
    getToken.mockRejectedValueOnce(Object.assign(new Error('Not logged in'), { status: 401 }))
    await expect(api.recentSpotify()).rejects.toThrow('Not logged in')
    expect(auth.user).toBeNull()
  })
  it('identifies temporary provider failures with their HTTP status', async () => {
    mode = 'unavailable'
    await expect(api.recentSpotify()).rejects.toThrow('temporarily unavailable (HTTP 503)')
  })
})
