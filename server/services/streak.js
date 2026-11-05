import MoodLog from "../models/MoodLog.js";
import { localDate } from "./dailyMetaphor.js";

// The daily check-in streak on Home, with streak savers. Every 7 days in a row
// earns a saver (holding at most 2), and a saver covers a single missed day so
// the streak carries on. Missing a day with no saver left starts it again.

const DAY_MS = 86_400_000;
const SAVER_EVERY = 7;
const MAX_SAVERS = 2;
// Far enough back for any streak Home shows, without reading every check-in.
const LOOK_BACK_DAYS = 400;

const nextDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

// The streak from a set of "YYYY-MM-DD" check-in dates, up to today. Today
// only counts once it has a check-in, so the streak doesn't break at midnight.
export function streakFrom(dates, today) {
  const checkedIn = new Set(dates);
  let days = 0;
  let savers = 0;
  let savedYesterday = false;
  const first = [...checkedIn].sort()[0];
  for (let date = first; date && date <= today; date = nextDay(date)) {
    if (checkedIn.has(date)) {
      days++;
      if (days % SAVER_EVERY === 0) savers = Math.min(savers + 1, MAX_SAVERS);
      savedYesterday = false;
    } else if (date === today) {
      break;
    } else if (savers > 0) {
      savers--;
      savedYesterday = nextDay(date) === today;
    } else {
      days = 0;
      savers = 0;
      savedYesterday = false;
    }
  }
  return {
    days,
    checkedInToday: checkedIn.has(today),
    savers,
    maxSavers: MAX_SAVERS,
    // Days left until the next saver, or null with a full set.
    nextSaverIn: savers < MAX_SAVERS ? SAVER_EVERY - (days % SAVER_EVERY) : null,
    savedYesterday,
  };
}

export async function checkInStreak(user, now = new Date()) {
  const since = new Date(now.getTime() - LOOK_BACK_DAYS * DAY_MS);
  const logs = await MoodLog.find({ userId: user._id, createdAt: { $gte: since } }, { createdAt: 1 }).lean();
  const dates = logs.map((log) => localDate(log.createdAt, user.timezone));
  return streakFrom(dates, localDate(now, user.timezone));
}
