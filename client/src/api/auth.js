import { api } from './http'

// Login is a full page visit, not an API call. The browser goes to Spotify and back through the server, which sets the session cookie.
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

// Home's metaphor of the day: { text, mood, genre, source }. text is null if there's nothing to go on.
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

// Forgets the Spotify connection while keeping the MetaFor account signed in.
export function disconnectSpotify() {
  return api.post('/api/me/spotify/disconnect')
}


export function logout() {
  return api.post('/api/auth/logout')
}
