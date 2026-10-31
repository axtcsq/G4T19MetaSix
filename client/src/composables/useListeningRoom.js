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
const accent = ref('#f0c4a8')
const buttonAccent = ref('hsl(18 45% 24%)')
const ambientColors = ref(['#cd6651', '#998ba1', '#ffd3ac'])
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
  accent.value = next.color || '#f0c4a8'
  buttonAccent.value = 'hsl(18 45% 24%)'
  ambientColors.value = ['#cd6651', '#998ba1', '#ffd3ac']
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => {
    if (track.value.id !== next.id) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 24
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0, 24, 24)
      const pixels = context.getImageData(0, 0, 24, 24).data
      const colors = []
      const average = [0, 0, 0]
      let visiblePixels = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue
        const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]]
        const [red, green, blue] = rgb.map((value) => value / 255)
        const high = Math.max(red, green, blue)
        const low = Math.min(red, green, blue)
        const saturation = high === low ? 0 : (high - low) / high
        const brightness = (red + green + blue) / 3
        for (let channel = 0; channel < 3; channel += 1) average[channel] += rgb[channel]
        visiblePixels += 1
        if (saturation > 0.18 && brightness > 0.12 && brightness < 0.92) {
          colors.push({ rgb, score: saturation * (1 - Math.abs(brightness - 0.52)) })
        }
      }
      if (!visiblePixels) return

      // Use the more vivid parts of the cover rather than a washed-out average.
      colors.sort((first, second) => second.score - first.score)
      const vivid = colors.slice(0, Math.max(1, Math.ceil(colors.length * 0.22)))
      const source = vivid.length ? vivid : [{ rgb: average.map((value) => value / visiblePixels) }]
      const rgb = [0, 1, 2].map((channel) =>
        Math.round(source.reduce((total, entry) => total + entry.rgb[channel], 0) / source.length),
      )
      const palette = []
      for (const color of colors) {
        const distinct = palette.every(
          (chosen) => color.rgb.reduce((distance, value, channel) => distance + Math.abs(value - chosen[channel]), 0) > 90,
        )
        if (distinct) palette.push(color.rgb)
        if (palette.length === 3) break
      }
      if (!palette.length) palette.push(rgb)
      while (palette.length < 3) palette.push(palette[palette.length - 1])
      accent.value = `rgb(${rgb.join(', ')})`
      buttonAccent.value = contrastingButtonColor(rgb)
      ambientColors.value = palette.map((color) => `rgb(${color.join(', ')})`)
    } catch {
      /* A remote cover without CORS keeps the calm fallback palette. */
    }
  }
  image.src = next.album?.images?.[0]?.url || ''
}

// Keep button text white and readable while carrying the album's hue into a
// dark, saturated control color.
function contrastingButtonColor([red, green, blue]) {
  const channels = [red, green, blue].map((value) => value / 255)
  const high = Math.max(...channels)
  const low = Math.min(...channels)
  const delta = high - low
  const lightness = (high + low) / 2
  let hue = 18
  if (delta) {
    if (high === channels[0]) hue = ((channels[1] - channels[2]) / delta) % 6
    else if (high === channels[1]) hue = (channels[2] - channels[0]) / delta + 2
    else hue = (channels[0] - channels[1]) / delta + 4
    hue = (hue * 60 + 360) % 360
  }
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0
  const readableSaturation = saturation < 0.12 ? 0.38 : Math.max(0.52, saturation * 0.9)
  return `hsl(${Math.round(hue)} ${Math.round(readableSaturation * 100)}% 24%)`
}
// Spotify plays on one device at a time. When the same account starts playing
// on a phone or in the Spotify app, this browser stops being the active
// player and its state comes back empty.
const MOVED_AWAY =
  'Spotify moved playback to another device, like your phone or the Spotify app. Press play to bring it back here.'
function applyState(state) {
  if (!state) {
    if (!paused.value && track.value.id) error.value = MOVED_AWAY
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
        event === 'account_error'
          ? 'Spotify Premium is required to listen here.'
          : event === 'playback_error'
            ? `${message || 'Spotify could not play this track.'} If songs skip or stop after a few seconds, try the same song in Spotify Web Player and check your browser allows protected content. Try disabling privacy or ad-blocking extensions for this site, then reconnect the player.`
            : message
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
    const playbackAction = paused.value ? 'play' : 'pause'
    await spotifyRequest(
      `/me/player/${playbackAction}?device_id=${encodeURIComponent(device)}`,
      { method: 'PUT' },
    )
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
    buttonAccent,
    ambientColors,
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
