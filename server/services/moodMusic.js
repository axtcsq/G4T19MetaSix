import Listen from "../models/Listen.js";
import { MOODS, retrieveMoodLogs } from "../models/MoodLog.js";
import { AXES, axesOf, strongestAxis } from "./mood/axes.js";

// Day by day, how the user felt next to how happy their music sounded, for the
// Mood × music chart on the Personality page.

const DAYS = 14;

function localDateOf(date, timezone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(date);
}

// The last DAYS dates in the user's timezone, oldest first.
function recentDates(timezone) {
  const dates = [];
  for (let back = DAYS - 1; back >= 0; back--) {
    dates.push(localDateOf(new Date(Date.now() - back * 24 * 60 * 60 * 1000), timezone));
  }
  return dates;
}

// Average valence (0 to 1) of each day's plays, for plays whose track has it.
async function happinessByDay(userId, dates) {
  const days = await Listen.aggregate([
    { $match: { userId, localDate: { $gte: dates[0], $lte: dates.at(-1) } } },
    { $lookup: { from: "tracks", localField: "trackId", foreignField: "_id", as: "track" } },
    { $unwind: "$track" },
    { $match: { "track.features.valence": { $type: "number" } } },
    {
      $group: {
        _id: "$localDate",
        happiness: { $avg: "$track.features.valence" },
        plays: { $sum: 1 },
      },
    },
  ]);
  return new Map(days.map((day) => [day._id, day]));
}

// Plays per music mood per day, for songs the mood analysis has read. The
// lyrics reading is used unless the user turned it off, falling back to the
// sound reading while a song's lyrics are pending.
async function musicMoodsByDay(userId, dates, useLyrics) {
  const reading = useLyrics
    ? { $ifNull: ["$track.moods.lyrics.name", "$track.moods.sound.name"] }
    : "$track.moods.sound.name";
  return Listen.aggregate([
    { $match: { userId, localDate: { $gte: dates[0], $lte: dates.at(-1) } } },
    { $lookup: { from: "tracks", localField: "trackId", foreignField: "_id", as: "track" } },
    { $unwind: "$track" },
    { $match: { "track.moods.sound.name": { $type: "string" } } },
    { $group: { _id: { date: "$localDate", mood: reading }, plays: { $sum: 1 } } },
  ]);
}

const TOP_MOODS = 3;

// The moods the user's music had over the two weeks: the music moods played
// most, how the plays spread over the journal's five moods, and on how many
// logged days the music's main mood matched the one they logged. null when no
// played song has been analysed yet.
export function summariseMusicMoods(rows, moods, useLyrics) {
  const plays = rows.reduce((sum, row) => sum + row.plays, 0);
  if (!plays) return null;

  const byName = new Map();
  const axes = Object.fromEntries(AXES.map((axis) => [axis, 0]));
  const dayAxes = new Map();
  for (const { _id, plays: count } of rows) {
    byName.set(_id.mood, (byName.get(_id.mood) ?? 0) + count);
    const day = dayAxes.get(_id.date) ?? Object.fromEntries(AXES.map((axis) => [axis, 0]));
    for (const [axis, weight] of Object.entries(axesOf(_id.mood))) {
      axes[axis] += weight * count;
      day[axis] += weight * count;
    }
    dayAxes.set(_id.date, day);
  }

  const share = (count) => Math.round((count / plays) * 100);
  const top = [...byName]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_MOODS)
    .map(([name, count]) => ({ name, axis: strongestAxis(name), plays: count, share: share(count) }));

  // A day counts when it has both a logged mood and analysed plays.
  let comparedDays = 0;
  let matchedDays = 0;
  for (const [date, day] of dayAxes) {
    const logged = moods.get(date);
    if (!logged || !AXES.some((axis) => day[axis] > 0)) continue;
    comparedDays += 1;
    const main = AXES.reduce((best, axis) => (day[axis] > day[best] ? axis : best), AXES[0]);
    if (main === logged.toLowerCase()) matchedDays += 1;
  }

  return {
    lens: useLyrics ? "lyrics" : "sound",
    plays,
    top,
    axes: AXES.map((axis) => ({ axis, share: share(axes[axis]) })).filter((entry) => entry.share > 0),
    comparedDays,
    matchedDays,
  };
}

// The mood logged last on each day, since a later log is how the day ended up.
async function moodByDay(userId, timezone) {
  const logs = await retrieveMoodLogs(userId);
  const moods = new Map();
  // Logs come newest first, so the first one seen for a day is its last.
  for (const log of logs) {
    const date = localDateOf(log.createdAt, timezone);
    if (!moods.has(date)) moods.set(date, log.mood);
  }
  return moods;
}

const percent = (value) => (typeof value === "number" ? Math.round(value * 100) : null);

export async function moodMusic(user) {
  const dates = recentDates(user.timezone);
  const useLyrics = user.preferences?.moodLens !== "sound";
  const [music, moods, moodRows] = await Promise.all([
    happinessByDay(user._id, dates),
    moodByDay(user._id, user.timezone),
    musicMoodsByDay(user._id, dates, useLyrics),
  ]);

  const days = dates.map((date) => ({
    date,
    mood: moods.get(date) ?? null,
    happiness: percent(music.get(date)?.happiness),
    plays: music.get(date)?.plays ?? 0,
  }));

  // For each mood, how happy the music sounded on the days it was logged.
  const byMood = MOODS.map((mood) => {
    const matching = days.filter((day) => day.mood === mood && day.happiness !== null);
    const total = matching.reduce((sum, day) => sum + day.happiness, 0);
    return { mood, days: matching.length, happiness: matching.length ? Math.round(total / matching.length) : null };
  }).filter((entry) => entry.days > 0);

  return { days, byMood, musicMoods: summariseMusicMoods(moodRows, moods, useLyrics) };
}
