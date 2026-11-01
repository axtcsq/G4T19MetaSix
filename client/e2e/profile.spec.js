import { test, expect } from './helpers.js'

test('a settings response cannot restore the account after logout', async ({ page, app }) => {
  let finish
  let received = false
  let respond
  const responded = new Promise((resolve) => { respond = resolve })
  await page.route('**/api/me/settings', async (route) => {
    received = true
    await new Promise((resolve) => { finish = resolve })
    await route.fulfill({ json: app.user })
    respond()
  })
  await page.goto('/profile')
  await page.getByRole('switch', { name: 'Analyse song lyrics' }).click()
  await expect.poll(() => received).toBe(true)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL('/')
  finish()
  await responded
  // Use client-side navigation so this checks the existing store rather than a reload.
  await page.getByRole('link', { name: 'Get started', exact: true }).first().click()
  await expect(page).toHaveURL('/login')
})

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
