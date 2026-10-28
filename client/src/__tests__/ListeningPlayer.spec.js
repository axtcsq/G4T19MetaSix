import { afterEach, describe, expect, it, vi } from 'vitest'
import { useListeningRoom } from '../composables/useListeningRoom'

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
  spotifyToken: async () => 'test-token',
  loadSpotifySDK: async () => ({
    Player: class {
      listeners = {}
      constructor() {
        players.push(this)
      }
      addListener(event, callback) {
        this.listeners[event] = callback
      }
      async connect() {
        return true
      }
      disconnect() {}
      async getCurrentState() {
        return null
      }
    },
  }),
}))

afterEach(() => {
  useListeningRoom().disconnect()
  players.length = 0
})

describe('Listening player lifecycle', () => {
  it('ignores errors and state events from a player replaced by reconnect', async () => {
    const room = useListeningRoom()
    await room.initialize()
    const previous = players[0]
    await room.reconnect()
    players[1].listeners.ready({ device_id: 'active-device' })
    previous.listeners.not_ready()
    previous.listeners.authentication_error({ message: 'stale failure' })
    previous.listeners.player_state_changed({ paused: false, position: 99, duration: 100 })
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

  it('stays quiet when nothing was playing', async () => {
    const room = useListeningRoom()
    await room.initialize()
    players[0].listeners.player_state_changed(null)
    expect(room.error.value).toBe('')
  })
})
