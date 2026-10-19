import DailyMood from "../models/DailyMood.js";
import Listen from "../models/Listen.js";
import Track from "../models/Track.js";
import { AXES, AXES_VERSION, axesOf } from "./mood/axes.js";
import { MOOD_VERSION, moodSlug } from "./mood/index.js";

const HAS_MOOD = ["done", "partial"];

function emptyReading() {
  return {
    moodCounts: {},
    axes: Object.fromEntries(AXES.map((axis) => [axis, 0])),
  };
}

function countPlay(reading, moodName) {
  const slug = moodSlug(moodName);
  reading.moodCounts[slug] = (reading.moodCounts[slug] ?? 0) + 1;

  for (const [axis, weight] of Object.entries(axesOf(moodName))) {
    reading.axes[axis] += weight;
  }
}

// Rebuilds one user's dailyMoods from their listens and the tracks' moods.
// Pass dates ("YYYY-MM-DD") to rebuild only those days; omit them to rebuild
// every day. Days with no listens left are removed.
export async function rebuildDailyMoods(userId, dates) {
  const filter = { userId };
  if (dates) {
    filter.localDate = { $in: dates };
  }

  const listens = await Listen.find(filter, { trackId: 1, localDate: 1 }).lean();
  const trackIds = [...new Set(listens.map((listen) => listen.trackId))];
  const tracks = await Track.find(
    { _id: { $in: trackIds } },
    { moods: 1, "analysis.status": 1 },
  ).lean();
  const tracksById = new Map(tracks.map((track) => [track._id, track]));

  const days = new Map();
  for (const listen of listens) {
    let day = days.get(listen.localDate);
    if (!day) {
      day = {
        listenCount: 0,
        analysedCount: 0,
        sound: emptyReading(),
        lyrics: { ...emptyReading(), fallbackCount: 0 },
      };
      days.set(listen.localDate, day);
    }

    day.listenCount += 1;

    const track = tracksById.get(listen.trackId);
    const moods = track?.moods;
    if (!HAS_MOOD.includes(track?.analysis?.status) || !moods?.sound) {
      continue;
    }

    day.analysedCount += 1;
    countPlay(day.sound, moods.sound.name);
    // Pending lyrics count under the sound reading until a retry works.
    countPlay(day.lyrics, (moods.lyrics ?? moods.sound).name);
    if (!moods.lyrics) {
      day.lyrics.fallbackCount += 1;
    }
  }

  const computedAt = new Date();
  const writes = [...days].map(([date, day]) => ({
    replaceOne: {
      filter: { userId, date },
      replacement: {
        userId,
        date,
        ...day,
        moodVersion: MOOD_VERSION,
        axesVersion: AXES_VERSION,
        computedAt,
      },
      upsert: true,
    },
  }));

  const emptyDates = dates ? dates.filter((date) => !days.has(date)) : null;
  writes.push({
    deleteMany: {
      filter: emptyDates
        ? { userId, date: { $in: emptyDates } }
        : { userId, date: { $nin: [...days.keys()] } },
    },
  });

  await DailyMood.bulkWrite(writes, { ordered: false });
  return days.size;
}
