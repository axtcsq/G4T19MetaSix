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
| Deployment | Vercel, GitHub Actions |

## Try it live

[Open MetaFor](https://g4-t19-meta-six.vercel.app/)

Spotify sign-in may be limited to accounts approved in the Spotify Developer app. A seeded test account can be enabled for local development.

## What MetaFor does

- **Daily Mood:** Save one of eight moods with a journal entry, drawing, and optional song. Entries belong to the signed-in user and can be searched later.
- **Music insights:** Spotify refresh tokens stay encrypted on the server; the browser gets temporary access. Listening is paired with sound and lyric mood readings. Lyrics are analyzed but their text is not saved. Browser playback requires Spotify Premium.
- **Personality:** Six explainable quizzes—Music MBTI, Spotify Horoscope, Aux Alignment, Love on Repeat, Soundwoods, and Maslow’s Mixtape—combine with listening data to create a MetaFor profile. Groq can write its short summary.
- **Journal Helper:** Groq suggests a journal starting point from the prompt the user enters. The existing journal draft is not sent.
- **Listening garden:** Shows recent listening with Singapore weather from Open-Meteo, refreshed every 15 minutes.

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

Set `MONGODB_URI`, `SESSION_SECRET`, and a 64-character hexadecimal `TOKEN_KEY` in `server/.env`. Add Spotify credentials and register the callback URL in `.env.example` with Spotify. Keep `.env` private. `GROQ_API_KEY`, `DEEPL_API_KEY`, `LASTFM_API_KEY`, and `LRCLIB_DB_PATH` are optional.

## 3. Initialize the database and start the server

```sh
npm run db:init
npm run dev
```

For a local test account, set `DEMO_LOGIN=true` and run `npm run db:seed` against a development database.

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

Vercel serves the client and API as two services from the repository root. Set production environment variables in Vercel and register the production `SPOTIFY_REDIRECT_URI` with Spotify. GitHub Actions can sync listening history when its MongoDB and Spotify secrets are configured.

## Project structure

- `client/src/views/` and `components/` — pages and reusable UI
- `client/src/api/`, `stores/`, and `router/` — API calls, shared state, and routes
- `server/routes/`, `controller/`, `services/`, and `models/` — API and database logic
- `server/jobs/` — listening sync and song analysis
- `docs/brand/` — logo and butterfly exports
