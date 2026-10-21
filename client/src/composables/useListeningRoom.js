import { computed, ref } from 'vue'
import {
  authorizeSpotify,
  clearSpotifySession,
  hasSpotifySession,
  loadSpotifySDK,
  playSpotify,
  searchSpotify,
  recentSpotify,
  spotifyRequest,
  spotifyToken,
} from '@/api/spotify'

const emptyTrack = () => ({
  id: '',
  name: 'Choose a song',
  artists: [],
  album: { images: [] },
  duration_ms: 0,
})
const records = ref([])
const history = ref([])
const historyLoading = ref(false)
const historyError = ref('')
let historyVersion = 0
// Module singleton: playback survives Vue route changes.
const track = ref(emptyTrack())
const connected = ref(false)
const ready = ref(false)
const busy = ref(false)
const error = ref('')
const paused = ref(true)
const position = ref(0)
const duration = ref(track.value.duration_ms)
const volume = ref(65)
const accent = ref('#c9d0b5')
const results = ref([])
const searching = ref(false)
const query = ref('')
let player,
  device,
  poll,
  initPromise,
  searchController,
  searchVersion = 0,
  connectVersion = 0

function updateArtwork(next) {
  track.value = next
  if (next.color) {
    accent.value = next.color
    return
  }
  accent.value = '#c9d0b5'
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    if (track.value.id !== next.id) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 12
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0, 12, 12)
      const pixels = context.getImageData(0, 0, 12, 12).data
      const sum = [0, 0, 0]
      for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += pixels[i + c]
      accent.value = `rgb(${sum.map((n) => Math.round((n / 144) * 0.4 + 150)).join(',')})`
    } catch {
      /* A remote cover without CORS keeps the calm fallback palette. */
    }
  }
  image.src = next.album?.images?.[0]?.url || ''
}
function applyState(state) {
  if (!state) {
    paused.value = true
    return
  }
  paused.value = state.paused
  position.value = state.position
  duration.value = state.duration
  const current = state.track_window?.current_track
  if (current && current.id !== track.value.id) updateArtwork(current)
}
async function action(fn) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    return await fn()
  } catch (e) {
    const message = e.message || 'Something interrupted playback. Please try again.'
    if (connected.value && !hasSpotifySession()) disconnect()
    error.value = message
  } finally {
    busy.value = false
  }
}
async function connectPlayer() {
  const version = ++connectVersion
  const Spotify = await loadSpotifySDK()
  if (version !== connectVersion) return
  player?.disconnect()
  clearInterval(poll)
  ready.value = false
  device = null
  player = new Spotify.Player({
    name: 'MetaFor Listening Room',
    volume: volume.value / 100,
    getOAuthToken: (cb) =>
      spotifyToken()
        .then(cb)
        .catch((e) => {
          error.value = e.message
        }),
  })
  for (const event of [
    'initialization_error',
    'authentication_error',
    'account_error',
    'playback_error',
  ]) {
    player.addListener(event, ({ message }) => {
      if (version !== connectVersion) return
      error.value =
        event === 'account_error' ? 'Spotify Premium is required to listen here.' : message
    })
  }
  player.addListener('autoplay_failed', () => {
    if (version !== connectVersion) return
    error.value = 'Your browser paused audio. Press play to start listening.'
  })
  player.addListener('ready', ({ device_id }) => {
    if (version === connectVersion) {
      device = device_id
      ready.value = true
      error.value = ''
    }
  })
  player.addListener('not_ready', () => {
    if (version !== connectVersion) return
    ready.value = false
    device = null
    paused.value = true
  })
  // Replaced players can deliver late events after reconnect or disconnect.
  player.addListener('player_state_changed', (state) => {
    if (version === connectVersion) applyState(state)
  })
  const instance = player
  let timer
  try {
    const success = await Promise.race([
      instance.connect(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'Spotify did not connect. Retry the player and check that your account is allowed in the Spotify app.',
              ),
            ),
          20000,
        )
      }),
    ])
    if (!success) throw new Error('Spotify could not connect. Please retry the player.')
  } catch (e) {
    instance.disconnect()
    throw e
  } finally {
    clearTimeout(timer)
  }
  if (version !== connectVersion) {
    instance.disconnect()
    return
  }
  poll = setInterval(async () => {
    if (document.hidden) return
    try {
      const state = await instance.getCurrentState()
      if (version === connectVersion) applyState(state)
    } catch {
      /* SDK events report connection failures. */
    }
  }, 1000)
}
async function refreshHistory() {
  const version = ++historyVersion
  historyLoading.value = true
  historyError.value = ''
  try {
    const response = await recentSpotify()
    if (version !== historyVersion) return
    history.value = (response?.items || []).filter((item) => item.track?.id && item.track?.uri)
    records.value = [...new Map(history.value.map(({ track }) => [track.id, track])).values()]
  } catch (e) {
    if (version === historyVersion) {
      const message = e.message || 'Listening history could not load. Try again.'
      if (!hasSpotifySession()) disconnect()
      historyError.value = message
    }
  } finally {
    if (version === historyVersion) historyLoading.value = false
  }
}
function initialize() {
  if (!initPromise)
    initPromise = action(async () => {
      connected.value = hasSpotifySession()
      if (connected.value) {
        await refreshHistory()
        if (connected.value && !player) await connectPlayer()
      }
    }).finally(() => {
      initPromise = null
    })
  return initPromise
}
async function selectRecord(record) {
  if (!connected.value) return
  await action(async () => {
    if (!ready.value || !device)
      throw new Error('Reconnect the Spotify player before choosing a song.')
    // activateElement must run inside the user's click, before any network awaits.
    await player.activateElement()
    const chosen = record
    if (!chosen.uri) throw new Error('Choose a song from Spotify search or listening history.')
    if (chosen.is_playable === false) throw new Error('This song is not available in your market.')
    const queue = records.value.filter(
      (item) => item.uri !== chosen.uri && item.is_playable !== false,
    )
    await playSpotify(device, [chosen.uri, ...queue.map((item) => item.uri)].slice(0, 50))
    updateArtwork(chosen)
    duration.value = chosen.duration_ms
    position.value = 0
    // Playing/paused state is confirmed by the SDK, never inferred from a request.
  })
}
async function toggle() {
  if (!connected.value || !track.value.id) return
  await action(async () => {
    if (!ready.value) throw new Error('Reconnect the player to resume listening.')
    await player.activateElement()
    if (paused.value)
      await spotifyRequest(`/me/player/play?device_id=${encodeURIComponent(device)}`, {
        method: 'PUT',
      })
    else await player.pause()
  })
}
async function seek(value) {
  if (!connected.value || !ready.value) return
  await action(async () => {
    await player.seek(Number(value))
    position.value = Number(value)
  })
}
async function changeVolume(value) {
  if (!connected.value || !ready.value) return
  await action(async () => {
    await player.setVolume(Number(value) / 100)
    volume.value = Number(value)
  })
}
async function skip(direction) {
  if (!connected.value || !ready.value) return
  await action(() => (direction > 0 ? player.nextTrack() : player.previousTrack()))
}
async function search() {
  searchController?.abort()
  const version = ++searchVersion
  results.value = []
  searching.value = false
  error.value = ''
  if (!query.value.trim() || !connected.value) return
  searchController = new AbortController()
  searching.value = true
  try {
    const found = await searchSpotify(query.value.trim(), searchController.signal)
    if (version === searchVersion) results.value = found.tracks?.items || []
  } catch (e) {
    if (version === searchVersion && e.name !== 'AbortError') error.value = e.message
  } finally {
    if (version === searchVersion) searching.value = false
  }
}
function cancelSearch() {
  ++searchVersion
  searchController?.abort()
  results.value = []
  searching.value = false
}
function disconnect() {
  ++connectVersion
  ++searchVersion
  searchController?.abort()
  searching.value = false
  clearInterval(poll)
  player?.disconnect()
  player = null
  device = null
  clearSpotifySession()
  connected.value = ready.value = false
  paused.value = true
  position.value = 0
  query.value = ''
  results.value = []
  error.value = ''
  ++historyVersion
  historyLoading.value = false
  historyError.value = ''
  history.value = []
  records.value = []
  updateArtwork(emptyTrack())
  duration.value = track.value.duration_ms
}
export function useListeningRoom() {
  return {
    track,
    connected,
    ready,
    busy,
    error,
    paused,
    position,
    duration,
    volume,
    accent,
    results,
    query,
    searching,
    spinning: computed(() => connected.value && !paused.value),
    records,
    history,
    historyLoading,
    historyError,
    refreshHistory,
    initialize,
    selectRecord,
    toggle,
    seek,
    changeVolume,
    skip,
    search,
    cancelSearch,
    disconnect,
    // Logged-in users are already connected, so this only restarts the room.
    connect: () => (hasSpotifySession() ? initialize() : action(authorizeSpotify)),
    reconnect: () => action(connectPlayer),
  }
}
