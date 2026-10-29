import { test, expect } from './helpers.js'

test('landing page leads to login', async ({ page, app }) => {
  app.signedIn = false
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Get started' })
    .click()
  await expect(page.getByRole('heading', { name: 'Welcome to MetaFor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Spotify' })).toBeVisible()
})
