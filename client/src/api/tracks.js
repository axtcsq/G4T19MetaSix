import { api } from './http'

// Fetch stored moods and tracks that still need sound analysis.
export function getTrackMoods(ids) {
  return api.get('/api/tracks/moods', { params: { ids: ids.join(',') } })
}

// Works out the sound mood of up to 10 songs from needsSound (search results, freshly synced plays). Answers like getTrackMoods.
export function addSoundMoods(ids) {
  return api.post('/api/tracks/moods/sound', { ids })
}

// Everything the song page shows: the song, this user's play count, and its mood explained. 404s for a song we haven't seen.
export function getTrack(id) {
  return api.get(`/api/tracks/${encodeURIComponent(id)}`)
}
