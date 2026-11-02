import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playSpotify, spotifyRequest, spotifyToken } from '../api/spotify'

const { players } = vi.hoisted(() => ({ players: [] }))

vi.mock('../api/spotify', () => ({
  authorizeSpotify: vi.fn(),
  clearSpotifySession: vi.fn(),
  finishSpotifyCallback: vi.fn(),
  hasSpotifySession: () => true,
  recentSpotify: async () => ({ items: [] }),
  playSpotify: vi.fn(),
  searchSpotify: vi.fn(),
  spotifyConfigured: true,
  spotifyRequest: vi.fn(),
  spotifyToken: vi.fn(async () => 'test-token'),
  loadSpotifySDK: async () => ({
    Player: class {
      listeners = {}
      constructor(options) {
        if (players.length) throw new Error('The SDK playback iframe already has a Player owner')
        this.options = options
        players.push(this)
      }
      async activateElement() {}
      addListener(event, callback) {
        this.listeners[event] = callback
      }
      removeListener(event) {
        delete this.listeners[event]
      }
      connect = vi.fn(
        () => new Promise((resolve) => this.options.getOAuthToken(() => resolve(true))),
      )
      disconnect() {}
      previousTrack = vi.fn(async () => {})
      seek = vi.fn(async () => {})
      async getCurrentState() {
        return null
      }
    },
  }),
}))

let useListeningRoom
beforeEach(async () => {
  vi.resetModules()
  const roomModule = await import('../composables/useListeningRoom')
  useListeningRoom = roomModule.useListeningRoom
})

afterEach(() => {
  useListeningRoom().disconnect()
  players.length = 0
  vi.clearAllMocks()
})

describe('Listening player lifecycle', () => {
  it('reuses the player after a failed reconnect instead of replacing its iframe owner', async () => {
    const room = useListeningRoom()
    await room.initialize()
    players[0].listeners.ready({ device_id: 'device' })
    players[0].connect.mockResolvedValueOnce(false)
    await room.reconnect()
    expect(room.error.value).toContain('could not connect')
    await room.connect()
    players[0].listeners.ready({ device_id: 'device' })
    await room.selectRecord({ id: 'song', uri: 'spotify:track:song' })
    expect(players).toHaveLength(1)
    expect(players[0].connect).toHaveBeenCalledTimes(3)
    expect(playSpotify).toHaveBeenCalledOnce()
    expect(room.error.value).toBe('')
  })

  it('reuses the SDK owner and transfers playback after disconnect and connect', async () => {
    const room = useListeningRoom()
    await room.initialize()
    players[0].listeners.ready({ device_id: 'old-device' })
    const song = { id: 'song', uri: 'spotify:track:song', duration_ms: 100 }
    await room.selectRecord(song)
    room.disconnect()
    await room.connect()
    expect(players).toHaveLength(1)
    expect(players[0].connect).toHaveBeenCalledTimes(2)
    players[0].listeners.ready({ device_id: 'new-device' })
    const tokenCallback = vi.fn()
    await players[0].options.getOAuthToken(tokenCallback)
    expect(tokenCallback).toHaveBeenCalledWith('test-token')
    await room.selectRecord(song)
    expect(spotifyRequest).toHaveBeenLastCalledWith('/me/player', {
      method: 'PUT',
      body: { device_ids: ['new-device'], play: false },
    })
    expect(playSpotify).toHaveBeenLastCalledWith('new-device', [song.uri])
    expect(spotifyRequest.mock.invocationCallOrder.at(-1)).toBeLessThan(
      playSpotify.mock.invocationCallOrder.at(-1),
    )
    expect(room.error.value).toBe('')
    expect(room.track.value.id).toBe('song')
  })

  it('retries a reconnected device that is not registered yet', async () => {
    const room = useListeningRoom()
    await room.initialize()
    players[0].listeners.ready({ device_id: 'new-device' })
    spotifyRequest.mockRejectedValueOnce(
      Object.assign(new Error('Device not found'), { status: 404 }),
    )
    await room.selectRecord({ id: 'song', uri: 'spotify:track:song' })
    expect(spotifyRequest).toHaveBeenCalledTimes(2)
    expect(playSpotify).toHaveBeenCalledOnce()
    expect(room.error.value).toBe('')
  })

  it('stops retrying device activation after disconnect', async () => {
    const room = useListeningRoom()
    await room.initialize()
    players[0].listeners.ready({ device_id: 'new-device' })
    spotifyRequest.mockRejectedValueOnce(
      Object.assign(new Error('Device not found'), { status: 404 }),
    )
    const playback = room.selectRecord({ id: 'song', uri: 'spotify:track:song' })
    await vi.waitFor(() => expect(spotifyRequest).toHaveBeenCalledOnce())
    room.disconnect()
    await playback
    expect(spotifyRequest).toHaveBeenCalledOnce()
    expect(playSpotify).not.toHaveBeenCalled()
    expect(room.error.value).toBe('')
  })

  it('does not send playback after disconnect during audio activation', async () => {
    const room = useListeningRoom()
    await room.initialize()
    players[0].listeners.ready({ device_id: 'old-device' })
    const pending = Promise.withResolvers()
    players[0].activateElement = () => pending.promise
    const playback = room.selectRecord({ id: 'song', uri: 'spotify:track:song' })
    room.disconnect()
    pending.resolve()
    await playback
    expect(playSpotify).not.toHaveBeenCalled()
    expect(room.error.value).toBe('')
  })

  it.each(['resolve', 'reject'])(
    'ignores a playback request that finishes after disconnect (%s)',
    async (outcome) => {
      const room = useListeningRoom()
      await room.initialize()
      players[0].listeners.ready({ device_id: 'old-device' })
      const pending = Promise.withResolvers()
      playSpotify.mockReturnValueOnce(pending.promise)
      const playback = room.selectRecord({
        id: 'song',
        uri: 'spotify:track:song',
        duration_ms: 100,
      })
      await vi.waitFor(() => expect(playSpotify).toHaveBeenCalledOnce())
      room.disconnect()
      if (outcome === 'reject')
        pending.reject(new Error('The player is unavailable. Reconnect the player and try again.'))
      else pending.resolve()
      await playback
      expect(room.error.value).toBe('')
      expect(room.track.value.id).toBe('')
      expect(room.duration.value).toBe(0)
      expect(room.busy.value).toBe(false)
      await room.connect()
      expect(players).toHaveLength(1)
      expect(players[0].connect).toHaveBeenCalledTimes(2)
    },
  )

  it('ignores a token failure from the disconnected SDK', async () => {
    const room = useListeningRoom()
    await room.initialize()
    const pending = Promise.withResolvers()
    spotifyToken.mockReturnValueOnce(pending.promise)
    const callback = vi.fn()
    const tokenRequest = players[0].options.getOAuthToken(callback)
    room.disconnect()
    pending.reject(new Error('Spotify was disconnected.'))
    await tokenRequest
    expect(callback).not.toHaveBeenCalled()
    expect(room.error.value).toBe('')
  })

  it('offers playback troubleshooting without treating a track failure as a Premium failure', async () => {
    const room = useListeningRoom()
    await room.initialize()
    players[0].listeners.playback_error({ message: 'Failed to load track.' })
    expect(room.error.value).toContain('Failed to load track.')
    expect(room.error.value).toContain('protected content')
    expect(room.error.value).not.toContain('Premium')
    expect(room.connected.value).toBe(true)
  })

  it('ignores callbacks retained from the previous connection', async () => {
    const room = useListeningRoom()
    await room.initialize()
    const previous = { ...players[0].listeners }
    await room.reconnect()
    expect(players).toHaveLength(1)
    players[0].listeners.ready({ device_id: 'active-device' })
    previous.not_ready()
    previous.authentication_error({ message: 'stale failure' })
    previous.player_state_changed({ paused: false, position: 99, duration: 100 })
    expect(room.ready.value).toBe(true)
    expect(room.error.value).toBe('')
    expect(room.position.value).toBe(0)
  })

  it('does not restore playback state from late events after disconnect', async () => {
    const room = useListeningRoom()
    await room.initialize()
    const player = players[0]
    room.disconnect()
    player.listeners.ready({ device_id: 'old-device' })
    player.listeners.player_state_changed({ paused: false, position: 99, duration: 100 })
    player.listeners.playback_error({ message: 'old error' })
    expect(room.connected.value).toBe(false)
    expect(room.ready.value).toBe(false)
    expect(room.paused.value).toBe(true)
    expect(room.position.value).toBe(0)
    expect(room.error.value).toBe('')
  })

  it('says so when another device takes over playback', async () => {
    const room = useListeningRoom()
    await room.initialize()
    const player = players[0]
    player.listeners.ready({ device_id: 'this-browser' })
    player.listeners.player_state_changed({
      paused: false,
      position: 10,
      duration: 100,
      track_window: { current_track: { id: 'song', name: 'Song', album: { images: [] } } },
    })
    player.listeners.player_state_changed(null)
    expect(room.paused.value).toBe(true)
    expect(room.error.value).toMatch(/another device/)
  })

  it('goes back a song early on and restarts the song after that', async () => {
    const room = useListeningRoom()
    await room.initialize()
    const player = players[0]
    player.listeners.ready({ device_id: 'this-browser' })
    player.listeners.player_state_changed({ paused: false, position: 2000, duration: 100000 })
    await room.skip(-1)
    expect(player.previousTrack).toHaveBeenCalledOnce()
    expect(player.seek).not.toHaveBeenCalled()
    player.listeners.player_state_changed({ paused: false, position: 40000, duration: 100000 })
    await room.skip(-1)
    expect(player.seek).toHaveBeenCalledWith(0)
    expect(player.previousTrack).toHaveBeenCalledOnce()
    expect(room.position.value).toBe(0)
  })

  it('stays quiet when nothing was playing', async () => {
    const room = useListeningRoom()
    await room.initialize()
    players[0].listeners.player_state_changed(null)
    expect(room.error.value).toBe('')
  })
})
