import { test as base, expect } from '@playwright/test'

// Each test owns its data. API requests never reach the shared database.
export const test = base.extend({
  app: async ({ page }, use) => {
    const state = {
      user: {
        _id: 'e2e-user',
        displayName: 'E2E Listener',
        isDemo: true,
        spotifyLinked: false,
        timezone: 'Asia/Singapore',
        preferences: { moodLens: 'lyrics', savePlays: true },
      },
      signedIn: true,
      moods: [],
      failSave: false,
      failSettings: false,
      unexpected: [],
    }
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request()
        const path = new URL(request.url()).pathname
        const method = request.method()
        const reply = (json, status = 200) => route.fulfill({ status, json })
        if (path === '/api/me')
          return reply(
            state.signedIn ? state.user : { error: 'Not logged in' },
            state.signedIn ? 200 : 401,
          )
        if (path === '/api/auth/demo') {
          if (method === 'GET') return reply({ enabled: true })
          state.signedIn = true
          return reply(state.user)
        }
        if (path === '/api/auth/logout') {
          state.signedIn = false
          return reply({ ok: true })
        }
        if (path === '/api/me/settings' && method === 'PATCH') {
          if (state.failSettings) return reply({ error: 'Settings unavailable' }, 503)
          state.user.preferences.moodLens =
            request.postDataJSON().analyseLyrics === false ? 'sound' : 'lyrics'
          return reply(state.user)
        }
        if (path === '/api/moods') {
          if (method === 'GET') return reply(state.moods)
          if (method === 'POST') {
            if (state.failSave) return reply({ error: 'Saving unavailable' }, 503)
            const entry = {
              ...request.postDataJSON(),
              _id: 'entry-' + state.moods.length,
              createdAt: new Date().toISOString(),
            }
            state.moods.unshift(entry)
            return reply(entry, 201)
          }
        }
        if (path === '/api/listens') return reply({ items: [] })
        if (path === '/api/quiz/personality') return reply(null)
        state.unexpected.push(method + ' ' + path)
        return reply({ error: 'Unexpected test request' }, 501)
      },
    )
    await use(state)
    expect(state.unexpected, 'New API calls need explicit fixtures').toEqual([])
  },
})
export { expect }
