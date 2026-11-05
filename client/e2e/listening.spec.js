import { test, expect } from './helpers.js'

async function dashboardHistory(page, app) {
  app.user.id = 'e2e-user'
  await page.route('**/api/tracks/moods?**', (route) => route.fulfill({ json: { moods: {}, needsSound: [] } }))
  await page.route('**/api/listens?**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            played_at: new Date().toISOString(),
            track: {
              id: 'test-track',
              name: 'Test song',
              artists: [{ id: 'artist', name: 'Test artist' }],
              album: { images: [] },
            },
          },
        ],
      },
    }),
  )
}

test('dashboard switches listening periods', async ({ page, app }) => {
  await dashboardHistory(page, app)
  expect(app.user.isDemo).toBe(true)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Your Music at a Glance' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Last 30 days', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Last 30 days', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.locator('.play-equaliser')).toBeVisible()
  await page.locator('.play-equaliser button').first().click()
  await expect(page.locator('.chart-days .calendar-readout')).toContainText('recorded plays')
})

test('dashboard loads and shows the last 30 days', async ({ page, app }) => {
  await dashboardHistory(page, app)
  const day = 24 * 60 * 60 * 1000
  await page.route('**/api/listens?**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            played_at: new Date(Date.now() - 25 * day).toISOString(),
            track: {
              id: 'older',
              name: 'Played weeks ago',
              artists: [{ id: 'artist', name: 'Test artist' }],
              album: { images: [] },
            },
          },
        ],
      },
    }),
  )
  // Today's story asks for plays too, with its own smaller limit.
  const request = page.waitForRequest(
    (sent) => sent.url().includes('/api/listens?') && sent.url().includes('limit=2000'),
  )
  await page.goto('/dashboard')
  const from = new URL((await request).url()).searchParams.get('from')
  // Midnight 29 days ago in the browser's time zone, which can differ from this test's.
  const earliest = await page.evaluate(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - 29)
    return date.getTime()
  })
  expect(new Date(from).getTime()).toBe(earliest)

  const songs = page.locator('.song-list li')
  await expect(songs).toHaveCount(0)
  await page.getByRole('button', { name: 'Last 30 days', exact: true }).click()
  await expect(songs).toHaveCount(1)
  await expect(songs.first()).toContainText('Played weeks ago')
  await expect(page.locator('.play-equaliser button')).toHaveCount(30)
  await page.locator('.play-equaliser').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/dashboard-30-days.png', fullPage: true })
})

test('dashboard can show only today', async ({ page, app }) => {
  await dashboardHistory(page, app)
  const track = (id) => ({
    id,
    name: id,
    artists: [{ id: 'artist', name: 'Test artist' }],
    album: { images: [] },
  })
  await page.route('**/api/listens?**', (route) =>
    route.fulfill({
      json: {
        items: [
          { played_at: new Date().toISOString(), track: track('Played today') },
          {
            played_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            track: track('Played earlier'),
          },
        ],
      },
    }),
  )
  await page.goto('/dashboard')
  const songs = page.locator('.song-list li')
  await expect(songs).toHaveCount(2)
  await expect(page.locator('.play-equaliser')).toBeVisible()

  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(songs).toHaveCount(1)
  await expect(songs.first()).toContainText('Played today')
  await expect(page.locator('.play-equaliser')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/dashboard-today.png', fullPage: true })

  await page.setViewportSize({ width: 320, height: 700 })
  const controls = await page.locator('.period-control').boundingBox()
  expect(controls.x + controls.width).toBeLessThanOrEqual(320)
})

test('genre mix highlights real shares and fits desktop and mobile', async ({ page, app }) => {
  await dashboardHistory(page, app)
  expect(app.signedIn).toBe(true)
  await page.route('**/api/quiz/genre-mix', (route) =>
    route.fulfill({
      json: {
        artistPlays: 10,
        taggedArtistPlays: 8,
        genres: [
          { name: 'rock', share: 62.5 },
          { name: 'pop', share: 37.5 },
        ],
      },
    }),
  )
  await page.goto('/dashboard')
  const genre = page.locator('.genre-mix')
  await expect(genre).toBeVisible()
  await genre.getByRole('button', { name: 'rock 63%' }).focus()
  await expect(genre.locator('.disc-label')).toContainText('63%')
  await page.getByRole('button', { name: 'Last 30 days', exact: true }).click()
  await page.locator('.play-equaliser').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.play-equaliser')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true })
})

test('listening room offers Spotify connection for the test account', async ({ page, app }) => {
  expect(app.user.spotifyLinked).toBe(false)
  await page.goto('/listen')
  await expect(page.getByRole('heading', { name: 'Listening Room', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect Spotify', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
})
