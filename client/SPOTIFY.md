# Spotify music and playback

The listening room uses Spotify directly. There are no runtime sample records, rankings, dates, listening totals or mood scores. Mood journals remain in the existing MongoDB API; weather remains in its existing weather integration.

## Setup

1. Create a Spotify developer app with Web API and Web Playback SDK access.
2. Copy `.env.example` to `.env.local`, enter the public `VITE_SPOTIFY_CLIENT_ID`, and register the exact `VITE_SPOTIFY_REDIRECT_URI` in the Spotify developer dashboard. Never add a client secret to the browser.
3. For the default redirect, start Vite on port 5173 and open `http://127.0.0.1:5173/listen`. Production redirects require HTTPS.
4. Click Connect Spotify. Existing sessions must disconnect and reconnect once to grant the added `user-read-recently-played` permission. Development-mode accounts must be allowed in the Spotify developer dashboard. In-browser playback requires Spotify Premium.

## Data contract

`src/api/spotify.js` owns PKCE, refresh and authenticated HTTP. `useListeningRoom` is the shared owner of history, shelf, search and SDK playback across routes. Disconnect clears history, artwork, search, tokens and the player. Requests ignore obsolete history/search responses after disconnect.

| Operation | Contract |
| --- | --- |
| Authorize | Authorization Code + SHA-256 PKCE and random OAuth state; exact redirect URI |
| Token / refresh | Form POST to `https://accounts.spotify.com/api/token`, no client secret |
| Recent history | `GET /v1/me/player/recently-played?limit=50`, `items[].track` and `played_at` |
| Search | `GET /v1/search?q=…&type=track&limit=10`, `tracks.items` |
| Play | `PUT /v1/me/player/play?device_id=…`, Spotify URI queue; 204 success |
| Controls | Official Web Playback SDK pause, previous/next, seek and volume; SDK state confirms playback |

Scopes: `streaming user-read-private user-read-email user-read-playback-state user-modify-playback-state user-read-recently-played`.

Tokens remain in tab-scoped sessionStorage. OAuth state/verifier are single use and expire after ten minutes. Token refresh is shared; disconnect prevents a pending refresh restoring the session. HTTP requests have 15-second timeouts and one refresh/retry on 401. Failures and rate limits show inline recovery guidance. Search is cancellable, debounced and IME-safe. No personal queries are stored in URLs.

The shelf deduplicates recent tracks. Selecting a track starts it followed by up to 49 other recent tracks. Next/previous use that Spotify playback queue. Artwork and track links come from Spotify; an empty account shows an invitation to search. Without a connection playback controls stay disabled.

## Verification

Run `node scripts/verify-spotify.mjs` from client for the targeted HTTP/component/model tests. HTTP tests run the actual client against a local HTTP server on 127.0.0.1:4905, including recent history, PKCE, refresh, playback, rate limits and permission errors. The runner uses a workspace temp directory for Windows compatibility.

Start Vite, then run `node scripts/check-spotify.mjs http://127.0.0.1:5173` for desktop/mobile disconnected states and simulated account history, SDK selection, history failure/retry and disconnect. Screenshots are written to `.taste-skill/spotify-live-data`. These provider/SDK simulations do not prove live entitlement or audio streaming.

Orbit discovery was attempted but its hostname did not resolve. The installed Postman executable is the desktop app; the existing local HTTP stand-in is reused. No shared Postman workspace was changed.

Live OAuth, allowed-user access, Premium audio and browser protected-content compatibility require a signed-in authorized Spotify account. Official contracts: [recent history](https://developer.spotify.com/documentation/web-api/reference/get-recently-played), [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/reference).
