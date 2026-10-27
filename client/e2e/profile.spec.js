import { test, expect } from './helpers.js'

test('privacy setting saves and is restored after reload', async ({ page, app }) => {
  await page.goto('/profile')
  const lyrics = page.getByRole('switch', { name: 'Analyse song lyrics' })
  await expect(lyrics).toBeChecked()
  await lyrics.click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  expect(app.user.preferences.moodLens).toBe('sound')
  await page.reload()
  await expect(lyrics).not.toBeChecked()
  await expect(page.getByRole('switch', { name: 'Save my Spotify plays' })).toBeDisabled()
})

test('failed privacy update rolls back the toggle', async ({ page, app }) => {
  app.failSettings = true
  await page.goto('/profile')
  const lyrics = page.getByRole('switch', { name: 'Analyse song lyrics' })
  await lyrics.click()
  await expect(page.getByText(/Couldn’t save: Settings unavailable/)).toBeVisible()
  await expect(lyrics).toBeChecked()
})
