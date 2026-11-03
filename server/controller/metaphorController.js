import { dailyMetaphorFor } from "../services/dailyMetaphor.js";

// GET /api/me/metaphor
// Home's metaphor of the day for this user: { text, mood, genre, source }.
// text is null when there's nothing to go on yet.
export async function getDailyMetaphor(req, res) {
  res.json(await dailyMetaphorFor(req.user));
}
