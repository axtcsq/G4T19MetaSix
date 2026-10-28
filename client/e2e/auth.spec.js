import { test, expect } from './helpers.js'

for (const path of ['/daily-mood', '/calendar', '/quiz', '/profile']) {
  test('signed-out visitors must log in before opening ' + path, async ({ page, app }) => {
    app.signedIn = false
    await page.goto(path)
    await expect(page).toHaveURL('/login?next=' + path)
    await expect(page.getByRole('heading', { name: 'Welcome to MetaFor' })).toBeVisible()
  })
}

test('account login returns to requested page and can log out', async ({ page, app }) => {
  app.signedIn = false
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Use the test account' }).click()
  await expect(page.getByRole('heading', { name: 'Your Profile', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login\?next=/)
})
