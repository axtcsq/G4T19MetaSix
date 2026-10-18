import { request } from './http'

export function getQuizzes() {
  return request('/api/quiz')
}

export function getPersonality() {
  return request('/api/quiz/personality')
}

export function getQuiz(quizId) {
  return request(`/api/quiz/${encodeURIComponent(quizId)}`)
}

export function submitQuiz(quizId, answers) {
  return request(`/api/quiz/${encodeURIComponent(quizId)}/result`, {
    method: 'POST',
    body: { answers },
  })
}

export function getLatestResult(quizId) {
  return request(`/api/quiz/${encodeURIComponent(quizId)}/result`)
}
