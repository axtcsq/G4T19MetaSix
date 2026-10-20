import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpotifyHistory } from '../composables/useSpotifyHistory'
import { hasSpotifySession, recentSpotify } from '../api/spotify'

vi.mock('../api/spotify', () => ({
  authorizeSpotify: vi.fn(),
  clearSpotifySession: vi.fn(),
  finishSpotifyCallback: vi.fn(),
  hasSpotifySession: vi.fn(),
  recentSpotify: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  hasSpotifySession.mockReturnValue(true)
})

describe('Dashboard Spotify history', () => {
  it('discards a pending response after disconnect', async () => {
    let finishRequest
    recentSpotify.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve
      }),
    )
    const spotify = useSpotifyHistory()
    const loading = spotify.initialize()
    await vi.waitFor(() => expect(recentSpotify).toHaveBeenCalled())
    spotify.disconnect()
    finishRequest({ items: [{ track: { id: 'private-track' } }] })
    await loading
    expect(spotify.history.value).toEqual([])
    expect(spotify.connected.value).toBe(false)
    expect(spotify.historyLoading.value).toBe(false)
  })

  it('keeps history errors separate from sign-in and allows retry', async () => {
    recentSpotify.mockRejectedValueOnce(new Error('History is unavailable'))
    const spotify = useSpotifyHistory()
    await spotify.initialize()
    expect(spotify.historyError.value).toBe('History is unavailable')
    expect(spotify.connected.value).toBe(true)
    recentSpotify.mockResolvedValueOnce({ items: [{ track: { id: 'song' } }] })
    await spotify.refreshHistory()
    expect(spotify.history.value).toHaveLength(1)
    expect(spotify.historyError.value).toBe('')
  })
})
