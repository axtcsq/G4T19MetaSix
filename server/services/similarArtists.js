// Fetch similar artists from Last.fm, which fills Spotify's related-artist gap.

const API_URL = "https://ws.audioscrobbler.com/2.0/";
const LIMIT = 12;
// Last.fm scores similarity 0 to 1; below this the link is loose.
const MIN_MATCH = 0.15;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 1000;
// Last.fm's error code for an artist it doesn't know.
const ARTIST_NOT_FOUND = 6;
// After any other failure, lookups stop for this long.
const PAUSE_MS = 10 * 60 * 1000;

const cache = new Map();
let pausedUntil = 0;

async function fetchSimilar(artist) {
  const params = new URLSearchParams({
    method: "artist.getsimilar",
    artist,
    autocorrect: "1",
    limit: String(LIMIT),
    api_key: process.env.LASTFM_API_KEY,
    format: "json",
  });
  const response = await fetch(`${API_URL}?${params}`, { signal: AbortSignal.timeout(5000) });
  const body = await response.json();
  if (body.error === ARTIST_NOT_FOUND) return [];
  if (!response.ok || body.error) {
    throw new Error(`Last.fm ${body.error ?? response.status}: ${body.message ?? "request failed"}`);
  }
  return (body.similarartists?.artist ?? [])
    .map((similar) => ({ name: similar.name, match: Number(similar.match) }))
    .filter((similar) => similar.name && similar.match >= MIN_MATCH);
}

// Returns [{ name, match }, ...], most similar first. Each artist gets looked up at most once a week.
export async function similarArtists(name) {
  if (!process.env.LASTFM_API_KEY) return [];
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.similar;
  // While paused, an old answer is better than none.
  if (Date.now() < pausedUntil) return cached?.similar ?? [];

  try {
    const similar = await fetchSimilar(name);
    cache.delete(key);
    cache.set(key, { similar, at: Date.now() });
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return similar;
  } catch (error) {
    pausedUntil = Date.now() + PAUSE_MS;
    console.error(`[Similar] Last.fm lookups paused for 10 minutes after ${name} failed:`, error.message);
    return cached?.similar ?? [];
  }
}
