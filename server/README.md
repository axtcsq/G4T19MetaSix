# MetaFor server

The server is an Express API. It uses Mongoose to read and write mood logs in MongoDB.

## Files

- `index.js` loads environment variables and starts the HTTP server.
- `app.js` configures CORS, JSON parsing, health checks, routes, and error responses.
- `config/db.js` opens and reuses the MongoDB connection.
- `routes/moodRoutes.js` maps mood URLs to controller functions.
- `controller/moodController.js` validates requests and chooses HTTP responses.
- `models/MoodLog.js` defines the MongoDB schema and mood log queries.

## Configuration

Create a `.env` file in this folder with the MongoDB connection string:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
```

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

## Run

```sh
npm install
npm run dev
```
