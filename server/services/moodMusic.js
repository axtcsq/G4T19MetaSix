import Listen from "../models/Listen.js";
import { MOODS } from "../models/MoodLog.js";
import { AXES, axesOf, strongestAxis } from "./mood/axes.js";
import { journalAxes, journalMoodsByDay, mainAxis, mainMood } from "./overallMood.js";

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

// Count daily moods, using lyric readings when enabled and available.
async function musicMoodsByDay(userId, dates, useLyrics) {
  const reading = useLyrics
    ? { $ifNull: ["$track.moods.lyrics.name", "$track.moods.sound.name"] }
    : "$track.moods.sound.name";
  return Listen.aggregate([
    { $match: { userId, localDate: { $gte: dates[0], $lte: dates.at(-1) } } },
    { $lookup: { from: "tracks", localField: "trackId", foreignField: "_id", as: "track" } },
    { $unwind: "$track" },
    // Songs with no sound data have only a lyrics reading.
    { $match: { $or: [
      { "track.moods.sound.name": { $type: "string" } },
      ...(useLyrics ? [{ "track.moods.lyrics.name": { $type: "string" } }] : []),
    ] } },
    { $group: { _id: { date: "$localDate", mood: reading }, plays: { $sum: 1 } } },
  ]);
}

const TOP_MOODS = 3;

// Summarise two weeks of music moods and compare them with journal moods.
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
  // Every music mood played, most first, with the one of the five moods it
  // counts towards most. mixed marks moods that count towards two, like
  // Bittersweet, so the page can say so.
  const allMoods = [...byName]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      axis: strongestAxis(name),
      plays: count,
      share: share(count),
      mixed: Object.keys(axesOf(name)).length > 1,
    }));
  const top = allMoods.slice(0, TOP_MOODS).map(({ mixed, ...mood }) => mood);

  // A day counts when it has both a logged mood and analysed plays.
  let comparedDays = 0;
  let matchedDays = 0;
  for (const [date, day] of dayAxes) {
    // Every entry that day counts, so a Sad-then-Happy day is half each.
    const logged = moods.get(date);
    if (!logged?.length || !AXES.some((axis) => day[axis] > 0)) continue;
    comparedDays += 1;
    if (mainAxis(day) === mainAxis(journalAxes(logged))) matchedDays += 1;
  }

  return {
    lens: useLyrics ? "lyrics" : "sound",
    plays,
    top,
    moods: allMoods,
    axes: AXES.map((axis) => ({ axis, share: share(axes[axis]) })).filter((entry) => entry.share > 0),
    comparedDays,
    matchedDays,
  };
}

const percent = (value) => (typeof value === "number" ? Math.round(value * 100) : null);

export async function moodMusic(user) {
  const dates = recentDates(user.timezone);
  const useLyrics = user.preferences?.moodLens !== "sound";
  const [music, moods, moodRows] = await Promise.all([
    happinessByDay(user._id, dates),
    journalMoodsByDay(user, dates[0], dates.at(-1)),
    musicMoodsByDay(user._id, dates, useLyrics),
  ]);

  const days = dates.map((date) => ({
    date,
    // The mood logged most that day, and every mood logged.
    mood: mainMood(moods.get(date) ?? []),
    moods: moods.get(date) ?? [],
    happiness: percent(music.get(date)?.happiness),
    plays: music.get(date)?.plays ?? 0,
  }));

  // For each mood, how happy the music sounded on the days it was logged.
  const byMood = MOODS.map((mood) => {
    // A day counts for every mood logged on it.
    const matching = days.filter((day) => day.moods.includes(mood) && day.happiness !== null);
    const total = matching.reduce((sum, day) => sum + day.happiness, 0);
    return { mood, days: matching.length, happiness: matching.length ? Math.round(total / matching.length) : null };
  }).filter((entry) => entry.days > 0);

  return { days, byMood, musicMoods: summariseMusicMoods(moodRows, moods, useLyrics) };
}
