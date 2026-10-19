import { api } from './http'

export function getMoods() {
  return api.get('/api/moods')
}

export function createMood(entry) {
  return api.post('/api/moods', entry)
}
