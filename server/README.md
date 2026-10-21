# MetaFor server

The server is an Express API. It uses Mongoose to read and write mood logs in MongoDB.

## Files

- `index.js` loads environment variables and starts the HTTP server.
- `app.js` configures CORS, JSON parsing, health checks, routes, and error responses.
- `config/db.js` opens and reuses the MongoDB connection.
- `routes/moodRoutes.js` maps mood URLs to controller functions.
- `controller/moodController.js` validates requests and chooses HTTP responses.
- `routes/journalRoutes.js` and `controller/journalController.js` provide the journal idea helper.
- `models/MoodLog.js` defines the MongoDB schema and mood log queries.
- `models/User.js`, `Listen.js`, `Track.js`, `DailyMood.js` and `SyncGap.js` define the listening and mood collections.
- `scripts/db-init.js` creates every collection and its indexes.
- `scripts/seed.js` creates the demo user and a year of generated listening history from `scripts/data/demo-songs.json`.
- `services/mood/` holds the mood rules (`mood.js`) and the music-mood-to-axis table (`axes.js`).
- `services/dailyMoods.js` rebuilds a user's daily mood summaries from their listens.
- `services/sync.js` saves a user's newest Spotify plays into `listens` and new songs into `tracks`. `jobs/sync.js` (`npm run sync`) runs it for every active user, and GitHub Actions runs that every hour.

## Configuration

Copy `.env.example` to `.env` and fill in the values. The root README lists where each one comes from.

For multiple allowed client origins, separate them with commas. Keep `.env` private; it is ignored by Git.

## Mood API

All endpoints use the `/api/moods` prefix. A mood must be `Sad`, `Happy`, `Relaxed`, `Anxious`, or `Angry`. The journal is optional and limited to 5,000 characters.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/moods` | List the 100 newest logs |
| `GET` | `/api/moods/:id` | Get one log |
| `POST` | `/api/moods` | Create a log with `mood` and optional `journal` |
| `PATCH` | `/api/moods/:id` | Update `mood`, `journal`, or both |
| `DELETE` | `/api/moods/:id` | Delete a log |
| `GET` | `/api/health` | Check the API and MongoDB connection |

The API starts even if MongoDB is unavailable. In that case the health endpoint returns `503`, and mood requests return a database unavailable response. This keeps the server's existing recovery and health-check behavior.

## Journal idea helper

The Daily Mood page's Helper sends a user's prompt to Groq and displays a short journal starter that can be inserted into the journal field. Only the prompt is sent; the existing journal text is not included. The authenticated `POST /api/journal/ideas` endpoint accepts prompts up to 800 characters and uses Groq's `openai/gpt-oss-20b` model.

Each developer should create their own API key at [Groq Console](https://console.groq.com/keys) and add it as `GROQ_API_KEY` in the server's private `.env` file. The key stays on the server; never place it in client code or commit it. Groq usage limits apply.

The Canvas page currently displays a static analysis placeholder. No AI provider is connected.

## Set up the database

Run this once per database, and again whenever an index is added or changed. It only creates what is missing.

```sh
npm run db:init
```

The server doesn't build indexes on startup (`autoIndex` is off), so new indexes only exist after this runs.

To fill the database with test data, seed the demo user:

```sh
npm run db:seed                 # a year of plays
npm run db:seed -- --days 30    # only the last 30 days
```

This adds the 156 test songs to `tracks` with both mood readings, creates the demo user (`spotifyId: "demo"`, never synced), generates 10–40 plays a day, and rebuilds their `dailyMoods`. Exam weeks lean sad, holidays lean happy, and weekends are quieter. Re-running replaces the demo user's data, so it is safe to repeat. It refuses to run on a database whose name doesn't end in `_dev` unless you pass `--yes`.


## Run

```sh
npm install
npm run dev
```
