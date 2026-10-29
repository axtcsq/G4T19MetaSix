# Playwright browser tests

The original Vue starter test has been replaced with feature tests, following the
sample repo's feature specs and shared helper structure.

Run from `client/`:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright starts and stops its own Vite server at http://127.0.0.1:5199.
Keep that port free. No Express server, database, .env, or Spotify account is required.

For interactive debugging:

```sh
pnpm test:e2e --ui
pnpm test:e2e --headed
pnpm exec playwright show-report
pnpm test:e2e e2e/journal.spec.js
```

Coverage:
- Landing page to login, protected-route redirects, demo login and logout.
- Journal validation, save, searchable history, calendar display, and retry after failed saves.
- Helper availability on page load, animated backdrop, and reduced-motion behavior.
- Quiz answer validation, Back navigation, submission, and result display.
- Profile privacy settings, reload, and rollback after a failed update.
- Dashboard period selection and Listening Room connection/disabled playback state.

`helpers.js` supplies a fresh session and in-memory entries for each test using
Playwright request routing. Unexpected app API calls fail the test instead of
reaching the real backend. The quiz spec reuses the real quiz questions and supplies
a fixed result; it checks the submitted answers, not the server's scoring algorithm.

These are browser flow tests with mocked API responses. Reload checks verify that
the UI reads fixtures again, not MongoDB persistence. They do not verify real Spotify
OAuth/playback, backend authorization, database writes, AI generation, or quiz scoring.
Chromium only for now; add Firefox/WebKit projects when broader browser coverage is needed.

GitHub Actions runs the suite on pushes to `test-cases` and `main`, and pull
requests targeting `main`. The HTML report is uploaded even on failure; failed
tests also retain screenshots and traces. No repository secrets are needed.
