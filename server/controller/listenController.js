import DailyMood from "../models/DailyMood.js";
import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { MOOD_NAMES } from "../services/mood/axes.js";
import { moodSlug } from "../services/mood/index.js";
import { moodByDay } from "../services/moodMusic.js";

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
// either source with the same code. Each item also carries both mood readings.
function toItem(listen, track) {
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
      lyrics: track?.moods?.lyrics ?? null,
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
    { name: 1, artists: 1, album: 1, durationMs: 1, "moods.sound": 1, "moods.lyrics": 1 },
  ).lean();
  const tracksById = new Map(tracks.map((track) => [track._id, track]));

  res.json({
    items: page.map((listen) => toItem(listen, tracksById.get(listen.trackId))),
    hasMore: listens.length > limit,
  });
}

const EMOTIONS = ["joy", "sadness", "anger", "fear", "disgust", "surprise", "neutral"];
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/listens/insights?from=YYYY-MM-DD&to=YYYY-MM-DD
// The dashboard's mood panels for those days (both included):
// - days: each day's music moods, on the daily log's five moods
// - emotions: the average lyric emotions of the songs played, weighted by plays
export async function getMoodInsights(req, res) {
  const { from, to } = req.query;
  if (!LOCAL_DATE.test(from ?? "") || !LOCAL_DATE.test(to ?? "")) {
    return res.status(400).json({ error: "from and to must be dates like 2026-10-26" });
  }

  const userId = req.user._id;
  const dates = { $gte: from, $lte: to };
  // The user's chosen reading: with the lyrics blended in, or the sound alone.
  const lens = req.user.preferences?.moodLens ?? "lyrics";

  const dailyMoods = await DailyMood.find({ userId, date: dates })
    .sort({ date: 1 })
    .lean();
  const days = dailyMoods.map((day) => ({
    date: day.date,
    listenCount: day.listenCount,
    analysedCount: day.analysedCount,
    axes: day[lens]?.axes ?? {},
  }));

  // How often each song was played in the period.
  const plays = await Listen.aggregate([
    { $match: { userId, localDate: dates } },
    { $group: { _id: "$trackId", count: { $sum: 1 } } },
  ]);
  const playsById = new Map(plays.map((play) => [play._id, play.count]));
  const tracks = await Track.find(
    { _id: { $in: [...playsById.keys()] }, "lyrics.status": "found" },
    { "lyrics.emotions": 1 },
  ).lean();

  const totals = Object.fromEntries(EMOTIONS.map((emotion) => [emotion, 0]));
  let weight = 0;
  for (const track of tracks) {
    const count = playsById.get(track._id);
    for (const emotion of EMOTIONS) {
      totals[emotion] += (track.lyrics.emotions?.[emotion] ?? 0) * count;
    }
    weight += count;
  }

  // The whole period's music moods, most played first.
  const nameBySlug = new Map(MOOD_NAMES.map((name) => [moodSlug(name), name]));
  const countMoods = (list) => {
    const counts = new Map();
    for (const day of list) {
      for (const [slug, count] of Object.entries(day[lens]?.moodCounts ?? {})) {
        const name = nameBySlug.get(slug) ?? slug;
        counts.set(name, (counts.get(name) ?? 0) + count);
      }
    }
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };
  const analysedPlays = dailyMoods.reduce((sum, day) => sum + day.analysedCount, 0);

  // For each mood the user journalled, what they mostly played on those days.
  const journalMoods = await moodByDay(userId, req.user.timezone);
  const daysByJournalMood = new Map();
  for (const day of dailyMoods) {
    const mood = journalMoods.get(day.date);
    if (!mood || !day.analysedCount) continue;
    daysByJournalMood.set(mood, [...(daysByJournalMood.get(mood) ?? []), day]);
  }
  const journal = [...daysByJournalMood].map(([mood, list]) => {
    const [top] = countMoods(list);
    const plays = list.reduce((sum, day) => sum + day.analysedCount, 0);
    return { mood, days: list.length, musicMood: top.name, share: top.count / plays };
  });

  res.json({
    lens,
    days,
    analysedPlays,
    musicMoods: countMoods(dailyMoods),
    journal,
    emotions: weight
      ? Object.fromEntries(EMOTIONS.map((emotion) => [emotion, totals[emotion] / weight]))
      : null,
    // Plays of songs whose lyrics were read, out of all plays.
    lyricPlays: weight,
    totalPlays: plays.reduce((sum, play) => sum + play.count, 0),
  });
}
