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
- `services/mood/` holds the mood rules (`mood.js`), the music-mood-to-axis table (`axes.js`) and the song analysis. `analyse.js` (`analyseTrack`) fetches a song's audio features from ReccoBeats (`reccobeats.js`, falling back to other Spotify IDs for the same recording through `spotify.js`), its lyrics from LRCLIB (`lyrics.js`), translates non-English lyrics with DeepL (`translate.js`), scores them with a local emotion model (`emotion.js`), and saves both mood readings to `tracks`. The lyrics text is never stored, only the scores.
- `services/dailyMoods.js` rebuilds a user's daily mood summaries from their listens.
- `services/sync.js` saves a user's newest Spotify plays into `listens` and new songs into `tracks`. `jobs/sync.js` (`npm run sync`) runs it for every active user, and GitHub Actions runs that every 15 minutes.
- `jobs/analyse.js` (`npm run analyse`) runs after each sync. It analyses up to 100 songs that are new, `partial` (lyrics failed for now) or `failed`, retrying each up to 3 times, then rebuilds the days they were played. The emotion model (~83 MB) downloads into `server/.models/` on first use; GitHub Actions caches it.
- `services/mood/sound.js` is the sound-only half of the analysis, which needs no emotion model. `POST /api/tracks/moods/sound` uses it for songs nobody has played yet (search results, recommendations): it saves them with their sound mood in a second or two, and the analysis job adds the lyrics mood on its next run. `GET /api/tracks/moods` gives the mood tags for songs already stored. Both are behind login, and a user can add at most 100 new songs every 10 minutes.
- `jobs/recompute.js` (`npm run mood:recompute`) recomputes every song's moods from stored scores, with no API calls, and rebuilds every day. Run it after changing `mood.js` or `axes.js`.

## Configuration

Copy `.env.example` to `.env` and fill in the values. The root README lists where each one comes from.

For multiple allowed client origins, separate them with commas. Keep `.env` private; it is ignored by Git.

## Mood API

All endpoints use the `/api/moods` prefix and are scoped to the signed-in user. A mood must be `Sad`, `Happy`, `Relaxed`, `Anxious`, `Angry`, `Excited`, `Tired`, or `Lonely`. The journal is optional and limited to 5,000 characters. Entries may also include an optional version 1 vector drawing (`width`, `height`, and `items`); the API limits drawings to 900 KB, 500 items, and 20,000 points.

| Method   | Path             | Purpose                                                              |
| -------- | ---------------- | -------------------------------------------------------------------- |
| `GET`    | `/api/moods`     | List the 100 newest logs                                             |
| `GET`    | `/api/moods/:id` | Get one log                                                          |
| `POST`   | `/api/moods`     | Create a log with `mood`, optional `journal`, and optional `drawing` |
| `PATCH`  | `/api/moods/:id` | Update `mood`, `journal`, and/or `drawing`                           |
| `DELETE` | `/api/moods/:id` | Delete a log                                                         |
| `GET`    | `/api/health`    | Check the API and MongoDB connection                                 |

The API starts even if MongoDB is unavailable. In that case the health endpoint returns `503`, and mood requests return a database unavailable response. This keeps the server's existing recovery and health-check behavior.

Mood logs are stored with their owner's `userId`; list, read, update, delete, and personality mood summaries only use that user's logs. Older logs created before `userId` was added remain in MongoDB but are not returned because they cannot be safely attributed to an account. Run `npm run db:init` once after deploying this schema change to create the new owner/date index.

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

This adds the 156 test songs to `tracks` with both mood readings, creates the demo user (`spotifyId: "demo"`, never synced), generates 10–40 plays a day, and rebuilds their `dailyMoods`. Exam weeks lean sad, holidays lean happy, and weekends are quieter. It also writes an evening journal entry on about 3 in 4 days, in the mood of that day's music (exam weeks bring Anxious too). Re-running replaces the demo user's plays and generated entries (marked `source: "seed"`), so it is safe to repeat; entries someone wrote by hand are kept, and those days get no generated entry. It refuses to run on a database whose name doesn't end in `_dev` unless you pass `--yes`.

## Run

```sh
npm install
npm run dev
```

## Check the mood analysis

```sh
npm test            # analyseTrack with fake API responses, no network
npm run mood:eval   # the mood rules on 156 labelled songs: expect 126/156 (sound + lyrics) and 110/156 (sound only)
```

`testdata/dark.json` and `testdata/foreign.json` are smaller sets for dark lyrics and non-English songs: `node testdata/eval.mjs testdata/dark.json services/mood/mood.js --list`. A change to a threshold in `mood.js` must not lower either reading's score.
