import { test, expect } from './helpers.js'

for (const path of [
  '/dashboard',
  '/listen',
  '/daily-mood',
  '/calendar',
  '/quiz',
  '/profile',
  '/song/example',
]) {
  test('signed-out visitors must log in before opening ' + path, async ({ page, app }) => {
    app.signedIn = false
    await page.goto(path)
    await expect(page).toHaveURL('/login?next=' + path)
    await expect(page.getByRole('heading', { name: 'Welcome to MetaFor' })).toBeVisible()
  })
}

test('unknown URLs recover to the landing page', async ({ page, app }) => {
  app.signedIn = false
  await page.goto('/does-not-exist')
  await expect(page).toHaveURL('/')
  await expect(page.locator('main')).toBeVisible()
})

test('login does not loop on a login return destination', async ({ page, app }) => {
  expect(app.signedIn).toBe(true)
  await page.goto('/login?next=/login')
  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('main')).toBeVisible()
})

test('logging out means logging in again', async ({ page, app }) => {
  expect(app.signedIn).toBe(true)
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Your Profile', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login\?next=/)
})
