import mongoose from "mongoose";
import MoodLog from "../models/MoodLog.js";

const allowedMoods = ["Sad", "Happy", "Relaxed", "Anxious", "Angry"];

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function validateEntry(body, requireMood = false) {
  const keys = Object.keys(body);

  if (keys.some((key) => !["mood", "journal"].includes(key))) {
    return "Unsupported field";
  }

  if (requireMood && !("mood" in body)) {
    return "Mood is required";
  }

  if ("mood" in body && !allowedMoods.includes(body.mood)) {
    return "Invalid mood";
  }

  if (
    "journal" in body &&
    (typeof body.journal !== "string" || body.journal.length > 5000)
  ) {
    return "Journal must be a string of at most 5000 characters";
  }

  return null;
}

// CREATE
export async function createMood(req, res) {
  const error = validateEntry(req.body, true);

  if (error) {
    return res.status(400).json({ error });
  }

  const log = await MoodLog.create({
    mood: req.body.mood,
    journal: req.body.journal ?? "",
  });

  res.status(201).json(log);
}

// READ ALL
export async function getMoods(req, res) {
  const logs = await MoodLog.find().sort({ createdAt: -1 }).limit(100);

  res.json(logs);
}

// READ ONE
export async function getMood(req, res) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const log = await MoodLog.findById(req.params.id);

  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }

  res.json(log);
}

// UPDATE
export async function updateMood(req, res) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "No fields supplied" });
  }

  const error = validateEntry(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  const log = await MoodLog.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { returnDocument: "after", runValidators: true },
  );

  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }

  res.json(log);
}

// DELETE
export async function deleteMood(req, res) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const log = await MoodLog.findByIdAndDelete(req.params.id);

  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }

  res.status(204).send();
}
