import { api } from './http'

// Login is a full page visit, not an API call: the browser goes to Spotify and comes back through the server, which then sets the session cookie.
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

// The privacy toggles on the profile page. Returns the updated user.
export function updateSettings(changes) {
  return api.patch('/api/me/settings', changes)
}

// Home's metaphor of the day, written for the user's mood and taste. { text, mood, genre, source }, with text null when there's nothing to go on.
export function getDailyMetaphor() {
  return api.get('/api/me/metaphor')
}

// Everything MetaFor keeps about the user, as an object to save as JSON.
export function exportData() {
  return api.get('/api/me/export')
}

// Deletes journal entries, listening history and quiz results. Returns the user.
export function clearHistory() {
  return api.delete('/api/me/history')
}

// Forgets the Spotify login and stops saving plays. Returns the updated user.
export function disconnectSpotify() {
  return api.post('/api/me/spotify/disconnect')
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
