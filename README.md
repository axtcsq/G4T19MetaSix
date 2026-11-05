# IS216 — Group Project
## MetaFor — Music and Mood Journal

> Your music can be a window into how you feel.

MetaFor connects Spotify listening with mood tracking and journaling, helping users reflect on how music and mood relate over time.

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | Vue 3, Vite, Vue Router, Pinia |
| Backend | Node.js, Express 5 |
| Database | MongoDB, Mongoose |
| Visuals | Three.js, p5.js |
| Testing | Vitest, Playwright, Node test runner |
| Services | Spotify, ReccoBeats, LRCLIB, Open-Meteo; optional Groq, DeepL, Last.fm |
| Deployment | Vercel, Render, GitHub Actions |

## Try it live

[Open MetaFor](https://g4t19metasix.vercel.app/)

Spotify sign-in may be limited to accounts approved in the Spotify Developer app.

## What MetaFor does

- **Daily Mood:** Save one of eight moods with a journal entry, drawing, and optional song. Entries belong to the signed-in user and can be searched later.
- **Music insights:** Spotify refresh tokens stay encrypted on the server; the browser gets temporary access. Listening is paired with sound and lyric mood readings. Lyrics are analyzed but their text is not saved. Browser playback requires Spotify Premium.
- **Personality:** Six explainable quizzes—Music MBTI, Spotify Horoscope, Aux Alignment, Love on Repeat, Soundwoods, and Maslow’s Mixtape—combine with listening data to create a MetaFor profile. Groq can write its short summary.
- **Journal Helper:** Groq suggests a journal starting point from the prompt the user enters. The existing journal draft is not sent.
- **Listening garden:** Shows recent listening with Singapore weather from Open-Meteo, refreshed every 15 minutes.

## AI usage declaration

- **Listening Room:** The vinyl player is a browser-rendered visual; Spotify handles search and playback.
- **Creative features:** AI assisted development of the 3D models and piano note strings, and generation of dashboard flowers.
- **Spotify API:** Spotify supplies account, track, and listening data. It does not generate music or analysis.
- **Personality quizzes:** Quiz content and scoring are predefined. Groq can generate profile summaries from quiz results and listening patterns.
- **Journal Drawing:** Users create drawings themselves with the in-app drawing canvas. The drawing is then saved as part of their journal entry


## Routes

### App pages

| Path | Access | Description |
| --- | --- | --- |
| `/` | Public | Landing page and sign-in entry point. |
| `/dashboard` | Signed in | Listening overview, music moods, artists, and listening habits. |
| `/listen` | Signed in | Spotify listening room and playback controls. |
| `/login` | Public | Sign in with Spotify; signed-in users are redirected to their next page or the dashboard. |
| `/daily-mood` | Signed in | Log today's mood, journal entry, drawing, or song. |
| `/calendar` | Signed in | Browse and edit mood history and discover mood-matched songs. |
| `/quiz` | Signed in | Browse personality quizzes and profile results. |
| `/quiz/:quizId` | Signed in | Take a selected personality quiz. |
| `/quiz/:quizId/result` | Signed in | View the latest result for a quiz. |
| `/song/:id` | Signed in | View a song's mood analysis. |
| `/profile` | Signed in | Manage account, privacy, and listening settings. |
| `/canvas` | Redirect | Redirects to `/daily-mood` (legacy path). |
| `/signup` | Redirect | Redirects to `/login`; Spotify login creates the account. |
| Unknown path | Redirect | Redirects to `/`. |

### API endpoints

All endpoints use the `/api` prefix. Unless noted, endpoints below require a signed-in user.

| Method and path | Access | Description |
| --- | --- | --- |
| `GET /health` | Public | Check that the server is responding. |
| `GET /auth/login` | Public | Start Spotify sign-in. |
| `GET /auth/callback` | Public | Complete Spotify sign-in. |
| `POST /auth/logout` | Public | End the current session. |
| `GET /me` | Signed in | Read the current user and preferences. |
| `PATCH /me/settings` | Signed in | Update account settings. |
| `GET /me/export` | Signed in | Export account data. |
| `DELETE /me/history` | Signed in | Clear saved listening history. |
| `POST /me/spotify/disconnect` | Signed in | Disconnect Spotify. |
| `GET /me/metaphor` | Signed in | Get the daily personalized metaphor. |
| `GET /spotify/token` | Signed in | Get a temporary Spotify access token. |
| `GET /listens` | Signed in | Read saved listening history. |
| `GET /listens/insights` | Signed in | Read daily music mood insights. |
| `GET /listens/overall-mood` | Signed in | Read combined journal and music mood history. |
| `POST /sync` | Signed in | Sync recent Spotify listening history. |
| `GET /tracks/moods` | Signed in | Read mood tags for tracks. |
| `POST /tracks/moods/sound` | Signed in | Analyze tracks for sound moods. |
| `GET /tracks/:id` | Signed in | Read track details and mood information. |
| `POST /recommendations` | Signed in | Get mood-matched song recommendations. |
| `GET /songs/search` | Public | Search for songs. |
| `GET /songs/:id/analysis` | Public | Read a song's mood analysis. |
| `GET /moods` | Signed in | List the user's mood entries. |
| `POST /moods` | Signed in | Create a mood entry. |
| `GET /moods/:id` | Signed in | Read one mood entry. |
| `PATCH /moods/:id` | Signed in | Edit a mood entry. |
| `DELETE /moods/:id` | Signed in | Delete a mood entry. |
| `POST /journal/ideas` | Signed in | Generate a journal writing prompt. |
| `GET /quiz` | Signed in | List available quizzes. |
| `GET /quiz/personality` | Signed in | Read the user's personality profile. |
| `GET /quiz/types` | Signed in | List personality types. |
| `GET /quiz/mood-music` | Signed in | Read music mood summaries. |
| `GET /quiz/genre-mix` | Signed in | Read the user's listening genre mix. |
| `GET /quiz/:quizId` | Signed in | Read a quiz. |
| `GET /quiz/:quizId/result` | Signed in | Read the latest quiz result. |
| `POST /quiz/:quizId/result` | Signed in | Submit quiz answers and save a result. |

Unknown API paths return `404`.

## Design

The interface uses a warm journal-inspired palette, with terracotta and lavender accents. Raleway is used for headings and controls; Crimson Text for prose. Light and dark themes, mobile layouts, and reduced-motion settings are supported. Quiz card images are from Unsplash.

## Prerequisites

- Node.js 22.18 or newer
- pnpm
- MongoDB (local or Atlas)
- A Spotify Developer app for Spotify sign-in and listening features

## 1. Clone the repository

```sh
git clone https://github.com/axtcsq/G4T19MetaSix.git
cd G4T19MetaSix
```

## 2. Configure the server

```sh
cd server
npm install
cp .env.example .env
```

Set `MONGODB_URI`, `SESSION_SECRET`, and a 64-character hexadecimal `TOKEN_KEY` in `server/.env`. Local MongoDB must run as a replica set (`mongod --replSet rs0`, then `mongosh --eval "rs.initiate()"`) for atomic history clearing. Add Spotify credentials and register the callback URL in `.env.example` with Spotify. Keep `.env` private. `GROQ_API_KEY`, `DEEPL_API_KEY`, `LASTFM_API_KEY`, and `LRCLIB_DB_PATH` are optional.

## 3. Initialize the database and start the server

```sh
npm run db:init
npm run dev
```

## 4. Start the client

In a second terminal:

```sh
cd client
pnpm install
pnpm dev
```

Open the Vite address shown in the terminal. The client forwards `/api` requests to the server. Open the app at `127.0.0.1` for local Spotify login so the callback host matches the example configuration.

## 5. Run tests

From `client/`:

```sh
pnpm test:unit -- --run
pnpm exec playwright install chromium  # first time only
pnpm test:e2e
```

From `server/`:

```sh
npm test
npm run mood:eval
```

Playwright uses mocked API responses, so it checks browser flows without requiring MongoDB, Spotify, or AI credentials.

The recent application review also covered authentication, API boundaries, responsive layouts, and performance.

## Deployment

Vercel serves the client, and `client/vercel.json` forwards `/api` requests to the Express API on Render (`https://metafor.onrender.com`). Set the server's production environment variables in Render and register the production `SPOTIFY_REDIRECT_URI` with Spotify. GitHub Actions can sync listening history when its MongoDB and Spotify secrets are configured.

## Project structure

- `client/src/views/` and `components/` — pages and reusable UI
- `client/src/api/`, `stores/`, and `router/` — API calls, shared state, and routes
- `server/routes/`, `controller/`, `services/`, and `models/` — API and database logic
- `server/jobs/` — listening sync and song analysis
- `docs/brand/` — logo and butterfly exports
