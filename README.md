# IS216 - MetaFor by MetaSix

Metafor is a web-based mood journaling application that helps users express and reflect on their emotions through music and visualisation. Users can select songs that resonate with how they feel and record their
mood through multiple forms of expression, including mood selections, visual wavelengths, drawings,
metaphors, and optional written reflections.

Instead of relying solely on written descriptions, Metafor allows users to translate their feelings into visual
representations such as lines, dots, musical notes, water-like patterns, and other wavelength designs.

These mood entries are stored and presented through an interactive dashboard, allowing users to look
back at their music, emotions, and visual expressions over time. The application focuses on self-expression and personal reflection, by connecting music with creative forms of emotional expression. Metafor aims to make mood tracking more intuitive, personal, and visually
engaging.

# 1. Tech Stack
| Name    | Purpose |
| -------- | ------- |
| MongoDB  | Database Choice |
| Spotify | Account Login & Management |
| Vue & Express.js    | Frontend & Backend |
| Nuxt UI | UI Library |
| Vercel | App Development |

# 2. API
| Name    | Purpose |
| -------- | ------- |
| Spotify  | Account |
| ReccoBeats  | Provides Music Recommendations & Access to an Extensive Music Database |
| MusicBrainz | Music Metadata |

# 3. Try it live
-will insert later-

# 4. Prerequisites
- Git
- Node.js 22.18+ or 24.12+
- pnpm, for the client (`npm i -g pnpm`)
- A MongoDB Atlas connection string (ask the team for access)

# 5. Getting Started
The client and server are separate projects, so each is installed and run in its own terminal.

### 5.1 Clone the repo
```sh
git clone https://github.com/axtcsq/G4T19MetaSix.git
cd G4T19MetaSix
```

### 5.2 Configure the server
Copy the template, then fill in the values:

```sh
cp server/.env.example server/.env
```

| Setting | Where it comes from |
| --- | --- |
| `PORT`, `CLIENT_ORIGIN`, `SPOTIFY_REDIRECT_URI` | Already filled in. Keep `127.0.0.1`: Spotify login doesn't work on `localhost`. |
| `MONGODB_URI` | From the team. It must end in `/metafor_dev`. |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | From the team (the Spotify developer dashboard). |
| `TOKEN_KEY` | From the team. Everyone uses the same value, since it decrypts the Spotify tokens stored in the shared database. |
| `SESSION_SECRET` | Your own: run `openssl rand -hex 32` and paste the result. |
| `DEMO_LOGIN` | `true` shows "Use the test account" on the login page. |

Use the `metafor_dev` database for development and testing. Only the deployed app uses `metafor`. Keep `.env` private; it is ignored by Git. Ask for the shared values in a private message, never in a commit or a group chat.

If a setting seems to be ignored, check that it isn't also set in your terminal (`env | grep -E "MONGODB|CLIENT|SPOTIFY"`). Values already in the terminal win over `.env`, so open a new terminal or `unset` them.

### 5.3 Set up the database
```sh
cd server
npm i
npm run db:init
```

`db:init` creates every collection and its indexes, then lists them. Run it once per database, and again whenever an index is added or changed. It only creates what is missing, so it is safe to re-run. The server does not create indexes on startup.

To add test data, run `npm run db:seed`. It creates a demo user with a year of generated listening history and daily moods. Re-running it replaces the demo user's data.

### 5.4 Run the server
```sh
cd server
npm run dev
```

The API runs at http://127.0.0.1:3000. Check http://127.0.0.1:3000/api/health: it should report `"database": "connected"`.

### 5.5 Run the client
In a second terminal:

```sh
cd client
pnpm i
pnpm dev
```

Open http://127.0.0.1:5173 (not `localhost`). Requests to `/api` are forwarded to the server on port 3000.

To log in, use **Continue with Spotify** if your Spotify email is on the app's user list (ask the team to add it), or **Use the test account**, which has a year of sample listening history but no Spotify connection.

# 6. Database
MetaFor stores everything in MongoDB. Listening history is recorded one play at a time, each song is analysed once and shared by every user, and daily mood summaries are calculated from those plays.

### 6.1 Collections
| Collection | One document is | Notes |
| --- | --- | --- |
| `users` | one Spotify account | Identified by `spotifyId` at login and by `_id` everywhere else. Holds the timezone, the mood lens preference and the sync status. |
| `listens` | one play | Each replay is its own play. A play fetched twice is stored once (unique `userId` + `playedAt`). |
| `tracks` | one song, shared by all users | `_id` is the Spotify track ID. Holds the audio features, lyric scores and both mood readings. |
| `dailyMoods` | one user's moods on one day | Calculated from `listens` and `tracks`. It can be dropped and rebuilt at any time. |
| `syncGaps` | a period where plays may be missing | Written by the sync job. |
| `dailylogs` | one self-reported mood entry | The daily mood log: a mood and an optional journal. |
| `sessions` | one login session | Managed automatically; no model. |

```
users ──1:n──► listens ──n:1──► tracks
users ──1:n──► dailyMoods     (rebuilt from listens + tracks, per user per day)
users ──1:n──► dailylogs, syncGaps
```

The models are in `server/models/`.

### 6.2 Song moods
Every song gets two mood readings, and the user chooses which one the charts show. Both are stored, so switching never needs a recalculation.

| | Sound only | Sound + lyrics (default) |
| --- | --- | --- |
| Based on | valence, energy, danceability, acousticness | the same, plus the lyrics' emotions and themes |
| Possible moods | Euphoric, Uplifting, Breezy, Serene, Melancholic, Cathartic, Bittersweet, Aggressive, Dark and driving | the same nine, plus Deceptively upbeat and Hope in the dark |

The readings are never averaged. *Pumped Up Kicks* is Euphoric by sound alone but Deceptively upbeat with its lyrics, so a day of playing it reads as Happy in one view and Anxious in the other.

### 6.3 From music mood to daily mood
Music moods map onto the daily log's five moods, so what a user played can be compared with how they said they felt. Each row adds up to 1, so every play counts once.

| Music mood | Happy | Relaxed | Sad | Angry | Anxious |
| --- | --- | --- | --- | --- | --- |
| Euphoric, Uplifting | 1 | | | | |
| Breezy, Serene | | 1 | | | |
| Melancholic, Cathartic | | | 1 | | |
| Bittersweet | 0.4 | | 0.6 | | |
| Hope in the dark | 0.5 | | 0.5 | | |
| Aggressive | | | | 1 | |
| Dark and driving, Deceptively upbeat | | | | | 1 |

The Anxious and Hope in the dark rows are still being agreed.

### 6.4 Rules for new features
- Filter every query by the logged-in user's `_id`, never by an ID sent in the request.
- Refer to songs by their Spotify track ID. Look up names, artists and moods in `tracks` instead of copying them.
- Store dates as `"YYYY-MM-DD"` strings in the user's timezone, and timestamps as UTC dates.
- Treat `users`, `listens`, `tracks`, `dailyMoods` and `syncGaps` as read-only, and agree any change with the team first.
- A new collection needs a `userId`, an index starting with `userId`, and an entry in `server/scripts/db-init.js`.
- Store drawings as vector data (paths and points), not images. Atlas's free tier has 512 MB in total.
