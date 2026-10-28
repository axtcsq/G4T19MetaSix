import { api } from './http'

// Stored moods for up to 100 songs, keyed by Spotify track ID. Songs with no
// tag to show are left out.
export function getTrackMoods(ids) {
  return api.get('/api/tracks/moods', { params: { ids: ids.join(',') } })
}
