import { api } from './http'
import { useAuthStore } from '@/stores/auth'

// Read saved history for logged-in users.
export function usesStoredHistory() {
  return Boolean(useAuthStore().user)
}

// Sync recent plays before loading history; keep saved history if sync fails.
export async function syncBeforeReading() {
  if (useAuthStore().user?.isDemo) return
  try {
    await api.post('/api/sync', undefined, { timeout: 5000 })
  } catch {
    // The sync job will catch up.
  }
}

// Plays stored in our database, newest first, in the same shape as Spotify's recently-played items. `to` is exclusive.
export function getListens({ from, to, limit } = {}) {
  const params = {}
  if (from) params.from = from.toISOString()
  if (to) params.to = to.toISOString()
  if (limit) params.limit = limit
  return api.get('/api/listens', { params })
}

// The dashboard's mood panels for the days from `from` to `to` ("YYYY-MM-DD", both included): each day's music moods and the lyric emotion profile.
export function getMoodInsights(from, to) {
  return api.get('/api/listens/insights', { params: { from, to } })
}

// The user's mood from their journal and listening together, for the days from `from` to `to` ("YYYY-MM-DD", both included).
export function getOverallMood(from, to) {
  return api.get('/api/listens/overall-mood', { params: { from, to } })
}
