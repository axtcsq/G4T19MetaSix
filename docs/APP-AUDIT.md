# Application audit — 1 November 2026

Existing uncommitted work was preserved. This pass reviewed routing, session and
playback ownership, API boundaries, data access, startup bundles, browser flows,
and responsive layouts. It adds focused fixes rather than replacing the stack.

## Changes

- Lazy-load route components and the landing journal's Three.js preview. The main
  JavaScript entry fell from 1,004 KB to about 168 KB; shared initial CSS fell from
  413 KB to 281 KB (uncompressed build output, not a measured loading-time claim).
- Encode the six quiz images as WebP at up to 640px wide: approximately 4.9 MB to
  2.1 MB combined. Replace the dashboard's 856 KB logo with a 36px, 2.5 KB WebP.
  Original PNG files remain available as source assets.
- Pause offscreen/hidden landing WebGL rendering. Release cassette model geometry,
  materials, textures and the WebGL context on unmount; discard late model loads
  and show the existing fallback if a WebGL renderer cannot be created.
- Bound API requests to 30 seconds, upstream lyrics/audio lookups to 10 seconds,
  the journal helper to 15 seconds, and pre-read Spotify sync to 5 seconds. A failed
  sync still permits reading stored history; server sync may finish after timeout.
- Prevent late session checks and settings saves from restoring logged-out account
  state. Serialize privacy toggles to avoid out-of-order settings responses.
- Remount route views when the pathname changes so quiz IDs do not reuse stale
  answers/results. Restore scroll positions, recover unknown paths to the landing
  page, reject ambiguous login return paths and prevent a login-to-login loop.
- Invalidate search results when the query changes, clear pending debounce timers
  on unmount, and keep song-analysis responses attached to the song requested.
- Disable API caching and MIME sniffing; reject untrusted browser origins on API
  writes before database/session work. Keep `CLIENT_ORIGIN` configured for the
  frontend deployment (comma-separated origins supported).
- Return 400 for malformed JSON and remove redundant database middleware.
- Patch compatible transitive body-parser, qs, undici and follow-redirects releases.
  Server production audit is clean; frontend production audit retains one low
  esbuild Windows development-server advisory. High/moderate findings are cleared.
- Set the document language to English.

## Verification

- Final frontend unit run: 105 tests passed. Final backend run: 33 tests passed.
  All 50 browser scenarios passed across the final run and a two-test rerun after
  host suspension caused `ERR_NETWORK_IO_SUSPENDED`. Production build, ESLint,
  Oxlint and whitespace checks pass.
- Frontend unit tests cover auth races, search races, HTTP errors and existing UI
  behavior; backend tests cover analysis, mood responses and origin protection.
- Playwright uses a production build with isolated API fixtures. Desktop and mobile
  core flows cover login/logout, journal validation/save/failure/history/calendar,
  quiz answers/results, privacy updates/rollback, listening and song analysis.
- Responsive route matrices exercise 320, 390, 768, 1024 and 1440 CSS pixels,
  populated content, menus, dialogs, drawing controls and long text. They check
  visible bounds and runtime errors and save full-page screenshots. Short landscape
  story controls are covered separately.
- Run `npm test` in `server`; run `pnpm test:unit --run`, `pnpm exec eslint .` and
  `pnpm test:e2e` in `client`. Browser tests build the app before serving it.

## Remaining boundaries

- Browser fixtures do not establish live MongoDB authorization/persistence,
  Spotify OAuth/Premium playback, or AI-provider behavior. Those require configured
  services and accounts; no production data was modified during verification.
- Firefox, WebKit, real mobile hardware, deployment cold starts, provider rate
  limits and production load were not exercised. Three.js and p5 remain sizeable
  lazy chunks; slow connections still pay their download cost when used.
- Public song search/analysis and paid AI operations should have deployment-level
  abuse controls before broad public exposure; a process-local limiter alone
  would not protect a multi-instance/serverless deployment.
- The remaining low esbuild advisory concerns serving development files on Windows.
  Production uses the built assets; the development server remains bound to loopback.
