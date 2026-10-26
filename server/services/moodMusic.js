import Listen from "../models/Listen.js";
import { MOODS, retrieveMoodLogs } from "../models/MoodLog.js";

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

// The mood logged last on each day, since a later log is how the day ended up.
export async function moodByDay(userId, timezone) {
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
  const [music, moods] = await Promise.all([
    happinessByDay(user._id, dates),
    moodByDay(user._id, user.timezone),
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

  return { days, byMood };
}
