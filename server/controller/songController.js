import Track from "../models/Track.js";
import { blendValence, readMoods } from "../services/mood/mood.js";
import { fetchFeatures } from "../services/analysis.js";
import { searchTracks } from "../services/spotifyAuth.js";

// Spotify track IDs are 22 letters and digits.
function validTrackId(id) {
  return /^[A-Za-z0-9]{22}$/.test(id);
}

// The parts of a Spotify track the search list and the analysis show.
function toSong(track) {
  return {
    id: track.id,
    name: track.name,
    artists: track.artists.map((artist) => artist.name),
    album: {
      name: track.album?.name,
      imageUrl: track.album?.images?.[0]?.url,
    },
  };
}

// The song analysis the landing page shows: the sound, the lyrics, and the
// mood they add up to. lyrics is null when they haven't been analysed.
function toAnalysis(features, lyrics) {
  const { sound, lyrics: withLyrics } = readMoods(features, lyrics);
  const blend = blendValence(features, lyrics);
  const mood = withLyrics ?? sound;
  const found = lyrics?.status === "found" && lyrics.valence != null;

  return {
    mood: { name: mood.name, blurb: mood.blurb, tone: mood.tone },
    features: {
      valence: features.valence,
      energy: features.energy,
      danceability: features.danceability,
    },
    // sound is the melody alone, lyrics the words alone, combined the mix.
    valence: { sound: blend.audio, lyrics: blend.lyrics, combined: blend.valence },
    lyrics: found
      ? {
          weight: blend.weight,
          emotionalShare: lyrics.emotionalShare,
          emotions: lyrics.emotions,
          highlights: lyrics.highlights ?? { positive: [], negative: [] },
        }
      : null,
  };
}

// GET /api/songs/search?q=<words>
// Spotify songs matching the words, for the search suggestions.
export async function searchSongs(req, res) {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (query.length < 2 || query.length > 100) {
    return res
      .status(400)
      .json({ error: "Search for a song or artist (2 to 100 characters)" });
  }

  try {
    const tracks = await searchTracks(query);
    res.json(tracks.map(toSong));
  } catch (error) {
    console.error("[Songs] Spotify search failed:", error.message);
    res.status(502).json({ error: "Spotify search is unavailable. Please try again." });
  }
}

// GET /api/songs/:id/analysis
// Songs already in our database keep their lyric reading. Any other song is
// read from its sound alone, using ReccoBeats' audio features.
export async function getSongAnalysis(req, res) {
  const { id } = req.params;
  if (!validTrackId(id)) {
    return res.status(400).json({ error: "Invalid song ID" });
  }

  const stored = await Track.findById(id, { features: 1, lyrics: 1 }).lean();
  if (stored?.features?.valence != null) {
    return res.json(toAnalysis(stored.features, stored.lyrics));
  }

  try {
    const features = (await fetchFeatures([id])).get(id);
    if (!features) {
      return res
        .status(404)
        .json({ error: "There is no sound data for this song yet. Try another one." });
    }
    res.json(toAnalysis(features, null));
  } catch (error) {
    console.error("[Songs] Analysis failed:", error.message);
    res
      .status(502)
      .json({ error: "The song couldn't be analysed right now. Please try again." });
  }
}
