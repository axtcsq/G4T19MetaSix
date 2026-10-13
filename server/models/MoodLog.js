import mongoose from "mongoose";

const moodLogSchema = new mongoose.Schema(
  {
    mood: {
      type: String,
      required: true,
      enum: ["Sad", "Happy", "Relaxed", "Anxious", "Angry"],
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

export default mongoose.models.MoodLog ||
  mongoose.model("MoodLog", moodLogSchema);
