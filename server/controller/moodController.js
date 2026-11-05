import mongoose from "mongoose";
import User from "../models/User.js";
import {
  addMoodLog,
  editMoodLog,
  findMoodLogById,
  findMoodLogPhoto,
  MOODS,
  removeMoodLog,
  retrieveMoodLogs,
} from "../models/MoodLog.js";
import { checkInStreak } from "../services/streak.js";

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

// A Song of the Day as the journal page sends it: a Spotify ID, the title, the artists and the cover, or null for no song.
function validSong(song) {
  if (song === null) return true;
  if (!song || typeof song !== "object" || Array.isArray(song)) return false;
  if (Object.keys(song).some((key) => !["id", "name", "artists", "imageUrl"].includes(key))) {
    return false;
  }

  return (
    typeof song.id === "string" &&
    /^[A-Za-z0-9]{22}$/.test(song.id) &&
    typeof song.name === "string" &&
    song.name.length > 0 &&
    song.name.length <= 300 &&
    Array.isArray(song.artists) &&
    song.artists.length <= 20 &&
    song.artists.every((artist) => typeof artist === "string" && artist.length <= 200) &&
    (song.imageUrl === undefined ||
      (typeof song.imageUrl === "string" &&
        song.imageUrl.length <= 500 &&
        song.imageUrl.startsWith("https://")))
  );
}

// The image types the journal page may send, and how each file starts.
const PHOTO_TYPES = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  "image/webp": (bytes) =>
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP",
};
// The page shrinks photos well under this before sending them.
const MAX_PHOTO_BYTES = 600_000;

// A photo as the journal page sends it, a data URL like
// "data:image/jpeg;base64,...", as { data, type } for MongoDB. null when it
// isn't a real image of a supported type and size.
export function parsePhoto(value) {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || !PHOTO_TYPES[match[1]]) return null;
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > MAX_PHOTO_BYTES || !PHOTO_TYPES[match[1]](data)) return null;
  return { data, type: match[1] };
}

// The photo's bytes stay on the server; the page loads them by the entry's id.
function withoutPhoto(log) {
  const entry = log.toObject();
  delete entry.photo;
  return entry;
}

function validateEntry(body, requireMood = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be an object";
  }

  const keys = Object.keys(body);

  if (keys.some((key) => !["mood", "journal", "drawing", "song", "photo"].includes(key))) {
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

  if ("song" in body && !validSong(body.song)) {
    return "Song of the Day is invalid";
  }

  if ("photo" in body && body.photo !== null && !parsePhoto(body.photo)) {
    return "Photo must be a JPEG, PNG or WebP image under 600 KB";
  }

  return null;
}

// The photo field as MongoDB stores it: the image, or none.
function photoChanges(body) {
  const photo = body.photo ? parsePhoto(body.photo) : null;
  return { photo, hasPhoto: Boolean(photo) };
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
    song: req.body.song ?? null,
    ...photoChanges(req.body),
  });

  res.status(201).json(withoutPhoto(log));
}

// READ ALL
export async function getMoods(req, res) {
  const logs = await retrieveMoodLogs(req.user._id);

  res.json(logs);
}

// READ STREAK The daily check-in streak and its streak savers, for Home.
export async function getStreak(req, res) {
  res.json(await checkInStreak(req.user));
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

  const changes = { ...req.body };
  // Sending photo: null removes it.
  if ("photo" in req.body) Object.assign(changes, photoChanges(req.body));
  const log = await editMoodLog(req.params.id, req.user._id, changes);

  if (!log) {
    return res.status(404).json({ error: "Log not found" });
  }

  res.json(log);
}

// READ PHOTO
// The entry's photo as an image, only for its owner.
export async function getMoodPhoto(req, res) {
  if (!validId(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const log = await findMoodLogPhoto(req.params.id, req.user._id);

  if (!log?.photo) {
    return res.status(404).json({ error: "Photo not found" });
  }

  // Private, so only this person's browser keeps a copy.
  res.set("Cache-Control", "private, max-age=86400");
  res.type(log.photo.type).send(log.photo.data);
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

  // A deleted entry can't stay pinned to the profile.
  await User.updateOne({ _id: req.user._id, pinnedEntryId: log._id }, { $set: { pinnedEntryId: null } });

  res.status(204).send();
}
