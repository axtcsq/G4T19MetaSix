import { test, expect } from './helpers.js'

test('journal helper uses the sparkle icon and moving background, respecting reduced motion', async ({
  page,
  app,
}) => {
  expect(app.signedIn).toBe(true)
  await page.goto('/daily-mood')
  const launcher = page.getByRole('button', { name: 'Open MetaFor Helper' })
  await expect(launcher).toBeVisible()
  await expect(launcher.locator('img')).toHaveAttribute('src', /journal-helper-sparkle/)
  await launcher.click()
  await expect(page.getByRole('heading', { name: 'MetaFor Helper' })).toBeVisible()
  await expect(page.locator('.helper-liquid')).toHaveJSProperty('paused', false)
  await expect(page.locator('.helper-liquid')).toHaveAttribute('src', '/videos/banner-sunset.mp4')
  await expect(page.locator('.helper-liquid-scrim')).toBeVisible()
  await page.getByRole('button', { name: 'Close MetaFor Helper' }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(launcher).toBeVisible()
  await launcher.click()
  await expect(page.getByRole('heading', { name: 'MetaFor Helper' })).toBeVisible()
  await expect(page.locator('.helper-liquid')).toHaveCount(0)
  await expect(page.locator('.helper-liquid-scrim')).toBeVisible()
})

test('actions are flat while mood choices and drawing tools retain their raised style', async ({
  page,
  app,
}) => {
  expect(app.signedIn).toBe(true)
  await page.goto('/daily-mood')
  const history = page.getByRole('button', { name: 'Past Entries', exact: true })
  await expect(history).toHaveCSS('box-shadow', 'none')
  await expect(history).toHaveCSS('background-image', 'none')
  const happy = page.getByRole('button', { name: 'Happy', exact: true })
  await expect(happy).not.toHaveCSS('box-shadow', 'none')
  await page.getByText('Add a Drawing', { exact: true }).click()
  await expect(page.locator('.tool-button').first()).not.toHaveCSS('background-image', 'none')
  await expect(page.locator('.tool-button').first()).not.toHaveCSS('box-shadow', 'none')
  await expect(page.locator('.drawing-panel')).toHaveCSS('border-top-width', '0px')
  await expect(page.locator('.drawing-disclosure')).toHaveCSS('border-top-width', '0px')
  await page.goto('/')
  await expect(page.locator('.hero-mood-options .mood-reaction').first()).not.toHaveCSS(
    'box-shadow',
    'none',
  )
})

test('save requires mood and reflection, then appears in history and calendar', async ({
  page,
  app,
}) => {
  await page.goto('/daily-mood')
  const save = page.getByRole('button', { name: 'Save Entry', exact: true })
  await expect(save).toBeDisabled()
  await page.getByRole('button', { name: 'Happy', exact: true }).click()
  await expect(save).toBeDisabled()
  await page.getByPlaceholder('Write your thoughts here...').fill('  A good day with friends.  ')
  await save.click()
  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible()
  expect(app.moods[0]).toMatchObject({ mood: 'Happy', journal: 'A good day with friends.' })
  await expect(page.getByPlaceholder('Write your thoughts here...')).toBeEmpty()
  await page.reload()
  await page.getByRole('button', { name: 'Past Entries', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Past Entries' })).toContainText(
    'A good day with friends.',
  )
  await page.goto('/calendar')
  await page.getByRole('button', { name: /journal mood Happy/ }).click()
  await expect(page.getByText('“A good day with friends.”', { exact: true })).toBeVisible()
})

test('failed saves preserve the entry and allow retry', async ({ page, app }) => {
  app.failSave = true
  await page.goto('/daily-mood')
  await page.getByRole('button', { name: 'Relaxed', exact: true }).click()
  await page.getByPlaceholder('Write your thoughts here...').fill('A quiet evening.')
  await page.getByRole('button', { name: 'Save Entry', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Saving unavailable')
  await expect(page.getByPlaceholder('Write your thoughts here...')).toHaveValue('A quiet evening.')
  app.failSave = false
  await page.getByRole('button', { name: 'Save Entry', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible()
  expect(app.moods).toHaveLength(1)
})

test('past entries can be searched by journal text, mood, and date', async ({ page, app }) => {
  app.moods.push(
    {
      _id: 'entry-park',
      mood: 'Relaxed',
      journal: 'Walked through the park and felt calm.',
      createdAt: '2026-10-28T10:00:00.000Z',
    },
    {
      _id: 'entry-friends',
      mood: 'Happy',
      journal: 'Had dinner with friends.',
      createdAt: '2026-10-25T10:00:00.000Z',
    },
  )

  await page.goto('/daily-mood')
  await page.getByRole('button', { name: 'Past Entries', exact: true }).click()
  const search = page.getByRole('searchbox', { name: 'Search past entries' })
  await expect(search).toBeVisible()
  await expect(page.getByText('Walked through the park and felt calm.')).toBeVisible()
  await expect(page.getByText('Had dinner with friends.')).toBeVisible()

  await search.fill('park')
  await expect(page.getByText('Walked through the park and felt calm.')).toBeVisible()
  await expect(page.getByText('Had dinner with friends.')).toHaveCount(0)

  await search.fill('happy')
  await expect(page.getByText('Had dinner with friends.')).toBeVisible()
  await expect(page.getByText('Walked through the park and felt calm.')).toHaveCount(0)

  await search.fill('2026-10-28')
  await expect(page.getByText('Walked through the park and felt calm.')).toBeVisible()
  await expect(page.getByText('Had dinner with friends.')).toHaveCount(0)

  await search.fill('nothing matches')
  await expect(page.getByText(/No entries match/)).toBeVisible()
})
