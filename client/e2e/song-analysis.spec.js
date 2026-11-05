import { test, expect } from './helpers'
const FEATURES = [
  {
    key: 'valence',
    label: 'Valence (sound)',
    low: 'Sad',
    high: 'Happy',
    about: 'How positive.',
    value: 0.96,
    strength: 'high',
  },
  {
    key: 'energy',
    label: 'Energy',
    low: 'Calm',
    high: 'Intense',
    about: 'How intense.',
    value: 0.71,
    strength: 'fairly high',
  },
]

// Pumped Up Kicks: cheerful sound, dark words.
const kicks = {
  id: '7w87IxuO7BDcJ3YUqCyMTT',
  name: 'Pumped Up Kicks',
  artists: ['Foster the People'],
  album: { name: 'Torches', imageUrl: null },
  spotifyUrl: 'https://open.spotify.com/track/7w87IxuO7BDcJ3YUqCyMTT',
  plays: 3,
  lastPlayedAt: '2026-10-20T10:00:00.000Z',
  lyricsOff: false,
  tag: { lyricsNote: null },
  sound: { name: 'Euphoric', blurb: 'Bright and high-energy.', axis: 'happy' },
  withLyrics: { name: 'Deceptively upbeat', blurb: 'Bright music, dark words.', axis: 'anxious' },
  features: FEATURES,
  energy: 0.71,
  blend: {
    valence: 0.8,
    audio: 0.96,
    lyrics: 0.3,
    weight: 0.3,
    contrast: 'dark-words',
    contrastLabel: 'Upbeat sound, darker words',
  },
  lyrics: {
    status: 'found',
    translatedFrom: null,
    emotionalShare: 0.6,
    emotions: [['anger', 0.34]],
    darkThemes: ['gun', 'run'],
    highlights: { positive: [], negative: ['All the other kids / with the pumped up kicks'] },
  },
}

test('mood map labels both axes and names its corners', async ({ page, app }) => {
  void app
  await page.route('**/api/tracks/7w87IxuO7BDcJ3YUqCyMTT', (route) =>
    route.fulfill({ json: kicks }),
  )
  await page.goto('/song/7w87IxuO7BDcJ3YUqCyMTT')
  const map = page.locator('.map-grid')
  const plane = await page.locator('.plane').boundingBox()
  const energy = page.locator('.axis-labels-y span')
  await expect(energy).toHaveText(['← Calm', 'Energy', 'Intense →'])
  // Calm belongs at the bottom of the map and Intense at the top.
  const calm = await energy.first().boundingBox()
  const intense = await energy.last().boundingBox()
  expect(calm.y).toBeGreaterThan(intense.y)
  expect(calm.y + calm.height).toBeLessThanOrEqual(plane.y + plane.height + 1)
  expect(intense.y).toBeGreaterThanOrEqual(plane.y - 1)
  await expect(page.locator('.axis-labels-x span')).toHaveText([
    '← Negative',
    'Positivity',
    'Positive →',
  ])
  // The mood names sit outside the map, so a dot can never cover them.
  const moods = page.locator('.mood-labels span')
  await expect(moods).toHaveText(['Tense', 'Happy', 'Sad', 'Relaxed'])
  const [tense, happy, sad, relaxed] = await Promise.all(
    [0, 1, 2, 3].map((index) => moods.nth(index).boundingBox()),
  )
  expect(tense.y + tense.height).toBeLessThanOrEqual(plane.y)
  expect(happy.y + happy.height).toBeLessThanOrEqual(plane.y)
  expect(sad.y).toBeGreaterThanOrEqual(plane.y + plane.height)
  expect(relaxed.y).toBeGreaterThanOrEqual(plane.y + plane.height)
  expect(tense.x).toBeLessThan(happy.x)
  expect(sad.x).toBeLessThan(relaxed.x)
  await map.screenshot({ path: 'test-results/mood-map-desktop.png' })

  await page.setViewportSize({ width: 320, height: 700 })
  await expect(page.locator('.axis-labels-y')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await map.screenshot({ path: 'test-results/mood-map-320.png' })
})

test('song analysis keeps charts visible and reveals listening notes', async ({ page, app }) => {
  void app
  await page.route('**/api/tracks/7w87IxuO7BDcJ3YUqCyMTT', (route) =>
    route.fulfill({ json: kicks }),
  )
  await page.goto('/song/7w87IxuO7BDcJ3YUqCyMTT')
  await expect(page.getByRole('heading', { name: 'Mood map' })).toBeVisible()
  await expect(page.locator('.reading').first()).toBeHidden()
  await page.getByText('Compare sound and lyrics', { exact: true }).click()
  await expect(page.locator('.reading').first()).toBeVisible()
  await page.getByText('What the lyrics add', { exact: true }).first().click()
  await expect(page.locator('blockquote')).toBeVisible()
  await expect(page.getByRole('meter').first()).toHaveAttribute('aria-valuenow', '96')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: 'test-results/song-analysis-' + test.info().project.name + '.png',
    fullPage: true,
  })
})
