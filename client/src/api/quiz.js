import { api } from './http'
const quizPath = (quizId) => `/api/quiz/${encodeURIComponent(quizId)}`

export function getQuizzes() {
  return api.get('/api/quiz')
}

export function getPersonality() {
  return api.get('/api/quiz/personality')
}

// The six MetaFor types, for the Personality page.
export function getPersonalityTypes() {
  return api.get('/api/quiz/types')
}

export function getQuiz(quizId) {
  return api.get(quizPath(quizId))
}

export function submitQuiz(quizId, answers) {
  return api.post(`${quizPath(quizId)}/result`, { answers })
}

export function getLatestResult(quizId) {
  return api.get(`${quizPath(quizId)}/result`)
}

export function getMoodMusic(days) {
  return api.get('/api/quiz/mood-music', { params: { days } })
}

export function getGenreMix(days) {
  return api.get('/api/quiz/genre-mix', { params: { days } })
}
