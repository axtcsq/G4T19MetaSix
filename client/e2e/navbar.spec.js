import { test, expect } from './helpers.js'

const track = {
  id: 'test-track',
  uri: 'spotify:track:test-track',
  name: 'Test song',
  artists: [{ id: 'artist', name: 'Test artist' }],
  album: { name: 'Test album', images: [] },
}

async function mockSong(page) {
  await page.route('**/api/tracks/test-track', (route) =>
    route.fulfill({
      json: {
        id: track.id,
        name: track.name,
        artists: ['Test artist'],
        album: { name: 'Test album', imageUrl: null },
        spotifyUrl: 'https://open.spotify.com/track/test-track',
        plays: 1,
        lyricsOff: false,
        tag: { lyricsNote: null },
        sound: null,
        withLyrics: null,
        features: [],
        energy: null,
        blend: null,
        lyrics: null,
      },
    }),
  )
}

async function mockPlays(page) {
  await page.route('**/api/tracks/moods?**', (route) =>
    route.fulfill({ json: { moods: {}, needsSound: [] } }),
  )
  await page.route('**/api/listens?**', (route) =>
    route.fulfill({ json: { items: [{ played_at: new Date().toISOString(), track }] } }),
  )
}

test('a song opened from the Listening Room keeps its link highlighted', async ({ page, app }) => {
  app.user.spotifyLinked = true
  await mockSong(page)
  await page.route('**/api/spotify/token', (route) =>
    route.fulfill({ json: { accessToken: 'token', expiresAt: Date.now() + 3600000 } }),
  )
  await page.route('https://api.spotify.com/v1/me/player/recently-played**', (route) =>
    route.fulfill({ json: { items: [{ played_at: new Date().toISOString(), track }] } }),
  )
  await page.goto('/listen')
  const current = page.locator('.header-link.is-current')
  await expect(current).toHaveText('Listening Room')

  // The page's song links only appear once Spotify's player reports a track, which needs its real
  // SDK, so this makes the same router navigation those links do.
  await page.evaluate(() =>
    document
      .querySelector('#app')
      .__vue_app__.config.globalProperties.$router.push('/song/test-track'),
  )
  await expect(page).toHaveURL('/song/test-track')
  await expect(current).toHaveText('Listening Room')

  // The browser remembers where the song was opened from across a refresh.
  await page.reload()
  await expect(current).toHaveText('Listening Room')
})

test('a song opened from Home keeps Home highlighted', async ({ page, app }) => {
  expect(app.signedIn).toBe(true)
  await mockSong(page)
  await mockPlays(page)
  await page.goto('/dashboard')
  const current = page.locator('.header-link.is-current')
  await expect(current).toHaveText('Home')

  await page.locator('.song-list a[href="/song/test-track"]').first().click()
  await expect(page).toHaveURL('/song/test-track')
  await expect(current).toHaveText('Home')
})

test('a song opened directly highlights nothing', async ({ page, app }) => {
  expect(app.signedIn).toBe(true)
  await mockSong(page)
  await page.goto('/song/test-track')
  await expect(page.locator('.site-header')).toBeVisible()
  await expect(page.locator('.header-link.is-current')).toHaveCount(0)
})

test('a song opened from the Calendar keeps Calendar highlighted', async ({ page, app }) => {
  expect(app.signedIn).toBe(true)
  await mockSong(page)
  await page.goto('/song/test-track?from=calendar')
  await expect(page.locator('.header-link.is-current')).toHaveText('Calendar')
})
