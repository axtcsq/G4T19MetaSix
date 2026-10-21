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

export function logout() {
  return api.post('/api/auth/logout')
}
