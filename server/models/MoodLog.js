import mongoose from "mongoose";

const MOODS = ["Sad", "Happy", "Relaxed", "Anxious", "Angry", "Excited", "Tired", "Lonely"];

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
    // "seed" for the demo user's generated entries, so re-seeding replaces
    // only those. Absent on entries people write.
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

// Keep MongoDB operations here so the controller can focus on HTTP behavior.
export function addMoodLog(userId, entry) {
  return MoodLog.create({ ...entry, userId });
}

export function retrieveMoodLogs(userId) {
  return MoodLog.find({ userId }).sort({ createdAt: -1 }).limit(100);
}

export function findMoodLogById(id, userId) {
  return MoodLog.findOne({ _id: id, userId });
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
