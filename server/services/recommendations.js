// Songs the mood calendar suggests to shift a month's listening mood. They come
// from artists similar to the ones the user played most (Last.fm), and are kept
// only when their sound reads as the mood being suggested, by the same rules
// that tag every other song.
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

const defaultDeps = { similarArtists, searchTracks, fetchFeatures, saveSongs };

const sameName = (a, b) => a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;

// Artists to search, taking each top artist's next most similar artist in turn
// so all of them are represented. The user's own artists aren't suggested back,
// unless Last.fm has nothing, when they're all there is.
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

// Saves the picks with their sound mood, as a searched song's would be, so
// their tags and song pages work straight away. The analysis job adds lyrics.
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

/**
 * Up to four songs whose sound matches `target`, by artists similar to `artists`
 * ([{ name, plays }], the month's most played). `mix` is { vocal, instrumental };
 * `exclude` lists track IDs not to suggest; `page` moves on to other artists.
 */
export async function recommendSongs({ target, artists, mix, exclude = [], page = 0 }, deps = defaultDeps) {
  const queue = await artistQueue(artists, deps);
  if (!queue.length) return [];
  const start = (page * ARTISTS_PER_PAGE) % queue.length;
  const searched = Array.from(
    { length: Math.min(ARTISTS_PER_PAGE, queue.length) },
    (_, index) => queue[(start + index) % queue.length],
  );

  const songs = await candidateSongs(searched, exclude, deps);
  const features = new Map();
  for (let index = 0; index < songs.length; index += FEATURES_BATCH) {
    const batch = songs.slice(index, index + FEATURES_BATCH).map((song) => song.track.id);
    for (const [id, songFeatures] of await deps.fetchFeatures(batch)) features.set(id, songFeatures);
  }

  // Songs ReccoBeats has no sound data for can't be checked, so they're left out.
  const matches = songs
    .filter((song) => features.has(song.track.id))
    .map((song) => ({ ...song, features: features.get(song.track.id) }))
    .filter((song) => quadrantOf(song.features) === target)
    .map((song) => ({ ...song, instrumental: song.features.instrumentalness >= INSTRUMENTAL }));

  const picks = choose(matches, mix);
  if (picks.length) await deps.saveSongs(picks);

  return picks.map(({ track, artist, features: songFeatures, instrumental }) => {
    const { name, family } = trackMoods(songFeatures).sound;
    return {
      id: track.id,
      name: track.name,
      artists: (track.artists ?? []).map((a) => a.name),
      imageUrl: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? null,
      spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
      because: artist.because,
      instrumental,
      mood: { name, family },
    };
  });
}
