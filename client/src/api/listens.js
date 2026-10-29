import { api } from './http'
import { useAuthStore } from '@/stores/auth'

// Logged-in users read their history from our database, which keeps growing
// past Spotify's latest 50 plays. Logged-out visitors have no history.
export function usesStoredHistory() {
  return Boolean(useAuthStore().user)
}

// Saves the user's newest plays from Spotify before the history is read, so
// the page includes songs played since the last hourly sync. The test account
// has no Spotify, and a failed sync still shows what is already stored.
export async function syncBeforeReading() {
  if (useAuthStore().user?.isDemo) return
  try {
    await api.post('/api/sync')
  } catch {
    // The hourly job will catch up.
  }
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

// The dashboard's mood panels for the days from `from` to `to` ("YYYY-MM-DD",
// both included): each day's music moods and the lyric emotion profile.
export function getMoodInsights(from, to) {
  return api.get('/api/listens/insights', { params: { from, to } })
}
