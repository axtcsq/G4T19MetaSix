# IS216 · MetaFor by MetaSix

MetaFor is a web app for tracking moods and journaling alongside Spotify listening history.

## What you can do

- **Daily Mood:** Record one of eight emotions, write a journal entry, draw, and optionally attach a song. Entries can be searched in Past Entries.
- **Journal Helper:** Send a prompt to Groq for a suggested journal starting point. Review it and insert it into the entry. The existing journal draft is not sent.
- **Listening Room:** Search and play Spotify tracks, view album art, and use the 3D turntable and mini player. In-app playback requires Spotify Premium.
- **Dashboard and Calendar:** Review listening history and song mood readings over time, including sound and lyrics-based readings.
- **Personality:** Complete six music quizzes and view a profile based on quiz results, listening and mood data. Groq can generate the profile summary; the app uses a scoring-based fallback when Groq is unavailable.

## Tech stack

| Area | Tools |
| --- | --- |
| Client | Vue 3, Vite, Vue Router, Pinia, Axios, Nuxt UI, Tailwind CSS |
| Server | Node.js, Express 5 |
| Database | MongoDB Atlas or local MongoDB, accessed with Mongoose |
| Visualization | Three.js and p5.js |
| Browser tests | Playwright; unit tests with Vitest and Node's test runner |
| Deployment | Vercel multi-service project; GitHub Actions for E2E checks and listening-history sync |

## Architecture

- **Components and views:** reusable interface pieces live in `client/src/components/`; each page is a Vue view in `client/src/views/`.
- **Routing and shared state:** Vue Router maps URLs to views and protects signed-in pages with a navigation guard. Pinia keeps the current account state available across pages; the session cookie itself stays HTTP-only on the server.
- **API requests:** functions in `client/src/api/` centralize calls to the server and external services. Views call those functions instead of building request URLs and handling HTTP details inline.
- **Server responsibilities:** Express routes define API paths, controllers handle request input and responses, services contain reusable application and integration logic, and Mongoose models describe stored data.

## External services

| Service | How MetaFor uses it |
| --- | --- |
| Spotify | Sign-in, profile and listening history, track search, and Web Playback SDK |
| ReccoBeats | Audio features used to understand a song's sound |
| LRCLIB | Lyrics lookup for song analysis |
| DeepL (optional) | Translation of non-English lyrics before scoring |
| Last.fm (optional) | Artist genre tags for music insights and quizzes |
| Groq (optional) | Journal suggestions and generated personality summaries |
| Open-Meteo | Current weather for the Listening Room environment |

Song lyrics are analyzed for emotional signals; lyric text is not saved in the database. Playback in the browser requires Spotify Premium. Spotify sign-in may be limited to accounts on the app's allowed-user list while the Spotify app is in Development Mode.

## Run locally

### Requirements

- Node.js 22.18 or newer
- npm
- pnpm (`npm install --global pnpm`)
- A MongoDB database (local MongoDB or MongoDB Atlas)
- A Spotify Developer app for Spotify login and listening features

### 1. Clone the repository

```sh
git clone https://github.com/axtcsq/G4T19MetaSix.git
cd G4T19MetaSix
```

### 2. Configure the server

Create a private environment file from the example:

```sh
cp server/.env.example server/.env
```

Set `MONGODB_URI` to a development database named `metafor_dev`. Add your Spotify app credentials and register `SPOTIFY_REDIRECT_URI` in the Spotify Developer Dashboard. The local callback is `http://127.0.0.1:3000/api/auth/callback`; use `127.0.0.1` rather than `localhost` when opening the app locally.

Set `TOKEN_KEY` to a 64-character hexadecimal key. Generate one with:

```sh
openssl rand -hex 32
```

Use the same `TOKEN_KEY` wherever this database is used. Changing it makes saved Spotify refresh tokens unreadable. Do not commit `.env` files or put server keys in client code.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Server port; defaults to `3000` |
| `CLIENT_ORIGIN` | Yes | Client origin allowed to use the API; local default is `http://127.0.0.1:5173` |
| `MONGODB_URI` | Yes | MongoDB connection string; use a development database ending in `_dev` for seeding |
| `SESSION_SECRET` | Yes | Signs the login session cookie; use a private random value |
| `TOKEN_KEY` | Yes | 64 hexadecimal characters used to encrypt Spotify refresh tokens |
| `SPOTIFY_CLIENT_ID` | For Spotify | Spotify Developer app client ID |
| `SPOTIFY_CLIENT_SECRET` | For Spotify | Spotify Developer app secret |
| `SPOTIFY_REDIRECT_URI` | For Spotify | Exact OAuth callback URL registered in Spotify |
| `DEMO_LOGIN` | No | Set to `true` to enable the seeded test account |
| `GROQ_API_KEY` | No | Enables journal suggestions and generated personality summaries |
| `DEEPL_API_KEY` | No | Enables translation of non-English lyrics |
| `LASTFM_API_KEY` | No | Enables artist genre tags; genre data is omitted without it |

Each developer should use their own Groq API key. The Helper sends the prompt, not the journal draft. Groq usage limits apply.

### 3. Install server dependencies and initialize MongoDB

```sh
cd server
npm install
npm run db:init
```

`db:init` creates collections and indexes. To create or refresh the sample test account in a development database:

```sh
npm run db:seed
# Optional: generate only 30 days of sample history
npm run db:seed -- --days 30
```

Seeding replaces the demo user's generated listening history and sample journal entries, but keeps entries written by hand. The command refuses to seed a database whose name does not end in `_dev` unless explicitly overridden.

### 4. Start the server

From `server/`:

```sh
npm run dev
```

The API runs at `http://127.0.0.1:3000`. Check `http://127.0.0.1:3000/api/health` for the database connection status.

### 5. Start the client

In a second terminal, from the repository root:

```sh
cd client
pnpm install
pnpm dev
```

Open the Vite URL shown in the terminal (normally `http://127.0.0.1:5173`). Vite forwards `/api` requests to the server on port 3000. Use **Continue with Spotify** if your Spotify account is allowed by the app, or **Use the test account** when `DEMO_LOGIN=true` and the database has been seeded. The test account has generated sample history and does not connect to Spotify.

## Testing

Run client unit tests from `client/`:

```sh
pnpm test:unit -- --run
```

Run the Playwright browser suite from `client/`:

```sh
pnpm exec playwright install chromium  # first run only
pnpm test:e2e
```

Playwright starts its own Vite server on `127.0.0.1:5199`; it does not require MongoDB or a Spotify account. The browser tests mock API responses, so they check user flows but do not verify real Spotify OAuth, database persistence, Groq generation, or backend authorization. GitHub Actions runs these E2E tests on pushes to `main` and `test-cases`, and on pull requests targeting `main`.

Run server tests from `server/`:

```sh
npm test
```

The song-mood evaluation can be run with `npm run mood:eval` from `server/`. It uses the checked-in labelled test data.

## Data model

MetaFor stores Spotify listening records and personal reflections separately:

- `users` stores account and preference data.
- `listens` stores individual plays, linked to a user and a shared `tracks` record.
- `tracks` stores song metadata and sound/lyrics mood analysis shared across users.
- `dailyMoods` stores per-user, per-day summaries derived from listening history; it can be rebuilt from `listens` and `tracks`.
- `dailylogs` stores a user's selected emotion, optional journal text, and optional vector drawing.
- `quizattempts` and `personalities` store quiz answers and the combined personality profile.
- `syncGaps` records listening-history periods that may be incomplete. `sessions` stores server-managed login sessions.

Personal data queries are scoped to the signed-in user's database ID. Drawings are stored as vector data (strokes, shapes, and text), rather than image files.

## Deployment and scheduled sync

The root `vercel.json` defines two services: `client` and `server`. Set the Vercel project root directory to the repository root. Requests under `/api/*` are routed to the server; other paths are routed to the Vue single-page app. Set production environment variables in Vercel. In particular, set `SPOTIFY_REDIRECT_URI` to `https://<your-production-domain>/api/auth/callback` and register that exact URL in the Spotify Developer Dashboard. Use the production domain currently assigned to the project in Vercel.

GitHub Actions can sync active Spotify users' newest plays every 15 minutes and analyze newly discovered songs. Configure repository secrets `MONGODB_URI`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `TOKEN_KEY`; `DEEPL_API_KEY` is optional and enables lyric translation during analysis. Spotify only exposes a limited recent-play history, so the scheduled job helps retain plays over time.

## Project structure

```text
client/src/
├── api/           # Client requests to the server and public APIs
├── components/    # Shared UI, journal canvas, listening and dashboard pieces
├── composables/   # Reusable stateful Vue logic
├── router/        # Routes and authentication guards
├── stores/        # Shared Pinia state
└── views/         # Landing, dashboard, journal, calendar, listening, quizzes

server/
├── routes/        # Express URL definitions
├── controller/    # Request handling and validation
├── models/        # Mongoose schemas and database operations
├── services/      # Spotify, sync, mood analysis and personality logic
├── jobs/          # Scheduled/manual sync and analysis tasks
└── tests/         # Server-side tests
```

## More documentation

- [Server API and mood-analysis notes](server/README.md)
- [Playwright setup and coverage](client/e2e/README.md)
- [Design overview](docs/DESIGN.md)
- [Shared style guide](docs/STYLE.md)
- [Spotify authentication and playback](docs/SPOTIFY.md)
- [Personality quizzes](docs/PersonalityQuiz.md)
- [Listening Room weather](docs/WEATHER.md)
