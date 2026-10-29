import Listen from "../models/Listen.js";
import Track from "../models/Track.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 2000;

function parseDate(value) {
  if (value === undefined) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

// The same shape as Spotify's recently-played items, so the client can read
// either source with the same code. Each item also carries both mood readings,
// leaving out the lyrics one for users who turned lyrics analysis off.
function toItem(listen, track, useLyrics) {
  const id = listen.trackId;
  return {
    played_at: listen.playedAt.toISOString(),
    track: {
      id,
      uri: `spotify:track:${id}`,
      name: track?.name ?? "Unknown track",
      artists: (track?.artists ?? []).map((artist) => ({ id: artist.id, name: artist.name })),
      album: {
        name: track?.album?.name,
        images: track?.album?.imageUrl ? [{ url: track.album.imageUrl }] : [],
      },
      duration_ms: track?.durationMs,
      external_urls: { spotify: `https://open.spotify.com/track/${id}` },
    },
    moods: {
      sound: track?.moods?.sound ?? null,
      lyrics: useLyrics ? (track?.moods?.lyrics ?? null) : null,
      lyricsLanguage: useLyrics && track?.lyrics?.status === "found"
        ? track.lyrics.translatedFrom || "EN"
        : null,
    },
  };
}

// GET /api/listens?from=<ISO date>&to=<ISO date>&limit=50
// The user's plays, newest first. "to" is exclusive, so the next page is
// ?to=<played_at of the last item>.
export async function getListens(req, res) {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const limit = req.query.limit === undefined ? DEFAULT_LIMIT : Number(req.query.limit);

  if (from === undefined || to === undefined) {
    return res.status(400).json({ error: "from and to must be dates" });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return res.status(400).json({ error: `limit must be a whole number from 1 to ${MAX_LIMIT}` });
  }

  const filter = { userId: req.user._id };
  if (from || to) {
    filter.playedAt = {};
    if (from) filter.playedAt.$gte = from;
    if (to) filter.playedAt.$lt = to;
  }

  // One extra row says whether there is another page.
  const listens = await Listen.find(filter, { trackId: 1, playedAt: 1 })
    .sort({ playedAt: -1 })
    .limit(limit + 1)
    .lean();
  const page = listens.slice(0, limit);

  const trackIds = [...new Set(page.map((listen) => listen.trackId))];
  const tracks = await Track.find(
    { _id: { $in: trackIds } },
    { name: 1, artists: 1, album: 1, durationMs: 1, "moods.sound": 1, "moods.lyrics": 1, "lyrics.status": 1, "lyrics.translatedFrom": 1 },
  ).lean();
  const tracksById = new Map(tracks.map((track) => [track._id, track]));
  const useLyrics = req.user.preferences?.moodLens !== "sound";

  res.json({
    items: page.map((listen) => toItem(listen, tracksById.get(listen.trackId), useLyrics)),
    hasMore: listens.length > limit,
  });
}
