import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import process from 'node:process'

const base = new URL(process.argv[2] || 'http://127.0.0.1:5181').origin
const out = '../.taste-skill/spotify-live-data'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/dashboard']) {
      await page.goto(`${base}${path}`)
      await page.getByRole('heading', { level: 1 }).waitFor()
      await page.getByRole('button', { name: 'Connect Spotify', exact: true }).waitFor()
      assert.equal(await page.locator('.shelf-record').count(), 0)
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      )
      if (path === '/listen')
        assert.equal(
          await page.getByRole('button', { name: 'Play', exact: true }).isDisabled(),
          true,
        )
      await page.screenshot({ path: `${out}/${path.slice(1)}-${width}.png`, fullPage: true })
    }
  }
  // Provider responses and SDK are simulated; application code runs unchanged.
  const song = {
    id: 'test-song',
    uri: 'spotify:track:test-song',
    name: 'Browser test song',
    artists: [{ id: 'test-artist', name: 'Browser test artist' }],
    album: { name: 'Test album', images: [] },
    duration_ms: 180000,
    external_urls: { spotify: 'https://open.spotify.com/track/test-song' },
  }
  let plays = 0,
    failure = false
  await page.route('https://api.spotify.com/v1/**', async (route) => {
    if (route.request().url().includes('/recently-played')) {
      await route.fulfill({
        status: failure ? 403 : 200,
        json: { items: [{ track: song, played_at: new Date().toISOString() }] },
      })
    } else if (route.request().method() === 'PUT') {
      plays++
      await route.fulfill({ status: 204 })
    } else await route.fulfill({ json: { tracks: { items: [song] } } })
  })
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'metafor.spotify.session',
      JSON.stringify({
        access_token: 'test',
        refresh_token: 'test',
        expires: Date.now() + 3600000,
      }),
    )
    window.Spotify = {
      Player: class {
        listeners = {}
        addListener(event, cb) {
          this.listeners[event] = cb
        }
        async connect() {
          setTimeout(() => this.listeners.ready({ device_id: 'test-device' }), 10)
          return true
        }
        disconnect() {}
        async activateElement() {}
        async getCurrentState() {
          return null
        }
      },
    }
  })
  await page.goto(`${base}/dashboard`)
  await page.getByText('Browser test song', { exact: false }).first().waitFor()
  assert.match(await page.locator('.sleeve-totals').innerText(), /1/)
  assert.equal(await page.locator('.chart-radar').count(), 0)
  await page.getByRole('heading', { name: 'Mood over time', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Emotion profile', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Genre mix', exact: true }).waitFor()
  assert.equal(await page.locator('.daily-plays li').count(), 7)
  assert.equal(await page.locator('.repeat-plays li').count(), 2)
  assert.equal(await page.locator('.unavailable-note').count(), 3)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    )
    await page.screenshot({ path: `${out}/dashboard-restored-${width}.png`, fullPage: true })
  }
  await page.locator('.listening-artwork canvas').waitFor({ state: 'visible' })
  await page.screenshot({ path: `${out}/dashboard-connected-390.png`, fullPage: true })
  failure = true
  await page.goto(`${base}/dashboard`)
  await page.getByRole('button', { name: 'Retry history' }).waitFor()
  failure = false
  await page.getByRole('button', { name: 'Retry history' }).click()
  await page.locator('.song-list').waitFor()
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click()
  assert.equal(await page.locator('.shelf-record').count(), 0)
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log(
    'Spotify browser checks passed: desktop/mobile disconnected, connected history, selection, failure/retry, disconnect; provider/SDK simulated.',
  )
} finally {
  await browser.close()
}
