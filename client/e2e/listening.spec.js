import { test, expect } from './helpers.js'

test('dashboard switches listening periods', async ({ page, app }) => {
  expect(app.user.isDemo).toBe(true)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Your Listening Portrait' })).toBeVisible()
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
})

test('listening room offers Spotify connection for the test account', async ({ page, app }) => {
  expect(app.user.spotifyLinked).toBe(false)
  await page.goto('/listen')
  await expect(page.getByRole('heading', { name: 'Listening Room', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect Spotify', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()
})
