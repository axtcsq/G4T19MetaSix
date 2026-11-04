// Find mood-matched songs by artists similar to the user's top artists.
import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { fetchFeatures } from "./analysis.js";
import { MOOD_VERSION, trackMoods } from "./mood/index.js";
import { quadrantOf } from "./mood/mood.js";
import { fromSpotify } from "./mood/sound.js";
import { similarArtists } from "./similarArtists.js";
import { searchTracks } from "./spotifyAuth.js";

// Moods the calendar suggests: "happy" after a sad month, "calm" after a tense one.
export const TARGETS = ["happy", "calm"];
export const PICKS = 4;
// One Spotify search per artist, so this caps the searches per request.
const ARTISTS_PER_PAGE = 8;
// Songs considered per artist, most popular first. Spotify caps search at 10.
const SEARCH_LIMIT = 10;
const SONGS_PER_ARTIST = 5;
// ReccoBeats answers up to 40 songs per request.
const FEATURES_BATCH = 40;
const INSTRUMENTAL = 0.5;
// New sound-matched songs saved for the analysis job per request, to keep its queue small.
const QUEUED_PER_REQUEST = PICKS * 2;
// Stored songs considered when the searched ones don't fill the picks.
const FILL_CANDIDATES = 40;

export const defaultDeps = { similarArtists, searchTracks, fetchFeatures, storedSongs, analysedSongs, listeningHistory, saveSongs };

const sameName = (a, b) => a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;

// Build a balanced list of similar artists, excluding the user's artists when possible.
async function artistQueue(seeds, deps) {
  const lists = await Promise.all(seeds.map((seed) => deps.similarArtists(seed.name)));
  const seen = new Set(seeds.map((seed) => seed.name.toLowerCase()));
  const queue = [];
  for (let round = 0; lists.some((list) => round < list.length); round++) {
    lists.forEach((list, index) => {
      const similar = list[round];
      if (!similar || seen.has(similar.name.toLowerCase())) return;
      seen.add(similar.name.toLowerCase());
      const seed = seeds[index];
      queue.push({ name: similar.name, because: `Similar to ${seed.name}`, weight: seed.plays * similar.match });
    });
  }
  if (queue.length) return queue;
  return seeds.map((seed) => ({ name: seed.name, because: `From ${seed.name}`, weight: seed.plays }));
}

// Each artist's most popular songs the user hasn't played or been shown. The
// searches run one at a time; if Spotify rate-limits us, the rest are skipped.
async function candidateSongs(artists, exclude, deps) {
  const seen = new Set(exclude);
  const songs = [];
  for (const artist of artists) {
    let tracks;
    try {
      tracks = await deps.searchTracks(`artist:"${artist.name.replaceAll('"', "")}"`, SEARCH_LIMIT);
    } catch (error) {
      if (error.status === 429 && !songs.length) throw error;
      if (error.status === 429) break;
      console.warn(`[recommendations] Search for ${artist.name} failed:`, error.message);
      continue;
    }
    tracks
      .filter((track) => track.id && !seen.has(track.id) && track.artists?.some((a) => sameName(a.name, artist.name)))
      .slice(0, SONGS_PER_ARTIST)
      .forEach((track) => {
        seen.add(track.id);
        songs.push({ track, artist });
      });
  }
  return songs;
}

// Up to PICKS songs: one per artist before any artist gets a second, the most
// relevant artists first, and the vocal/instrumental split asked for when the
// matches allow it.
function choose(matches, mix) {
  const ordered = [...matches].sort((a, b) => b.artist.weight - a.artist.weight);
  const wanted = { ...mix };
  const picks = [];
  const used = new Set();
  const take = (song) => {
    picks.push(song);
    used.add(song.track.id);
  };
  const artistsPicked = () => new Set(picks.map((song) => song.artist.name));

  for (const song of ordered) {
    const type = song.instrumental ? "instrumental" : "vocal";
    if (picks.length < PICKS && wanted[type] > 0 && !artistsPicked().has(song.artist.name)) {
      wanted[type] -= 1;
      take(song);
    }
  }
  for (const song of ordered) {
    if (picks.length < PICKS && !used.has(song.track.id) && !artistsPicked().has(song.artist.name)) take(song);
  }
  for (const song of ordered) {
    if (picks.length < PICKS && !used.has(song.track.id)) take(song);
  }
  return picks;
}

// What's already stored about these songs, keyed by ID.
async function storedSongs(ids) {
  const tracks = await Track.find(
    { _id: { $in: ids } },
    { moods: 1, "analysis.status": 1, "features.instrumentalness": 1, "lyrics.status": 1 },
  ).lean();
  return new Map(tracks.map((track) => [track._id, track]));
}

// The reading the user sees, once both the sound and the lyrics have been read.
// Songs with no sound data only have a lyrics reading, so they need lyrics on.
function analysedMood(track, useLyrics) {
  if (track?.analysis?.status !== "done") return null;
  return (useLyrics ? track.moods?.lyrics : track.moods?.sound) ?? null;
}

// Fully analysed songs in this mood by these artists, from the database, in random
// order so refreshes vary.
async function analysedSongs({ artists, family, useLyrics, exclude, limit }) {
  if (!artists.length) return [];
  const reading = useLyrics ? "moods.lyrics.family" : "moods.sound.family";
  return Track.aggregate([
    { $match: { _id: { $nin: exclude }, "analysis.status": "done", [reading]: family, "artists.name": { $in: artists } } },
    { $sample: { size: limit } },
    { $project: { name: 1, artists: 1, album: 1, moods: 1, "features.instrumentalness": 1, "lyrics.status": 1, analysis: 1 } },
  ]);
}

// Every artist the user has listened to, and every song they've played.
async function listeningHistory(userId) {
  const played = await Listen.distinct("trackId", { userId });
  const artists = await Track.distinct("artists.name", { _id: { $in: played } });
  return { artists, played: new Set(played) };
}

// A stored song in the same shape as a Spotify search result, credited to the
// similar artist it's by, or else to the user's own artist.
function fromStore(track, queue, played) {
  const names = new Set(track.artists?.map((artist) => artist.name.toLowerCase()));
  const own = track.artists?.[0]?.name ?? "";
  const artist = queue.find((entry) => names.has(entry.name.toLowerCase())) ?? {
    name: own,
    because: `From ${own}`,
    // After every similar artist; songs the user has never played come first.
    weight: played?.has(track._id) ? -2 : -1,
  };
  return {
    track: {
      id: track._id,
      name: track.name,
      artists: track.artists ?? [],
      album: { images: track.album?.imageUrl ? [{ url: track.album.imageUrl }] : [] },
      external_urls: { spotify: `https://open.spotify.com/track/${track._id}` },
    },
    artist,
  };
}

// A pick with its stored mood, or null unless it's fully analysed and in the target mood.
function toMatch(song, track, target, useLyrics) {
  const mood = analysedMood(track, useLyrics);
  if (mood?.family !== target) return null;
  const instrumental =
    track.lyrics?.status === "instrumental" || (track.features?.instrumentalness ?? 0) >= INSTRUMENTAL;
  return { ...song, mood: { name: mood.name, family: mood.family }, instrumental };
}

// Saves sound-matched songs that haven't been analysed yet, so the analysis job
// reads their lyrics and a later refresh can suggest them.
async function saveSongs(picks) {
  await Track.bulkWrite(
    picks.map(({ track, features }) => ({
      updateOne: {
        filter: { _id: track.id },
        update: {
          $setOnInsert: {
            ...fromSpotify(track),
            features: { ...features, sourceId: track.id },
            moods: { sound: trackMoods(features).sound, lyrics: null, version: MOOD_VERSION },
            analysis: { status: "pending", attempts: 0 },
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

/** Recommend up to four mood-matched songs, all fully analysed (sound and lyrics). */
export async function recommendSongs(
  { target, artists, mix, exclude = [], page = 0, useLyrics = true, userId },
  deps = defaultDeps,
) {
  const queue = await artistQueue(artists, deps);
  if (!queue.length) return [];
  const start = (page * ARTISTS_PER_PAGE) % queue.length;
  const searched = Array.from(
    { length: Math.min(ARTISTS_PER_PAGE, queue.length) },
    (_, index) => queue[(start + index) % queue.length],
  );

  const songs = await candidateSongs(searched, exclude, deps);
  const stored = await deps.storedSongs(songs.map((song) => song.track.id));

  // Only songs whose analysis is finished are suggested, matched on their stored mood.
  const matches = songs.map((song) => toMatch(song, stored.get(song.track.id), target, useLyrics)).filter(Boolean);
  let picks = choose(matches, mix);

  // Too few of the searched songs are analysed: fill up from the database, first
  // with any similar artist's songs, then with songs by artists the user listens to.
  const considered = [...exclude, ...songs.map((song) => song.track.id)];
  const fill = async (fromArtists, played) => {
    const tracks = await deps.analysedSongs({
      artists: fromArtists,
      family: target,
      useLyrics,
      exclude: [...new Set([...considered, ...matches.map((song) => song.track.id)])],
      limit: FILL_CANDIDATES,
    });
    matches.push(...tracks.map((track) => toMatch(fromStore(track, queue, played), track, target, useLyrics)).filter(Boolean));
    picks = choose(matches, mix);
  };
  if (picks.length < PICKS) await fill(queue.map((artist) => artist.name));
  if (picks.length < PICKS && userId) {
    const history = await deps.listeningHistory(userId);
    await fill(history.artists, history.played);
  }

  // New songs whose sound fits are queued for analysis, so later refreshes have more to pick from.
  const unseen = songs.filter((song) => !stored.has(song.track.id));
  const features = new Map();
  for (let index = 0; index < unseen.length; index += FEATURES_BATCH) {
    const batch = unseen.slice(index, index + FEATURES_BATCH).map((song) => song.track.id);
    try {
      for (const [id, songFeatures] of await deps.fetchFeatures(batch)) features.set(id, songFeatures);
    } catch (error) {
      // Queueing is a bonus; the analysed picks are still worth returning.
      console.warn("[recommendations] Couldn't fetch features to queue songs:", error.message);
      break;
    }
  }
  // Songs ReccoBeats has no sound data for can't be checked, so they're left out.
  const toQueue = unseen
    .filter((song) => features.has(song.track.id))
    .map((song) => ({ ...song, features: features.get(song.track.id) }))
    .filter((song) => quadrantOf(song.features) === target)
    .slice(0, QUEUED_PER_REQUEST);
  if (toQueue.length) await deps.saveSongs(toQueue);

  return picks.map(({ track, artist, mood, instrumental }) => ({
    id: track.id,
    name: track.name,
    artists: (track.artists ?? []).map((a) => a.name),
    imageUrl: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? null,
    spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
    because: artist.because,
    instrumental,
    mood,
  }));
}
