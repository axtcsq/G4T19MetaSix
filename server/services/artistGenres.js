// Genres for an artist, from their top Last.fm tags. Spotify no longer returns
// artist genres to apps like ours, so Last.fm fills the gap. Without
// LASTFM_API_KEY, or when Last.fm can't be reached, artists have no genres and
// the quizzes use their "no genre" wording.

const API_URL = "https://ws.audioscrobbler.com/2.0/";
const MAX_GENRES = 3;
// Tags used by fewer listeners than this (Last.fm scores 0 to 100) are noise.
const MIN_COUNT = 10;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

// Popular tags that describe the listener or the artist, not the music.
const NOT_GENRES = new Set([
  "seen live",
  "favorites",
  "favourites",
  "favorite",
  "favourite",
  "female vocalists",
  "male vocalists",
  "british",
  "american",
  "uk",
  "usa",
  "english",
  "korean",
  "japanese",
  "australian",
  "canadian",
  "swedish",
  "german",
  "french",
  "irish",
]);

const cache = new Map();

function isGenre(tag) {
  return !NOT_GENRES.has(tag) && !/^\d0s$|^\d{4}s?$/.test(tag);
}

async function fetchGenres(artist) {
  const params = new URLSearchParams({
    method: "artist.gettoptags",
    artist,
    autocorrect: "1",
    api_key: process.env.LASTFM_API_KEY,
    format: "json",
  });
  const response = await fetch(`${API_URL}?${params}`, { signal: AbortSignal.timeout(5000) });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`Last.fm ${body.error ?? response.status}: ${body.message ?? "request failed"}`);
  }

  return (body.toptags?.tag ?? [])
    .filter((tag) => Number(tag.count) >= MIN_COUNT)
    .map((tag) => tag.name.trim().toLowerCase())
    .filter(isGenre)
    .slice(0, MAX_GENRES);
}

// Returns { [artist name]: [genre, ...] }, looking up each artist at most once a week.
export async function artistGenres(names) {
  if (!process.env.LASTFM_API_KEY) {
    return Object.fromEntries(names.map((name) => [name, []]));
  }

  const entries = await Promise.all(
    names.map(async (name) => {
      const cached = cache.get(name);
      if (cached && Date.now() - cached.at < CACHE_MS) return [name, cached.genres];

      try {
        const genres = await fetchGenres(name);
        cache.set(name, { genres, at: Date.now() });
        return [name, genres];
      } catch (error) {
        // Not cached, so the next request tries again.
        console.error(`[Genres] Could not get tags for ${name}:`, error.message);
        return [name, []];
      }
    }),
  );
  return Object.fromEntries(entries);
}
