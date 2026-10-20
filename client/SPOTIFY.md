# Dashboard Spotify setup

The dashboard uses real recently played tracks. It does not load a playback SDK or infer mood and genre scores.

## Local setup

1. Copy `.env.example` to `.env.local` and set your public Spotify client ID. Never add a client secret.
2. Register `http://127.0.0.1:5173/dashboard` as an exact redirect URI in your Spotify developer app.
3. Start Vite on that host and port, open `/dashboard`, and choose Connect Spotify. Keep `.env.local` out of Git.

## Data ownership

`api/spotify.js` provides shared PKCE, token refresh and authenticated request functions. Its playback helpers are shared with the separate listening-room branch; the dashboard does not invoke them.

`useSpotifyHistory.js` owns dashboard sign-in, history loading, retry and disconnect. Disconnect invalidates pending responses and clears account history. Tokens use tab-scoped sessionStorage; OAuth state and verifier are single use. The request boundary retains its timeout, 401 refresh/retry and rate-limit handling.

`spotifyDashboard.js` filters up to 50 returned plays into the last seven local calendar days or current month. Rankings, daily and hourly counts, and repeat counts describe only that returned history. A first appearance is not necessarily a new discovery. Collaborative tracks count once for each credited artist, but once in the play total. Track duration is not actual listening time.

The mood and genre sections remain explicitly unavailable until real measurements are integrated. Spotify track and artist links retain source attribution. No example values are inserted.

## Verification

Run `node scripts/verify-spotify.mjs` for HTTP, history lifecycle, aggregation and artwork tests. HTTP tests use a local server at 127.0.0.1:4905, not live credentials.

Run `pnpm exec vitest run src/__tests__/Weather.spec.js` for weather parsing tests, and `pnpm build` for the production build.

With Vite running, `node scripts/check-spotify.mjs http://127.0.0.1:5173` verifies connected/disconnected layouts, retry and disconnect using simulated Spotify responses. Screenshots go to the ignored `.taste-skill` folder. These checks do not establish live OAuth entitlement or provider availability.
