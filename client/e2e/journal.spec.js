import { test, expect } from './helpers.js'

test('save requires mood and reflection, then appears in history and calendar', async ({
  page,
  app,
}) => {
  await page.goto('/daily-mood')
  const save = page.getByRole('button', { name: 'Save entry', exact: true })
  await expect(save).toBeDisabled()
  await page.getByRole('button', { name: 'Happy', exact: true }).click()
  await expect(save).toBeDisabled()
  await page.getByPlaceholder('Write your thoughts here...').fill('  A good day with friends.  ')
  await save.click()
  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible()
  expect(app.moods[0]).toMatchObject({ mood: 'Happy', journal: 'A good day with friends.' })
  await expect(page.getByPlaceholder('Write your thoughts here...')).toBeEmpty()
  await page.reload()
  await page.getByRole('button', { name: 'Past entries', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Past entries' })).toContainText(
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
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Saving unavailable')
  await expect(page.getByPlaceholder('Write your thoughts here...')).toHaveValue('A quiet evening.')
  app.failSave = false
  await page.getByRole('button', { name: 'Save entry', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Entry saved.' })).toBeVisible()
  expect(app.moods).toHaveLength(1)
})
