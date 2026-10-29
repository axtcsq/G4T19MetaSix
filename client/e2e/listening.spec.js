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
  await page.getByRole('button', { name: 'This month', exact: true }).click()
  await expect(page.getByRole('button', { name: 'This month', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.locator('.play-calendar')).toBeVisible()
  await page.locator('.play-calendar button').first().click()
  await expect(page.locator('.chart-days .calendar-readout')).toContainText('recorded plays')
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
  await page.getByRole('button', { name: 'This month', exact: true }).click()
  await page.locator('.play-calendar').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.play-calendar')).toBeVisible()
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
