import mongoose from "mongoose";

const MOODS = ["Sad", "Happy", "Relaxed", "Anxious", "Angry", "Excited", "Tired", "Lonely"];

// The entry's Song of the Day. Copied from Spotify so old entries don't need to ask again.
const songSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    artists: [String],
    imageUrl: String,
  },
  { _id: false },
);

// The entry's photo, already shrunk by the journal page: the image bytes and
// their type, like image/jpeg.
const photoSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    type: { type: String, required: true },
  },
  { _id: false },
);

const moodLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mood: {
      type: String,
      required: true,
      enum: MOODS,
    },
    journal: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    // Versioned vector drawing data from the Daily Mood canvas.
    drawing: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Optional Song of the Day.
    song: {
      type: songSchema,
      default: null,
    },
    // Optional photo. Left out of queries unless asked for to keep entry lists small; hasPhoto says there's one to load.
    photo: {
      type: photoSchema,
      default: null,
      select: false,
    },
    hasPhoto: {
      type: Boolean,
      default: false,
    },
    // "seed" on the demo user's generated entries so re-seeding only replaces those. Not set on real entries.
    source: {
      type: String,
      enum: ["seed"],
      select: false,
    },
  },
  {
    timestamps: true,
    collection: "dailylogs",
  },
);

moodLogSchema.index({ userId: 1, createdAt: -1 });
const MoodLog =
  mongoose.models.MoodLog || mongoose.model("MoodLog", moodLogSchema);

// MongoDB operations live here so the controller can stick to HTTP.
export function addMoodLog(userId, entry) {
  return MoodLog.create({ ...entry, userId });
}

export function retrieveMoodLogs(userId) {
  return MoodLog.find({ userId }).sort({ createdAt: -1 }).limit(100);
}

export function findMoodLogById(id, userId) {
  return MoodLog.findOne({ _id: id, userId });
}

export function findMoodLogPhoto(id, userId) {
  return MoodLog.findOne({ _id: id, userId, hasPhoto: true }, { photo: 1 });
}

export function editMoodLog(id, userId, changes) {
  return MoodLog.findOneAndUpdate(
    { _id: id, userId },
    { $set: changes },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );
}

export function removeMoodLog(id, userId) {
  return MoodLog.findOneAndDelete({ _id: id, userId });
}

export { MOODS };
export default MoodLog;
