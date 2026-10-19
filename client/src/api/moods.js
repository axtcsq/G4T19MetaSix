import { api } from './http'

export function getMoods() {
  return api.get('/api/moods')
}

export function getMood(id) {
  return api.get(`/api/moods/${encodeURIComponent(id)}`)
}

export function createMood(entry) {
  return api.post('/api/moods', entry)
}

export function updateMood(id, changes) {
  return api.patch(`/api/moods/${encodeURIComponent(id)}`, changes)
}

export function deleteMood(id) {
  return api.delete(`/api/moods/${encodeURIComponent(id)}`)
}
