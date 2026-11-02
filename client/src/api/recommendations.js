import { api } from './http'

// Up to four songs for the mood calendar: by artists similar to `artists`
// ([{ name, plays }]), whose sound matches `target` ("happy" or "calm").
// `mix` is { vocal, instrumental }, `exclude` lists track IDs to skip, and a
// higher `page` moves on to other similar artists. Answers { tracks: [...] }.
export function getRecommendations({ target, artists, mix, exclude, page }) {
  return api.post('/api/recommendations', { target, artists, mix, exclude, page })
}
