import mongoose from "mongoose";

const axesSchema = new mongoose.Schema(
  {
    happy: { type: Number, default: 0 },
    relaxed: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    angry: { type: Number, default: 0 },
    anxious: { type: Number, default: 0 },
  },
  { _id: false },
);

// One user's moods on one local date. Rebuilt from listens and tracks, so it
// can be dropped at any time.
const dailyMoodSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // "YYYY-MM-DD", the user's local date.
    date: { type: String, required: true },
    // All plays that day, replays included.
    listenCount: { type: Number, default: 0 },
    // Plays whose track has a mood.
    analysedCount: { type: Number, default: 0 },
    sound: {
      // Keys are camelCase mood slugs, e.g. darkAndDriving.
      moodCounts: { type: Map, of: Number, default: {} },
      axes: { type: axesSchema, default: () => ({}) },
    },
    lyrics: {
      moodCounts: { type: Map, of: Number, default: {} },
      axes: { type: axesSchema, default: () => ({}) },
      // Plays counted under their sound reading because the lyrics are pending.
      fallbackCount: { type: Number, default: 0 },
    },
    moodVersion: Number,
    axesVersion: Number,
    computedAt: { type: Date, default: Date.now },
  },
  {
    collection: "dailyMoods",
  },
);

dailyMoodSchema.index({ userId: 1, date: -1 }, { unique: true });

const DailyMood = mongoose.models.DailyMood || mongoose.model("DailyMood", dailyMoodSchema);

export default DailyMood;
