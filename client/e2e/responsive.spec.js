import { test, expect } from './helpers.js'
import { QUIZZES } from '../../server/data/quizzes/index.js'
import { PERSONALITY_TYPES } from '../../server/data/personalityTypes.js'

// Route-specific controls are exercised within every viewport's complete route matrix.
/* eslint-disable playwright/no-conditional-in-test, playwright/no-conditional-expect */

const result = {
  quizId: 'musical-needs',
  quizTitle: 'Musical Needs',
  title: 'Music as Fuel',
  headline: 'Your result',
  subtitle: 'Fuel',
  description: 'Music helps you focus.',
  justification: ['Your answers show a preference for focus.'],
  breakdown: [],
}
const fixtureTime = '2026-10-31T04:00:00.000Z'

test('story content remains reachable on a short landscape screen', async ({ page, app }) => {
  test.setTimeout(60000)
  expect(app.signedIn).toBe(true)
  await page.setViewportSize({ width: 568, height: 320 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'See how it works', exact: true }).last().click()
  const story = page.getByRole('dialog', { name: 'How MetaFor works, an example week' })
  await expect(story).toBeVisible()
  await story.getByRole('button', { name: 'Pause', exact: true }).click()
  // Return to the first slide if rendering took longer than its auto-advance timer.
  for (let slide = 0; slide < 5; slide++) await page.keyboard.press('ArrowLeft')
  await expect(
    story.getByRole('heading', { name: 'This is what MetaFor could show you.' }),
  ).toBeVisible()
  await expect(story.locator('.story-slide')).toBeInViewport()
  await expect
    .poll(() =>
      story.locator('.story-slide').evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeGreaterThanOrEqual(70)
  for (let slide = 0; slide < 5; slide++) await page.keyboard.press('ArrowRight')
  const finish = story.getByRole('link', { name: 'Get started', exact: true })
  await finish.scrollIntoViewIfNeeded()
  await expect(finish).toBeInViewport()
  await expect
    .poll(() => story.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(story).toBeHidden()
})

async function fits(page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const width = document.documentElement.clientWidth
          return [
            ...document.querySelectorAll(
              'main, main *, .site-header, .site-header a, .site-header button, .helper-popover, .helper-popover *, .share-dialog, .share-dialog *',
            ),
          ]
            .filter((element) => {
              const rect = element.getBoundingClientRect()
              return (
                rect.width &&
                rect.height &&
                getComputedStyle(element).visibility !== 'hidden' &&
                !element.closest('[inert], [aria-hidden="true"]') &&
                (rect.left < -1 || rect.right > width + 1)
              )
            })
            .map((element) => `${element.tagName}.${element.className}`)
            .slice(0, 12)
        }),
      { message: 'Visible content must fit the viewport' },
    )
    .toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

for (const [width, height] of [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
]) {
  test(`all screens reflow at ${width}px`, async ({ page, app }) => {
    test.setTimeout(180000)
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.setViewportSize({ width, height })
    await page.clock.setFixedTime(new Date(fixtureTime))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    app.user.id = app.user._id
    app.user.displayName = 'Listener'.repeat(12)
    app.moods = [
      {
        _id: 'reflection',
        mood: 'Happy',
        journal: 'Reflection '.repeat(30) + 'LongUnbrokenReflection'.repeat(8),
        createdAt: fixtureTime,
      },
    ]
    await page.route('**/api/quiz', (route) => route.fulfill({ json: QUIZZES }))
    await page.route('**/api/quiz/personality', (route) =>
      route.fulfill({
        json: {
          type: { ...PERSONALITY_TYPES[0], match: 85 },
          traits: [],
          quizResults: [result],
          headline: 'Your listening patterns',
          insights: ['You enjoy discovering music.'],
          summary: 'Keep exploring.',
          song: {
            id: 'responsive',
            name: 'LongSongName'.repeat(10),
            artist: 'Artist',
            reason: 'A song for your type.',
          },
        },
      }),
    )
    await page.route('**/api/listens?**', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              played_at: fixtureTime,
              track: {
                id: 'responsive',
                name: 'LongSongName'.repeat(10),
                artists: [{ id: 'artist', name: 'LongArtistName'.repeat(10) }],
                album: { images: [] },
              },
            },
          ],
        },
      }),
    )
    await page.route('**/api/quiz/musical-needs', (route) =>
      route.fulfill({ json: QUIZZES.find((quiz) => quiz.id === 'musical-needs') }),
    )
    await page.route('**/api/quiz/musical-needs/result', (route) => route.fulfill({ json: result }))
    await page.route('**/api/tracks/responsive', (route) =>
      route.fulfill({
        json: {
          id: 'responsive',
          name: 'A song title '.repeat(8),
          artists: ['An artist name '.repeat(5)],
          album: { name: 'Album', imageUrl: null },
          plays: 3,
          tag: {},
          sound: { name: 'Happy', blurb: 'Bright sound', axis: 'happy' },
          withLyrics: { name: 'Happy', blurb: 'Bright words', axis: 'happy' },
          features: [],
          energy: 0.7,
          blend: { valence: 0.8, audio: 0.8, lyrics: 0.8, weight: 0.3 },
          lyrics: {
            status: 'found',
            emotions: [['joy', 0.8]],
            darkThemes: [],
            highlights: { positive: ['A positive line'], negative: [] },
          },
        },
      }),
    )
    for (const path of [
      '/',
      '/dashboard',
      '/listen',
      '/daily-mood',
      '/calendar',
      '/quiz',
      '/quiz/musical-needs',
      '/quiz/musical-needs/result',
      '/song/responsive',
      '/profile',
      '/login',
    ]) {
      await test.step(path, async () => {
        app.signedIn = path !== '/login'
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        await expect(page.locator('main')).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        if (path === '/quiz') await expect(page.locator('.type-name')).toBeVisible()
        if (path === '/song/responsive') await expect(page.locator('.song-heading')).toBeVisible()
        await fits(page)
        if (path === '/daily-mood') {
          await page.getByRole('button', { name: 'Open MetaFor Helper' }).click()
          await expect(page.getByRole('heading', { name: 'MetaFor Helper' })).toBeVisible()
          await fits(page)
          await page.getByRole('button', { name: 'Close MetaFor Helper' }).click()
          await page.getByText('Add a Drawing', { exact: true }).click()
          await fits(page)
          await page.getByRole('button', { name: 'Past Entries', exact: true }).click()
          await expect(page.locator('.journal-entry')).toBeVisible()
          await fits(page)
        }
        if (path === '/calendar') {
          await page.getByRole('button', { name: /journal mood Happy/ }).click()
          await fits(page)
        }
        if (path === '/quiz') {
          await page.getByRole('button', { name: 'Share my personality card' }).click()
          const dialog = page.getByRole('dialog', { name: 'Your Personality Card' })
          await expect(dialog.locator('.share-image')).toBeVisible()
          await fits(page)
          await dialog.getByRole('button', { name: 'Close', exact: true }).click()
        }
        const menu = page.getByRole('button', { name: 'Open menu', exact: true })
        if (await menu.isVisible()) {
          await menu.click()
          await expect(page.locator('#site-menu')).toBeVisible()
          await fits(page)
          await page.keyboard.press('Escape')
          await expect(page.locator('#site-menu')).toBeHidden()
        }
        await page.screenshot({
          path: `test-results/responsive-${width}-${path.replaceAll('/', '_') || 'landing'}.png`,
          fullPage: true,
        })
      })
    }
    expect(pageErrors).toEqual([])
  })
}
