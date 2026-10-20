import { ref } from 'vue'
import {
  authorizeSpotify,
  clearSpotifySession,
  finishSpotifyCallback,
  hasSpotifySession,
  recentSpotify,
} from '@/api/spotify'

// Dashboard history does not need the listening room's player or search state.
export function useSpotifyHistory() {
  const connected = ref(false)
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
      const response = await recentSpotify()
      if (version !== requestVersion) return
      history.value = (response?.items || []).filter((item) => item.track?.id)
    } catch (failure) {
      if (version !== requestVersion) return
      if (!hasSpotifySession()) disconnect()
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
      await finishSpotifyCallback()
      if (version !== requestVersion) return
      connected.value = hasSpotifySession()
      await refreshHistory()
    } catch (failure) {
      if (version === requestVersion) error.value = failure.message
    } finally {
      busy.value = false
    }
  }

  async function connect() {
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
