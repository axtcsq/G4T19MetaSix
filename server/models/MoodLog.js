import mongoose from "mongoose";

const MOODS = ["Sad", "Happy", "Relaxed", "Anxious", "Angry"];

const moodLogSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true,
    collection: "dailylogs",
  },
);

const MoodLog = mongoose.models.MoodLog || mongoose.model("MoodLog", moodLogSchema);

// Keep MongoDB operations here so the controller can focus on HTTP behavior.
export function addMoodLog(entry) {
  return MoodLog.create(entry);
}

export function retrieveMoodLogs() {
  return MoodLog.find().sort({ createdAt: -1 }).limit(100);
}

export function findMoodLogById(id) {
  return MoodLog.findById(id);
}

export function editMoodLog(id, changes) {
  return MoodLog.findByIdAndUpdate(id, { $set: changes }, {
    returnDocument: "after",
    runValidators: true,
  });
}

export function removeMoodLog(id) {
  return MoodLog.findByIdAndDelete(id);
}

export { MOODS };
export default MoodLog;
