import mongoose from "mongoose";

const LYRICS_STATUSES = [
  "found",
  "not-found",
  "instrumental",
  "untranslatable",
  "untranslated",
  "unavailable",
];
const ANALYSIS_STATUSES = ["pending", "done", "partial", "failed", "no-data"];

const emotionsSchema = new mongoose.Schema(
  {
    joy: Number,
    sadness: Number,
    anger: Number,
    fear: Number,
    disgust: Number,
    surprise: Number,
    neutral: Number,
  },
  { _id: false },
);

// Only the lyric scores are stored, never the lyrics text.
const lyricsSchema = new mongoose.Schema(
  {
    status: { type: String, enum: LYRICS_STATUSES },
    // Language code; absent for English.
    translatedFrom: String,
    valence: Number,
    // Share of non-neutral emotion.
    emotionalShare: Number,
    // Rescore the lyrics when this changes, e.g. "emotion-v6".
    scorerVersion: String,
    emotions: emotionsSchema,
    darkThemes: [String],
    highlights: {
      positive: [String],
      negative: [String],
    },
  },
  { _id: false },
);

const soundMoodSchema = new mongoose.Schema(
  {
    name: String,
    family: String,
  },
  { _id: false },
);

const lyricsMoodSchema = new mongoose.Schema(
  {
    name: String,
    family: String,
    contrast: String,
  },
  { _id: false },
);

// One document per song, shared by all users.
const trackSchema = new mongoose.Schema(
  {
    // Spotify track ID.
    _id: { type: String, required: true },
    name: { type: String, required: true },
    artists: [{ _id: false, id: String, name: String }],
    album: {
      name: String,
      imageUrl: String,
    },
    durationMs: Number,
    isrc: String,
    // Audio features from ReccoBeats.
    features: {
      valence: Number,
      energy: Number,
      danceability: Number,
      acousticness: Number,
      instrumentalness: Number,
      speechiness: Number,
      liveness: Number,
      loudness: Number,
      tempo: Number,
      key: Number,
      mode: Number,
      // The Spotify ID ReccoBeats matched; differs when a fallback was used.
      sourceId: String,
    },
    lyrics: { type: lyricsSchema, default: null },
    // Two readings that are never mixed. lyrics is null while the lyrics are pending.
    moods: {
      sound: { type: soundMoodSchema, default: null },
      lyrics: { type: lyricsMoodSchema, default: null },
      version: Number,
    },
    analysis: {
      status: { type: String, enum: ANALYSIS_STATUSES, default: "pending" },
      analysedAt: Date,
      attempts: { type: Number, default: 0 },
      lastError: String,
    },
  },
  {
    collection: "tracks",
  },
);

trackSchema.index({ "analysis.status": 1 });
trackSchema.index({ "moods.version": 1 });

const Track = mongoose.models.Track || mongoose.model("Track", trackSchema);

export { ANALYSIS_STATUSES, LYRICS_STATUSES };
export default Track;
