import { test, expect } from './helpers.js'

for (const { name, family, face } of [
  { name: 'Aggressive', family: 'tense', face: 'angry' },
  { name: 'Hope in the dark', family: 'calm', face: 'happy' },
  { name: 'Dark and driving', family: 'tense', face: 'anxious' },
  { name: 'Serene', family: 'calm', face: 'relaxed' },
]) {
  test(`calendar shows the ${face} face for ${name} music`, async ({ page, app }) => {
    expect(app.signedIn).toBe(true)
    await page.route('**/api/listens?**', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              played_at: new Date().toISOString(),
              track: {
                id: 'test-track',
                name: 'Test song',
                artists: [{ id: 'artist', name: 'Test artist' }],
                album: { images: [] },
              },
              moods: { sound: null, lyrics: { name, family } },
            },
          ],
        },
      }),
    )
    await page.goto('/calendar')

    const dayFace = page.locator('.calendar-face')
    await expect(dayFace).toHaveClass(new RegExp(`mood-reaction--${face}\\b`))
    await page.locator('.day-cell', { has: dayFace }).click()

    await expect(page.locator('.listening-mood-summary')).toContainText(name)
    await expect(page.locator('.listening-mood-icon')).toHaveClass(
      new RegExp(`mood-reaction--${face}\\b`),
    )
  })
}
