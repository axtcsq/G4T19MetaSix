import { api } from './http'

// Fetch stored moods and tracks that still need sound analysis.
export function getTrackMoods(ids) {
  return api.get('/api/tracks/moods', { params: { ids: ids.join(',') } })
}

// Works out the sound mood of up to 10 songs from needsSound (search results,
// or plays the sync only just saved). Answers like getTrackMoods.
export function addSoundMoods(ids) {
  return api.post('/api/tracks/moods/sound', { ids })
}

// Everything the song page shows: the song, how often this user played it,
// and its mood explained. Fails with status 404 for a song we haven't seen.
export function getTrack(id) {
  return api.get(`/api/tracks/${encodeURIComponent(id)}`)
}
