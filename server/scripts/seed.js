// Creates the demo user with generated listening history and journal entries,
// so the app has data without a Spotify account. Re-running replaces the demo
// user's plays and generated entries; entries someone wrote by hand are kept.
//   npm run db:seed                 a year of plays
//   npm run db:seed -- --days 30    the last 30 days
// Run npm run db:init first, so the unique indexes exist.
import "dotenv/config";
import dns from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import DailyMood from "../models/DailyMood.js";
import Listen from "../models/Listen.js";
import MoodLog from "../models/MoodLog.js";
import SyncGap from "../models/SyncGap.js";
import Track from "../models/Track.js";
import User from "../models/User.js";
import { rebuildDailyMoods } from "../services/dailyMoods.js";
import { trackMoods } from "../services/mood/index.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const TIMEZONE = "Asia/Singapore";
const SCORER_VERSION = "emotion-v6";
const DAY_MS = 24 * 60 * 60 * 1000;

// Month-day ranges, inclusive, that shape what the demo user plays.
const EXAM_PERIODS = [
  ["03-02", "03-08"],
  ["04-20", "05-03"],
  ["10-05", "10-11"],
  ["11-23", "12-06"],
];
const HOLIDAYS = [
  ["01-01", "01-04"],
  ["05-10", "08-09"],
  ["12-14", "12-31"],
];

// Share of plays from each song label (the labels in demo-songs.json).
const MIXES = {
  exam: { sad: 0.5, angry: 0.2, calm: 0.15, happy: 0.15 },
  holiday: { happy: 0.5, calm: 0.25, sad: 0.15, angry: 0.1 },
  normal: { happy: 0.3, calm: 0.2, sad: 0.3, angry: 0.2 },
};

// Journal entries: most days get one in the evening, in the mood of that day's
// music. A song label maps to a journal mood; exam days also bring Anxious.
const ENTRY_CHANCE = { weekday: 0.75, weekend: 0.85 };
const MOOD_OF_LABEL = { sad: "Sad", happy: "Happy", calm: "Relaxed", angry: "Angry" };
const ANXIOUS_ON_EXAM_DAYS = 0.35;
// How often the entry's mood ignores the music, as real moods do.
const OFF_MUSIC_MOOD = 0.15;
const JOURNAL_MOODS = ["Happy", "Relaxed", "Sad", "Anxious", "Angry"];

const ENTRIES = {
  Happy: [
    "Good day overall. Lunch with friends ran way longer than planned and nobody minded.",
    "Finally got the project part working. Celebrated with bubble tea.",
    "Woke up early for once and actually used the morning. Felt great.",
    "Had a really nice call with family tonight. Needed that.",
    "Played my favourite songs on the walk home and couldn't stop smiling.",
    "Small wins today: gym, laundry, and a decent dinner.",
  ],
  Relaxed: [
    "Slow day. Read a bit, napped a bit, no complaints.",
    "Took the long way home through the park. Quiet and nice.",
    "Spent the evening tidying my room with music on. Weirdly calming.",
    "Nothing much happened, and that was exactly what I needed.",
    "Cooked something simple and ate it without looking at my phone.",
    "Sat by the window with tea for a while. Feeling settled.",
  ],
  Sad: [
    "Feeling a bit low today and I'm not totally sure why.",
    "Missed home a lot tonight. Listened to old songs on repeat.",
    "Didn't do well on the quiz. Trying not to let it get to me.",
    "Long day and I felt kind of alone through most of it.",
    "Plans fell through and I ended up staying in by myself.",
    "Tired in a way sleep doesn't fix. Hoping tomorrow is better.",
  ],
  Anxious: [
    "So much to revise and not enough time. Couldn't focus at all.",
    "Kept checking my deadlines over and over. Mind won't slow down.",
    "Presentation tomorrow. Rehearsed it five times and still nervous.",
    "Couldn't sleep, too many tabs open in my head.",
    "Group project is behind and I feel like it's on me to fix it.",
    "Restless all day. Music helped a little.",
  ],
  Angry: [
    "Group mate went missing again right before the deadline. So annoyed.",
    "Bus broke down and I was late for everything. What a day.",
    "Got talked over in class again. Still fuming about it.",
    "Lost a whole page of notes when my laptop crashed.",
    "Everything that could go wrong today went wrong.",
    "Needed loud music on the way home to blow off steam.",
  ],
};

const { values: args } = parseArgs({
  options: {
    days: { type: "string", default: "365" },
    // Allows seeding a database whose name doesn't end in _dev.
    yes: { type: "boolean", default: false },
  },
});

const DAYS = Number(args.days);
if (!Number.isInteger(DAYS) || DAYS < 1) {
  throw new Error("--days must be a positive whole number");
}

// A fixed seed, so every run generates the same plays for the same dates.
function createRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261019);
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

function pickWeighted(items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let target = random() * total;
  for (const item of items) {
    target -= weightOf(item);
    if (target <= 0) {
      return item;
    }
  }
  return items.at(-1);
}

const localDateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE });
const localDateOf = (date) => localDateFormat.format(date);

// Singapore has no daylight saving, so local midnight is always 16:00 UTC the day before.
const UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const localMidnight = (localDate) => new Date(Date.parse(`${localDate}T00:00:00Z`) - UTC_OFFSET_MS);

function periodOf(localDate) {
  const monthDay = localDate.slice(5);
  const within = ([from, to]) => monthDay >= from && monthDay <= to;
  if (EXAM_PERIODS.some(within)) return "exam";
  if (HOLIDAYS.some(within)) return "holiday";
  return "normal";
}

// Each label's songs in a fixed shuffled order; earlier songs are the user's
// favourites and get replayed more.
function favouritesByLabel(songs) {
  const byLabel = {};
  for (const song of songs) {
    (byLabel[song.label] ??= []).push(song);
  }
  for (const list of Object.values(byLabel)) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    list.forEach((song, rank) => {
      song.weight = 1 / (rank + 1) ** 0.8;
    });
  }
  return byLabel;
}

function generateDay(localDate, byLabel, userId) {
  const midnight = localMidnight(localDate);
  const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const mix = MIXES[periodOf(localDate)];

  const playCount = weekend ? between(10, 20) : between(20, 40);
  const sessionCount = between(2, 4);
  const startHours = Array.from({ length: sessionCount }, () => between(8, 22)).sort((a, b) => a - b);

  const listens = [];
  let time = 0;
  for (let session = 0; session < sessionCount; session++) {
    // Sessions never overlap, so every playedAt is unique.
    time = Math.max(time + 10 * 60 * 1000, startHours[session] * 60 * 60 * 1000 + between(0, 59) * 60 * 1000);
    const plays = session === sessionCount - 1
      ? playCount - listens.length
      : Math.round(playCount / sessionCount);

    for (let play = 0; play < plays; play++) {
      const label = pickWeighted(Object.keys(mix), (key) => mix[key]);
      const song = pickWeighted(byLabel[label], (item) => item.weight);
      const playedAt = new Date(midnight.getTime() + time);

      listens.push({
        userId,
        trackId: song.id,
        playedAt,
        localDate: localDateOf(playedAt),
        source: "seed",
      });
      time += between(180, 300) * 1000;
    }
  }
  return listens;
}

// A day's journal entry in the mood of its music, or null for a day off. Its
// time is in the evening, after the day's plays.
function generateEntry(localDate, dayListens, labelOf, userId) {
  const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  if (random() > ENTRY_CHANCE[weekend ? "weekend" : "weekday"]) {
    return null;
  }

  const counts = {};
  for (const listen of dayListens) {
    const label = labelOf.get(listen.trackId);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const label = pickWeighted(Object.keys(counts), (key) => counts[key]);
  let mood = MOOD_OF_LABEL[label] ?? "Relaxed";
  if (periodOf(localDate) === "exam" && random() < ANXIOUS_ON_EXAM_DAYS) {
    mood = "Anxious";
  }
  if (random() < OFF_MUSIC_MOOD) {
    mood = JOURNAL_MOODS[between(0, JOURNAL_MOODS.length - 1)];
  }

  const texts = ENTRIES[mood];
  const at = new Date(localMidnight(localDate).getTime() + between(20 * 60, 23 * 60 + 30) * 60 * 1000);
  return {
    userId,
    mood,
    journal: texts[between(0, texts.length - 1)],
    drawing: null,
    source: "seed",
    createdAt: at,
    updatedAt: at,
  };
}

function toTrack(song, analysedAt) {
  const lyrics = { ...song.lyrics, scorerVersion: SCORER_VERSION };
  const moods = trackMoods(song.features, lyrics);

  return {
    name: song.name,
    artists: [{ name: song.artist }],
    features: { ...song.features, sourceId: song.id },
    lyrics,
    moods,
    analysis: {
      status: moods.lyrics ? "done" : "partial",
      analysedAt,
      attempts: 1,
    },
  };
}

async function seed() {
  const songs = JSON.parse(await readFile(new URL("./data/demo-songs.json", import.meta.url), "utf8"));

  await connectDB();
  const database = mongoose.connection.name;
  if (!database.endsWith("_dev") && !args.yes) {
    throw new Error(`Refusing to seed "${database}". Use a _dev database, or pass --yes.`);
  }

  const now = new Date();
  await Track.bulkWrite(
    songs.map((song) => ({
      updateOne: {
        filter: { _id: song.id },
        update: { $set: toTrack(song, now) },
        upsert: true,
      },
    })),
  );

  // Paused, so the sync job never tries to refresh a Spotify token it doesn't have.
  const user = await User.findOneAndUpdate(
    { spotifyId: "demo" },
    {
      $set: {
        displayName: "Demo",
        isDemo: true,
        timezone: TIMEZONE,
        "preferences.moodLens": "lyrics",
        "tracking.status": "paused",
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  );

  await Promise.all([
    Listen.deleteMany({ userId: user._id }),
    DailyMood.deleteMany({ userId: user._id }),
    SyncGap.deleteMany({ userId: user._id }),
    MoodLog.deleteMany({ userId: user._id, source: "seed" }),
  ]);
  // Days someone wrote an entry on by hand keep theirs, and get no generated one.
  const handWritten = await MoodLog.find({ userId: user._id }, { createdAt: 1 }).lean();
  const handWrittenDays = new Set(handWritten.map((entry) => localDateOf(entry.createdAt)));

  const byLabel = favouritesByLabel(songs);
  const today = localDateOf(now);
  const labelOf = new Map(songs.map((song) => [song.id, song.label]));
  const listens = [];
  const entries = [];
  for (let offset = DAYS - 1; offset >= 0; offset--) {
    const localDate = localDateOf(new Date(localMidnight(today).getTime() + 12 * 60 * 60 * 1000 - offset * DAY_MS));
    const dayListens = generateDay(localDate, byLabel, user._id);
    listens.push(...dayListens);
    if (!handWrittenDays.has(localDate)) {
      const entry = generateEntry(localDate, dayListens, labelOf, user._id);
      if (entry) entries.push(entry);
    }
  }
  // Today's plays and entry stop at the current time.
  const played = listens.filter((listen) => listen.playedAt <= now);
  const written = entries.filter((entry) => entry.createdAt <= now);

  await Listen.insertMany(played, { ordered: false });
  // timestamps: false keeps each entry's own evening createdAt.
  await MoodLog.insertMany(written, { ordered: false, timestamps: false });
  const days = await rebuildDailyMoods(user._id);

  console.log(`[seed] ${database}: demo user ${user._id}`);
  console.log(
    `[seed] ${songs.length} tracks, ${played.length} listens, ${days} dailyMoods, ` +
      `${written.length} journal entries (${handWritten.length} written by hand kept)`,
  );
}

try {
  await seed();
} catch (error) {
  console.error("[seed] Failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
