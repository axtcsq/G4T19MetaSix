import DailyMood from "../models/DailyMood.js";
import Listen from "../models/Listen.js";
import MoodLog from "../models/MoodLog.js";
import QuizAttempt, { Personality } from "../models/QuizAttempt.js";
import SyncGap from "../models/SyncGap.js";
import User from "../models/User.js";
import { publicUser } from "./authController.js";

// GET /api/me/export
// Everything MetaFor keeps about the user, as one JSON file to download.
export async function exportData(req, res) {
  const userId = req.user._id;
  const [journal, listens, quizAttempts] = await Promise.all([
    MoodLog.find({ userId }).sort({ createdAt: -1 }).select("-userId -__v").lean(),
    Listen.find({ userId })
      .sort({ playedAt: -1 })
      .select("-_id -userId -__v")
      .populate({ path: "trackId", select: "name artists" })
      .lean(),
    QuizAttempt.find({ userId }).sort({ createdAt: -1 }).select("-_id -userId -__v").lean(),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  res.attachment(`metafor-data-${date}.json`);
  res.json({
    exportedAt: new Date().toISOString(),
    account: publicUser(req.user),
    journal,
    listens: listens.map(({ trackId: track, ...listen }) => ({
      ...listen,
      track: track && { id: track._id, name: track.name, artists: track.artists.map((artist) => artist.name) },
    })),
    quizAttempts,
  });
}

// DELETE /api/me/history
// Deletes journal entries, listening history and quiz results. The account,
// its settings and the Spotify link stay.
export async function clearHistory(req, res) {
  const userId = req.user._id;
  await Promise.all([
    MoodLog.deleteMany({ userId }),
    Listen.deleteMany({ userId }),
    DailyMood.deleteMany({ userId }),
    SyncGap.deleteMany({ userId }),
    QuizAttempt.deleteMany({ userId }),
    Personality.deleteMany({ userId }),
  ]);
  res.json(publicUser(req.user));
}

// POST /api/me/spotify/disconnect
// Forgets the Spotify token and stops saving plays. Logging in with Spotify
// again reconnects.
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
