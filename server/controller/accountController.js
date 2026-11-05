import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";
import DailyMood from "../models/DailyMood.js";
import Listen from "../models/Listen.js";
import MoodLog from "../models/MoodLog.js";
import QuizAttempt, { Personality } from "../models/QuizAttempt.js";
import SyncGap from "../models/SyncGap.js";
import User from "../models/User.js";
import { publicUser } from "./authController.js";

async function* rows(cursor, map = (row) => row) {
  let first = true;
  for await (const row of cursor) {
    yield `${first ? "" : ","}${JSON.stringify(map(row))}`;
    first = false;
  }
}

async function* exportRows(user) {
  const userId = user._id;
  const exportedAt = new Date().toISOString();
  yield `{"exportedAt":${JSON.stringify(exportedAt)},"account":${JSON.stringify(publicUser(user))},"journal":[`;
  yield* rows(MoodLog.find({ userId }).sort({ createdAt: -1 }).select("-userId -__v").lean().cursor());
  yield `],"listens":[`;
  yield* rows(
    Listen.find({ userId })
      .sort({ playedAt: -1 })
      .select("-_id -userId -__v")
      .populate({ path: "trackId", select: "name artists" })
      .lean()
      .cursor(),
    ({ trackId: track, ...listen }) => ({
      ...listen,
      track: track && { id: track._id, name: track.name, artists: track.artists.map((artist) => artist.name) },
    }),
  );
  yield `],"quizAttempts":[`;
  yield* rows(QuizAttempt.find({ userId }).sort({ createdAt: -1 }).select("-_id -userId -__v").lean().cursor());
  yield "]}";
}

// GET /api/me/export
export async function exportData(req, res) {
  const date = new Date().toISOString().slice(0, 10);
  res.attachment(`metafor-data-${date}.json`);
  try {
    await pipeline(Readable.from(exportRows(req.user)), res);
  } catch (error) {
    if (!res.headersSent) throw error;
    console.error("[Export] Data stream failed:", error.message);
  }
}

// DELETE /api/me/history Clear saved history while keeping the account and Spotify link.
export async function clearHistory(req, res) {
  const userId = req.user._id;
  const session = await mongoose.startSession();
  let user;
  try {
    await session.withTransaction(async () => {
      for (const model of [MoodLog, Listen, DailyMood, SyncGap, QuizAttempt, Personality]) {
        await model.deleteMany({ userId }, { session });
      }
      user = await User.findByIdAndUpdate(
        userId,
        // The metaphor is written from the moods being deleted.
        { $set: { pinnedEntryId: null }, $unset: { dailyMetaphor: "" } },
        { returnDocument: "after", session },
      );
    });
  } finally {
    await session.endSession();
  }
  res.json(publicUser(user));
}

// POST /api/me/spotify/disconnect Forgets the Spotify token and stops saving plays. Logging in with Spotify again reconnects.
export async function disconnectSpotify(req, res) {
  if (req.user.isDemo) {
    return res.status(400).json({ error: "The test account isn't connected to Spotify" });
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { "spotify.refreshToken": "", "spotify.scope": "", "spotify.tokenUpdatedAt": "" },
      $set: { "tracking.status": "revoked", "tracking.lastError": null },
    },
    { returnDocument: "after" },
  );
  res.json(publicUser(user));
}
