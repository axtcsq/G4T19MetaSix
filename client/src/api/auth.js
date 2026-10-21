import { api } from './http'

// Login is a full page visit, not an API call: the browser goes to Spotify and
// comes back through the server, which then sets the session cookie.
export function spotifyLoginUrl(next) {
  const params = new URLSearchParams({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  if (next) params.set('next', next)

  return `${api.defaults.baseURL}/api/auth/login?${params}`
}

export function getMe() {
  return api.get('/api/me')
}

// The seeded test account, for teammates and graders without a Spotify login.
export function getDemoStatus() {
  return api.get('/api/auth/demo')
}

export function demoLogin() {
  return api.post('/api/auth/demo')
}

export function logout() {
  return api.post('/api/auth/logout')
}
