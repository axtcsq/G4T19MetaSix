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

const DRAWING_TYPES = new Set([
  "pen",
  "marker",
  "eraser",
  "line",
  "rectangle",
  "circle",
  "text",
]);

function validCoordinate(value) {
  return Number.isFinite(value) && Math.abs(value) <= 10000;
}

function validDrawing(drawing) {
  if (drawing === null) return true;
  if (!drawing || typeof drawing !== "object" || Array.isArray(drawing))
    return false;
  if (
    drawing.version !== 1 ||
    !Number.isFinite(drawing.width) ||
    drawing.width < 1 ||
    drawing.width > 5000 ||
    !Number.isFinite(drawing.height) ||
    drawing.height < 1 ||
    drawing.height > 5000 ||
    !Array.isArray(drawing.items) ||
    drawing.items.length > 500 ||
    Buffer.byteLength(JSON.stringify(drawing)) > 900_000
  ) {
    return false;
  }

  let totalPoints = 0;

  return drawing.items.every((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      !DRAWING_TYPES.has(item.type) ||
      typeof item.color !== "string" ||
      !/^#[\da-f]{6}$/i.test(item.color) ||
      !Number.isFinite(item.width) ||
      item.width < 1 ||
      item.width > 500
    ) {
      return false;
    }

    if (item.type === "text") {
      return (
        typeof item.text === "string" &&
        item.text.length > 0 &&
        item.text.length <= 1000 &&
        validCoordinate(item.x) &&
        validCoordinate(item.y)
      );
    }

    if (
      !validCoordinate(item.startX) ||
      !validCoordinate(item.startY) ||
      !validCoordinate(item.endX) ||
      !validCoordinate(item.endY) ||
      !Array.isArray(item.points) ||
      item.points.length === 0
    ) {
      return false;
    }

    totalPoints += item.points.length;
    if (totalPoints > 20000) return false;

    return item.points.every(
      (point) => point && validCoordinate(point.x) && validCoordinate(point.y),
    );
  });
}

function validateEntry(body, requireMood = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const keys = Object.keys(body);

  if (keys.some((key) => !["mood", "journal", "drawing"].includes(key))) {
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

  if ("drawing" in body && !validDrawing(body.drawing)) {
    return "Drawing data is invalid or exceeds the supported size";
  }

  return null;
}

// CREATE
export async function createMood(req, res) {
  const error = validateEntry(req.body, true);

  if (error) {
    return res.status(400).json({ error });
  }

  const log = await addMoodLog(req.user._id, {
    mood: req.body.mood,
    journal: req.body.journal ?? "",
    drawing: req.body.drawing ?? null,
  });

  res.status(201).json(log);
}

// READ ALL
export async function getMoods(req, res) {
  const logs = await retrieveMoodLogs(req.user._id);

  res.json(logs);
}

// READ ONE
export async function getMood(req, res) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const log = await findMoodLogById(req.params.id, req.user._id);

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

  const log = await editMoodLog(req.params.id, req.user._id, req.body);

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

  const log = await removeMoodLog(req.params.id, req.user._id);

  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }

  res.status(204).send();
}
