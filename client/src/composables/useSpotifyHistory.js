import { ref } from 'vue'
import {
  authorizeSpotify,
  clearSpotifySession,
  hasSpotifySession,
  recentSpotify,
} from '@/api/spotify'
import { getListens, usesStoredHistory } from '@/api/listens'

// The dashboard shows the last 7 days or this month, whichever starts earlier.
function historyStart(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  return weekStart < monthStart ? weekStart : monthStart
}

// Dashboard history does not need the listening room's player or search state.
export function useSpotifyHistory() {
  const connected = ref(false)
  // 'spotify' for Spotify's last 50 plays, 'stored' for plays from our database.
  const source = ref('spotify')
  const busy = ref(false)
  const history = ref([])
  const historyLoading = ref(false)
  const historyError = ref('')
  const error = ref('')
  let requestVersion = 0

  function disconnect() {
    // Ignore pending responses after clearing private account data.
    requestVersion++
    clearSpotifySession()
    connected.value = false
    history.value = []
    historyLoading.value = false
    historyError.value = ''
    error.value = ''
  }

  async function refreshHistory() {
    if (!connected.value) return
    const version = ++requestVersion
    historyLoading.value = true
    historyError.value = ''
    try {
      const response =
        source.value === 'stored'
          ? await getListens({ from: historyStart(), limit: 2000 })
          : await recentSpotify()
      if (version !== requestVersion) return
      history.value = (response?.items || []).filter((item) => item.track?.id)
    } catch (failure) {
      if (version !== requestVersion) return
      if (!hasSpotifySession() && !usesStoredHistory()) disconnect()
      historyError.value = failure.message || 'Listening history could not load. Try again.'
    } finally {
      if (version === requestVersion) historyLoading.value = false
    }
  }

  async function initialize() {
    busy.value = true
    error.value = ''
    const version = requestVersion
    try {
      if (version !== requestVersion) return
      source.value = usesStoredHistory() ? 'stored' : 'spotify'
      connected.value = hasSpotifySession() || source.value === 'stored'
      await refreshHistory()
    } catch (failure) {
      if (version === requestVersion) error.value = failure.message
    } finally {
      busy.value = false
    }
  }

  async function connect() {
    if (hasSpotifySession()) return initialize()
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      await authorizeSpotify()
    } catch (failure) {
      error.value = failure.message
    } finally {
      busy.value = false
    }
  }

  return {
    connected,
    source,
    busy,
    history,
    historyLoading,
    historyError,
    error,
    initialize,
    refreshHistory,
    connect,
    disconnect,
  }
}
