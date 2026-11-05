import DailyMood from "../models/DailyMood.js";
import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { MOOD_NAMES } from "../services/mood/axes.js";
import { moodSlug } from "../services/mood/index.js";
import { journalMoodsByDay, overallMood } from "../services/overallMood.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 2000;

function parseDate(value) {
  if (value === undefined) {
    return null;
  }
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

// Format saved plays for the client, including available mood readings.
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
      instrumentalness: track?.features?.instrumentalness ?? null,
      lyricsLanguage: useLyrics && track?.lyrics?.status === "found"
        ? track.lyrics.translatedFrom || "EN"
        : null,
    },
  };
}

// GET /api/listens: return the user's plays, newest first.
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
    { name: 1, artists: 1, album: 1, durationMs: 1, "features.instrumentalness": 1, "moods.sound": 1, "moods.lyrics": 1, "lyrics.status": 1, "lyrics.translatedFrom": 1 },
  ).lean();
  const tracksById = new Map(tracks.map((track) => [track._id, track]));
  const useLyrics = req.user.preferences?.moodLens !== "sound";

  res.json({
    items: page.map((listen) => toItem(listen, tracksById.get(listen.trackId), useLyrics)),
    hasMore: listens.length > limit,
  });
}

const EMOTIONS = ["joy", "sadness", "anger", "fear", "disgust", "surprise", "neutral"];
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/listens/overall-mood - journal + listening mood from `from` to `to` (YYYY-MM-DD, inclusive)
export async function getOverallMood(req, res) {
  const { from, to } = req.query;
  if (!LOCAL_DATE.test(from ?? "") || !LOCAL_DATE.test(to ?? "") || from > to) {
    return res.status(400).json({ error: "from and to must be dates like 2026-10-26" });
  }
  const { days, ...summary } = await overallMood(req.user, { from, to });
  // Each day's own blend, for the calendar's faces.
  res.json({ ...summary, days: days.map(({ date, main }) => ({ date, main })) });
}

// GET /api/listens/insights: daily music moods and lyric emotions for a date range.
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
  // Plays with a mood in this reading. No sound data means lyrics reading only.
  const analysedIn = (day) => day.analysedCount + (lens === "lyrics" ? (day.lyrics?.lyricsOnlyCount ?? 0) : 0);
  const days = dailyMoods.map((day) => ({
    date: day.date,
    listenCount: day.listenCount,
    analysedCount: analysedIn(day),
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
  const analysedPlays = dailyMoods.reduce((sum, day) => sum + analysedIn(day), 0);

  // What they mostly played on days they journalled each mood. A day counts for every mood logged, not just the last.
  const journalMoods = await journalMoodsByDay(req.user, from, to);
  const daysByJournalMood = new Map();
  for (const day of dailyMoods) {
    if (!analysedIn(day)) continue;
    for (const mood of new Set(journalMoods.get(day.date))) {
      daysByJournalMood.set(mood, [...(daysByJournalMood.get(mood) ?? []), day]);
    }
  }
  const journal = [...daysByJournalMood].map(([mood, list]) => {
    const [top] = countMoods(list);
    const plays = list.reduce((sum, day) => sum + analysedIn(day), 0);
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
