import { api } from './http'

// Spotify songs matching the words, for the search suggestions. Works without a login.
export function searchSongs(query) {
  return api.get('/api/songs/search', { params: { q: query } })
}

// The mood analysis of one song: its sound, its lyrics when we have them, and the mix.
export function getSongAnalysis(id) {
  return api.get(`/api/songs/${id}/analysis`)
}
