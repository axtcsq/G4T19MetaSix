import { api } from './http'

export function generateJournalIdea(prompt) {
  return api.post('/api/journal/ideas', { prompt }).then((result) => result.idea)
}
