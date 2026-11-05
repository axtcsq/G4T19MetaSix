// A user's overall mood over some dates, from journal and listening together. Anything that sums up "how you've been" uses this.
import DailyMood from "../models/DailyMood.js";
import MoodLog from "../models/MoodLog.js";
import { AXES } from "./mood/axes.js";

// What the journal is worth against the music on a day that has both.
export const JOURNAL_WEIGHT = 0.6;

// Each journal mood on the music's five axes. Tired is only half sad: not quite unhappy, and no calm or tense side either.
export const JOURNAL_AXES = {
  Happy: { happy: 1 },
  Excited: { happy: 1 },
  Relaxed: { relaxed: 1 },
  Sad: { sad: 1 },
  Lonely: { sad: 1 },
  Tired: { sad: 0.5 },
  Anxious: { anxious: 1 },
  Angry: { angry: 1 },
};

const zero = () => Object.fromEntries(AXES.map((axis) => [axis, 0]));

// One day's journal entries on the axes, each entry an equal share of the day.
export function journalAxes(moods) {
  const axes = zero();
  for (const mood of moods) {
    for (const [axis, weight] of Object.entries(JOURNAL_AXES[mood] ?? {})) {
      axes[axis] += weight / moods.length;
    }
  }
  return axes;
}

// One day's music axes as shares of the day, so a busy day counts the same as a quiet one.
export function musicAxes(axes = {}) {
  const total = AXES.reduce((sum, axis) => sum + (axes[axis] ?? 0), 0);
  const shares = zero();
  if (total > 0) for (const axis of AXES) shares[axis] = (axes[axis] ?? 0) / total;
  return total > 0 ? shares : null;
}

// A day's mood: journal and music blended 60/40, or whichever of them the day has.
export function dayAxes({ moods = [], music = null }) {
  const journal = moods.length ? journalAxes(moods) : null;
  if (!journal && !music) return null;
  if (!journal) return music;
  if (!music) return journal;
  const axes = zero();
  for (const axis of AXES) axes[axis] = JOURNAL_WEIGHT * journal[axis] + (1 - JOURNAL_WEIGHT) * music[axis];
  return axes;
}

// The journal mood logged most often, given newest first. Ties go to the latest.
export function mainMood(moods) {
  const counts = {};
  for (const mood of moods) counts[mood] = (counts[mood] ?? 0) + 1;
  let main = null;
  for (const mood of moods) if (!main || counts[mood] > counts[main]) main = mood;
  return main;
}

// The strongest axis, or null when nothing leans anywhere. Ties go to the earlier axis.
export function mainAxis(axes) {
  let main = null;
  for (const axis of AXES) if ((axes?.[axis] ?? 0) > 0 && (!main || axes[axis] > axes[main])) main = axis;
  return main;
}

// The overall mood over these days, each day counting equally.
// days: [{ date, moods: ["Happy", ...], music: axes or null, plays }]
export function combineDays(days) {
  const axes = zero();
  let counted = 0;
  const perDay = [];
  for (const day of days) {
    const mood = dayAxes(day);
    if (!mood) continue;
    counted += 1;
    for (const axis of AXES) axes[axis] += mood[axis];
    perDay.push({ date: day.date, axes: mood, main: mainAxis(mood) });
  }
  if (counted) for (const axis of AXES) axes[axis] /= counted;
  return {
    main: mainAxis(axes),
    axes,
    days: perDay,
    // What it's based on, so the page can say so.
    journalDays: days.filter((day) => day.moods?.length).length,
    journalEntries: days.reduce((sum, day) => sum + (day.moods?.length ?? 0), 0),
    musicDays: days.filter((day) => day.music).length,
    plays: days.reduce((sum, day) => sum + (day.music ? (day.plays ?? 0) : 0), 0),
  };
}

const localDate = (date, timezone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(date);
const DAY_MS = 24 * 60 * 60 * 1000;

// Each date's journal moods, newest first ("YYYY-MM-DD" -> ["Happy", ...]), in the user's time zone.
export async function journalMoodsByDay(user, from, to) {
  // A day either side covers every time zone; exact dates are checked below.
  const logs = await MoodLog.find(
    {
      userId: user._id,
      createdAt: { $gte: new Date(Date.parse(from) - DAY_MS), $lt: new Date(Date.parse(to) + 2 * DAY_MS) },
    },
    { mood: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .lean();
  const byDay = new Map();
  for (const log of logs) {
    const date = localDate(log.createdAt, user.timezone);
    if (date < from || date > to) continue;
    byDay.set(date, [...(byDay.get(date) ?? []), log.mood]);
  }
  return byDay;
}

// The user's overall mood from `from` to `to` ("YYYY-MM-DD", inclusive).
export async function overallMood(user, { from, to }) {
  const lens = user.preferences?.moodLens === "sound" ? "sound" : "lyrics";
  const [journal, music] = await Promise.all([
    journalMoodsByDay(user, from, to),
    DailyMood.find({ userId: user._id, date: { $gte: from, $lte: to } }).lean(),
  ]);
  const musicByDay = new Map(music.map((day) => [day.date, day]));
  const dates = [...new Set([...journal.keys(), ...musicByDay.keys()])].sort();
  return {
    lens,
    ...combineDays(
      dates.map((date) => {
        const day = musicByDay.get(date);
        // Songs with no sound data only have a lyrics reading.
        const plays = (day?.analysedCount ?? 0) + (lens === "lyrics" ? (day?.lyrics?.lyricsOnlyCount ?? 0) : 0);
        return { date, moods: journal.get(date) ?? [], music: musicAxes(day?.[lens]?.axes), plays };
      }),
    ),
  };
}
