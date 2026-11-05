import { dailyMetaphorFor } from "../services/dailyMetaphor.js";

// GET /api/me/metaphor - Home's metaphor of the day: { text, mood, genre, source }. text is null if there's nothing to go on yet.
export async function getDailyMetaphor(req, res) {
  res.json(await dailyMetaphorFor(req.user));
}
