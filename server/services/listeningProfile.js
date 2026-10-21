import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { genreWord } from "../data/genreWords.js";
import { artistGenres } from "./artistGenres.js";

// Builds the listening profile the quizzes and patterns read, from the user's
// own plays in the listens collection. It keeps the shape of the old mock
// profile (Spotify top artists and tracks, ReccoBeats audio features), so the
// quizzes didn't need to change.

const WINDOW_DAYS = 30;
const TOP_ARTISTS = 5;
// More artists than are shown, so a few untagged artists don't decide the genre.
const GENRE_ARTISTS = 15;
// A genre MetaFor has a word for beats the top genre if it has at least this
// share of the top genre's weight, so a broad tag like "alternative" doesn't
// hide "rock" just behind it.
const NAMED_GENRE_SHARE = 0.5;
const TOP_TRACKS = 6;
const FEATURES = ["energy", "valence", "danceability", "acousticness", "instrumentalness", "speechiness"];

// Each artist's tags count by how much the user played them, so the artist
// they play most has the most say.
function topGenre(rankedArtists, genres) {
  const totals = new Map();
  for (const [name, plays] of rankedArtists) {
    for (const genre of genres[name]) {
      totals.set(genre.name, (totals.get(genre.name) ?? 0) + plays * genre.weight);
    }
  }

  const ranked = [...totals].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;

  const [top, topWeight] = ranked[0];
  const named = ranked.find(([genre, weight]) => genreWord(genre) && weight >= topWeight * NAMED_GENRE_SHARE);
  return named?.[0] ?? top;
}

// The Personality page asks for several quiz routes at once, and each needs
// the profile. Each user's profile is kept briefly so they share one build.
const PROFILE_CACHE_MS = 60 * 1000;
const profiles = new Map();

export function buildListeningProfile(user) {
  const key = user._id.toString();
  const cached = profiles.get(key);
  if (cached && Date.now() - cached.at < PROFILE_CACHE_MS) return cached.profile;

  const profile = loadListeningProfile(user);
  profiles.set(key, { profile, at: Date.now() });
  // A failed build isn't kept, so the next request tries again.
  profile.catch(() => profiles.delete(key));
  // Drop expired entries so the Map doesn't grow with every user.
  for (const [otherKey, entry] of profiles) {
    if (Date.now() - entry.at >= PROFILE_CACHE_MS) profiles.delete(otherKey);
  }
  return profile;
}

async function loadListeningProfile(user) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const plays = await Listen.aggregate([
    { $match: { userId: user._id, playedAt: { $gte: since } } },
    { $group: { _id: "$trackId", plays: { $sum: 1 }, lastPlayed: { $max: "$playedAt" } } },
    { $sort: { plays: -1, lastPlayed: -1 } },
  ]);

  const tracks = await Track.find(
    { _id: { $in: plays.map((play) => play._id) } },
    { name: 1, artists: 1, features: 1 },
  ).lean();
  const tracksById = new Map(tracks.map((track) => [track._id, track]));

  const artistPlays = new Map();
  for (const play of plays) {
    for (const artist of tracksById.get(play._id)?.artists ?? []) {
      artistPlays.set(artist.name, (artistPlays.get(artist.name) ?? 0) + play.plays);
    }
  }

  const topTracks = plays
    .map((play) => tracksById.get(play._id))
    .filter(Boolean)
    .slice(0, TOP_TRACKS)
    .map((track) => ({
      name: track.name,
      artist: track.artists?.[0]?.name ?? "Unknown artist",
      ...Object.fromEntries(FEATURES.map((feature) => [feature, track.features?.[feature] ?? null])),
    }));

  const totalPlays = plays.reduce((sum, play) => sum + play.plays, 0);
  const firstPlay = await Listen.findOne({ userId: user._id }, { playedAt: 1 }).sort({ playedAt: 1 }).lean();
  const rankedArtists = [...artistPlays].sort((a, b) => b[1] - a[1]).slice(0, GENRE_ARTISTS);
  const genres = await artistGenres(rankedArtists.map(([name]) => name));
  const topArtistNames = rankedArtists.slice(0, TOP_ARTISTS).map(([name]) => name);

  return {
    displayName: user.displayName,
    // Genres come from Last.fm tags, since Spotify no longer returns them.
    topArtists: topArtistNames.map((name) => ({ name, genres: genres[name].map((genre) => genre.name) })),
    topGenre: topGenre(rankedArtists, genres),
    topTracks,
    // Playlist names aren't stored, so Maslow's Mixtape uses the answers alone.
    playlists: [],
    // Share of plays that were a song already played in the window.
    repeatListenRatio: totalPlays ? (totalPlays - plays.length) / totalPlays : null,
    // How much listening there is to go on, so a new account's first day of
    // plays doesn't count as much as weeks of them.
    history: {
      days: firstPlay ? (Date.now() - firstPlay.playedAt.getTime()) / (24 * 60 * 60 * 1000) : 0,
      plays: totalPlays,
    },
  };
}
