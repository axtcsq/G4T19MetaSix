import { PICKS, TARGETS, recommendSongs } from "../services/recommendations.js";

const MAX_ARTISTS = 5;
const MAX_EXCLUDED = 2000;
const MAX_PAGE = 100;
const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/;
// Each request can search Spotify for up to 8 artists, so users wait between requests or repeat clicks could get us blocked
const COOLDOWN_MS = 3000;

const isCount = (value) => Number.isInteger(value) && value >= 0 && value <= PICKS;

// POST /api/recommendations: return tracks matching the requested mood.
export async function getRecommendations(req, res) {
  const { target, artists, mix, exclude = [], page = 0 } = req.body ?? {};
  const validArtists =
    Array.isArray(artists) &&
    artists.length >= 1 &&
    artists.length <= MAX_ARTISTS &&
    artists.every(
      (artist) =>
        typeof artist?.name === "string" &&
        artist.name.trim().length >= 1 &&
        artist.name.length <= 200 &&
        Number.isFinite(artist.plays) &&
        artist.plays > 0,
    );
  if (
    !TARGETS.includes(target) ||
    !validArtists ||
    !isCount(mix?.vocal) ||
    !isCount(mix?.instrumental) ||
    !Array.isArray(exclude) ||
    exclude.length > MAX_EXCLUDED ||
    !exclude.every((id) => SPOTIFY_ID.test(id)) ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > MAX_PAGE
  ) {
    return res.status(400).json({ error: "Invalid recommendation request" });
  }

  const now = Date.now();
  if (now - (req.session.recommendationsAt ?? 0) < COOLDOWN_MS) {
    return res.status(429).json({ error: "Please wait a few seconds before refreshing again." });
  }
  req.session.recommendationsAt = now;

  try {
    const tracks = await recommendSongs({
      target,
      artists: artists.map((artist) => ({ name: artist.name.trim(), plays: artist.plays })),
      mix,
      exclude,
      page,
      // Match on the reading the user sees: with the lyrics, or the sound alone.
      useLyrics: req.user.preferences?.moodLens !== "sound",
      userId: req.user._id,
    });
    res.json({ tracks });
  } catch (error) {
    console.error("[recommendations] Failed:", error.message);
    if (error.status === 429) {
      return res.status(503).json({ error: "Song suggestions are busy right now. Please try again later." });
    }
    res.status(502).json({ error: "Song suggestions are unavailable. Please try again." });
  }
}
