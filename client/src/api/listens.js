import { api } from './http'
import { hasSpotifySession } from './spotify'
import { useAuthStore } from '@/stores/auth'

// The test account has no Spotify connection, so its listening history comes
// from our database instead. Real users switch over once the sync job fills it.
export function usesStoredHistory() {
  return !hasSpotifySession() && Boolean(useAuthStore().user?.isDemo)
}

// Plays stored in our database, newest first, in the same shape as Spotify's
// recently-played items. `to` is exclusive.
export function getListens({ from, to, limit } = {}) {
  const params = {}
  if (from) params.from = from.toISOString()
  if (to) params.to = to.toISOString()
  if (limit) params.limit = limit
  return api.get('/api/listens', { params })
}
