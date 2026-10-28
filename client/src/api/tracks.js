import { api } from './http'

// Stored moods for up to 100 songs, keyed by Spotify track ID. Songs with no
// tag to show are left out; `needsSound` lists the ones with no sound mood yet.
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
