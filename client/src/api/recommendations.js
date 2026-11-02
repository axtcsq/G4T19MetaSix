import { api } from './http'

// Fetch mood-matched songs from similar artists for the calendar.
export function getRecommendations({ target, artists, mix, exclude, page }) {
  return api.post('/api/recommendations', { target, artists, mix, exclude, page })
}
