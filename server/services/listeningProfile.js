import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { artistGenres } from "./artistGenres.js";

// Builds the listening profile the quizzes and patterns read, from the user's
// own plays in the listens collection. It keeps the shape of the old mock
// profile (Spotify top artists and tracks, ReccoBeats audio features), so the
// quizzes didn't need to change.

const WINDOW_DAYS = 30;
const TOP_ARTISTS = 5;
const TOP_TRACKS = 6;
const FEATURES = ["energy", "valence", "danceability", "acousticness", "instrumentalness", "speechiness"];

export async function buildListeningProfile(user) {
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
  const topArtistNames = [...artistPlays]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ARTISTS)
    .map(([name]) => name);
  const genres = await artistGenres(topArtistNames);

  return {
    displayName: user.displayName,
    // Genres come from Last.fm tags, since Spotify no longer returns them.
    topArtists: topArtistNames.map((name) => ({ name, genres: genres[name] })),
    topTracks,
    // Playlist names aren't stored, so Maslow's Mixtape uses the answers alone.
    playlists: [],
    // Share of plays that were a song already played in the window.
    repeatListenRatio: totalPlays ? (totalPlays - plays.length) / totalPlays : null,
  };
}
