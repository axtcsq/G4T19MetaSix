import mongoose from "mongoose";
import {
  addMoodLog,
  editMoodLog,
  findMoodLogById,
  MOODS,
  removeMoodLog,
  retrieveMoodLogs,
} from "../models/MoodLog.js";

function validId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function validateEntry(body, requireMood = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const keys = Object.keys(body);

  if (keys.some((key) => !["mood", "journal"].includes(key))) {
    return "Unsupported field";
  }

  if (requireMood && !("mood" in body)) {
    return "Mood is required";
  }

  if ("mood" in body && !MOODS.includes(body.mood)) {
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

  const log = await addMoodLog({
    mood: req.body.mood,
    journal: req.body.journal ?? "",
  });

  res.status(201).json(log);
}

// READ ALL
export async function getMoods(req, res) {
  const logs = await retrieveMoodLogs();

  res.json(logs);
}

// READ ONE
export async function getMood(req, res) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const log = await findMoodLogById(req.params.id);

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

  const error = validateEntry(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "No fields supplied" });
  }

  const log = await editMoodLog(req.params.id, req.body);

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

  const log = await removeMoodLog(req.params.id);

  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }

  res.status(204).send();
}
