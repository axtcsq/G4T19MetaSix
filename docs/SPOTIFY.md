# Spotify music and playback

The dashboard, calendar and listening room use the Spotify Web API and Web Playback SDK directly from the browser. Spotify access comes from the MetaFor login: there is no separate Spotify connection in the browser.

## How access works

1. The user logs in with "Continue with Spotify" (`/api/auth/login`). The server asks Spotify for every scope the app needs and stores the refresh token, encrypted, in `users`.
2. The browser asks `GET /api/spotify/token` for a short-lived access token (1 hour). The refresh token never reaches the browser.
3. `client/src/api/spotify.js` caches that token in memory, fetches a new one when it is about to expire or Spotify answers 401, and shares one request between concurrent callers.

`hasSpotifySession()` is true when `/api/me` reports `spotifyLinked`. It is false when logged out, for the demo account (no Spotify account), after the user removes MetaFor's access in Spotify, and for users who logged in before a scope was added. "Connect Spotify" sends those users to the login, which asks Spotify again.

Logging out stops the player and clears history, search and artwork. The listening room's Disconnect only stops the player; Connect starts it again without a new login.

Scopes: `user-read-recently-played streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state`. The Web Playback SDK needs `streaming`, `user-read-email` and `user-read-private`. In-browser playback requires Spotify Premium, and in Development Mode only accounts on the app's user list can log in.

## Setup

No client settings are needed. The server needs `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REDIRECT_URI` in `server/.env` (see the root README). In development, open the app on `http://127.0.0.1:5173`, not `localhost`, so the login cookie survives Spotify's redirect.

## Data contract

The app's `GET /api/tracks/moods?ids=...` and `POST /api/tracks/moods/sound` responses include optional `moods[id].tempo` in BPM for analyzed tracks with a finite positive stored tempo. It is omitted when unavailable. This reuses the existing stored audio features and mood cache; the visualizer does not request Spotify audio analysis or capture audio. The seek wave travels one wavelength over two beats at the supplied BPM, with a fixed fallback pace when missing. This matches tempo, not beat positions or tempo changes within a recording.

| Operation | Contract |
| --- | --- |
| Access token | `GET /api/spotify/token` → `{ accessToken, expiresAt }`; 401 when logged out, 403 when Spotify access must be granted again |
| Recent history | `GET /v1/me/player/recently-played?limit=50`, `items[].track` and `played_at` |
| Search | `GET /v1/search?q=…&type=track&limit=10`, `tracks.items` |
| Play | `PUT /v1/me/player/play?device_id=…`, Spotify URI queue; 204 success |
| Controls | Official Web Playback SDK pause, previous/next, seek and volume; SDK state confirms playback |

HTTP requests have 15-second timeouts and one token refresh/retry on 401. Failures and rate limits show inline recovery guidance. Search is cancellable, debounced and IME-safe. No personal queries are stored in URLs.

The shelf deduplicates recent tracks. Selecting a track starts it followed by up to 49 other recent tracks. Next/previous use that Spotify playback queue. Artwork and track links come from Spotify; an empty account shows an invitation to search. Without a connection playback controls stay disabled.

## Verification

Run `node scripts/verify-spotify.mjs` from client for the targeted HTTP/component/model tests. The HTTP tests run the actual client against a local HTTP stand-in for Spotify on 127.0.0.1:4905, with the token endpoint mocked.

Live login, allowed-user access, Premium audio and browser protected-content compatibility require a signed-in authorized Spotify account. Official contracts: [recent history](https://developer.spotify.com/documentation/web-api/reference/get-recently-played), [playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/reference).

GET /api/quiz/genre-mix requires the existing authenticated session and returns { artistPlays, taggedArtistPlays, genres: [{ name, share }] } from the cached 30-day listening profile. Shares split each top-15 artist play across its weighted Last.fm tags, normalised over tagged artist plays; collaborations count per credited artist. Top five genres are retained, with the remainder grouped as Other genres. Missing tags yield an empty genres array, not fabricated shares. Response uses Cache-Control: no-store.
