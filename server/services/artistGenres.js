// Genres for an artist, from their top Last.fm tags. Spotify no longer returns
// artist genres to apps like ours, so Last.fm fills the gap. Without
// LASTFM_API_KEY, or when Last.fm can't be reached, artists have no genres and
// the quizzes use their "no genre" wording.

const API_URL = "https://ws.audioscrobbler.com/2.0/";
const MAX_GENRES = 3;
// Tags used by fewer listeners than this (Last.fm scores 0 to 100) are noise.
const MIN_COUNT = 10;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
// Lookups run a few at a time, to stay within Last.fm's rate limit.
const BATCH_SIZE = 5;
// Last.fm's error code for an artist it doesn't know.
const ARTIST_NOT_FOUND = 6;
// After any other failure (Last.fm down, rate limited, a bad key), lookups stop
// for this long, so one outage doesn't slow down every quiz request.
const PAUSE_MS = 10 * 60 * 1000;

// Popular tags that describe the listener or the artist, not the music.
const NOT_GENRES = new Set([
  "seen live",
  "favorites",
  "favourites",
  "favorite",
  "favourite",
  "female vocalists",
  "female vocalist",
  "male vocalists",
  "male vocalist",
  "my top songs",
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
  "italian",
  "spanish",
  "dutch",
  "germany",
  "japan",
  "korea",
]);

const cache = new Map();
let pausedUntil = 0;

function isGenre(tag) {
  return tag.length > 2 && !NOT_GENRES.has(tag) && !/^\d0s$|^\d{4}s?$/.test(tag);
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
  // An artist Last.fm doesn't know simply has no genres.
  if (body.error === ARTIST_NOT_FOUND) return [];
  if (!response.ok || body.error) {
    throw new Error(`Last.fm ${body.error ?? response.status}: ${body.message ?? "request failed"}`);
  }

  // weight is how strongly Last.fm listeners tie the tag to the artist, 0 to 1.
  return (body.toptags?.tag ?? [])
    .filter((tag) => Number(tag.count) >= MIN_COUNT)
    .map((tag) => ({ name: tag.name.trim().toLowerCase(), weight: Number(tag.count) / 100 }))
    .filter((tag) => isGenre(tag.name))
    .slice(0, MAX_GENRES);
}

async function genresFor(name) {
  const cached = cache.get(name);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.genres;
  // While paused, an old answer is better than none.
  if (Date.now() < pausedUntil) return cached?.genres ?? [];

  try {
    const genres = await fetchGenres(name);
    cache.set(name, { genres, at: Date.now() });
    return genres;
  } catch (error) {
    pausedUntil = Date.now() + PAUSE_MS;
    console.error(`[Genres] Last.fm lookups paused for 10 minutes after ${name} failed:`, error.message);
    return cached?.genres ?? [];
  }
}

// Returns { [artist name]: [{ name, weight }, ...] }, looking up each artist at
// most once a week.
export async function artistGenres(names) {
  if (!process.env.LASTFM_API_KEY) {
    return Object.fromEntries(names.map((name) => [name, []]));
  }

  const result = {};
  for (let start = 0; start < names.length; start += BATCH_SIZE) {
    const batch = names.slice(start, start + BATCH_SIZE);
    const genres = await Promise.all(batch.map(genresFor));
    batch.forEach((name, index) => {
      result[name] = genres[index];
    });
  }
  return result;
}
