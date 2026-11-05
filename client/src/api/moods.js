import { api } from './http'

export function getMoods() {
  return api.get('/api/moods')
}

// The daily check-in streak and its streak savers.
export function getStreak() {
  return api.get('/api/moods/streak')
}

export function getMood(id) {
  return api.get(`/api/moods/${encodeURIComponent(id)}`)
}

// Where an entry's photo loads from, for an <img>. Only its owner can see it.
export function moodPhotoUrl(id) {
  return `/api/moods/${encodeURIComponent(id)}/photo`
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
