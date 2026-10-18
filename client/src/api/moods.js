import { request } from './http'

export function getMoods() {
  return request('/api/moods')
}

export function createMood(entry) {
  return request('/api/moods', {
    method: 'POST',
    body: entry,
  })
}
