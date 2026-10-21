import { decrypt, encrypt } from "../lib/crypto.js";
import Listen from "../models/Listen.js";
import SyncGap from "../models/SyncGap.js";
import Track from "../models/Track.js";
import User from "../models/User.js";
import { rebuildDailyMoods } from "./dailyMoods.js";
import * as spotify from "./spotifyAuth.js";

// Spotify never returns more than this, so a full page may hide older plays.
const PAGE_SIZE = 50;

function localDateOf(date, timezone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(date);
}

// Saves a user's newest plays from Spotify. Used by the hourly job and by
// POST /api/sync. The Spotify calls can be swapped out in tests.
// Returns { status: "synced", added, dates, gap } or { status: "revoked" }.
export async function syncUser(
  userId,
  { refreshAccessToken = spotify.refreshAccessToken, fetchRecentlyPlayed = spotify.fetchRecentlyPlayed } = {},
) {
  const user = await User.findById(userId).select("+spotify.refreshToken");
  if (!user?.spotify?.refreshToken) {
    throw new Error("User has no Spotify refresh token");
  }

  let token;
  try {
    token = await refreshAccessToken(decrypt(user.spotify.refreshToken));
  } catch (error) {
    if (error.code === "invalid_grant") {
      // The user removed MetaFor's access in their Spotify account settings.
      await User.updateOne(
        { _id: user._id },
        { $set: { "tracking.status": "revoked", "tracking.lastError": error.message } },
      );
      return { status: "revoked" };
    }
    throw error;
  }
  if (token.refresh_token) {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          "spotify.refreshToken": encrypt(token.refresh_token),
          "spotify.tokenUpdatedAt": new Date(),
        },
      },
    );
  }

  const response = await fetchRecentlyPlayed(token.access_token);
  // Local files have no track ID and can't be analysed, so they're skipped.
  const items = (response.items ?? []).filter((item) => item.track?.id && item.played_at);

  if (items.length) {
    await Track.bulkWrite(
      [...new Map(items.map((item) => [item.track.id, item.track])).values()].map((track) => ({
        updateOne: {
          filter: { _id: track.id },
          update: {
            $set: {
              name: track.name,
              artists: (track.artists ?? []).map((artist) => ({ id: artist.id, name: artist.name })),
              album: { name: track.album?.name, imageUrl: track.album?.images?.[0]?.url },
              durationMs: track.duration_ms,
              isrc: track.external_ids?.isrc,
            },
            // New songs wait for mood analysis (Phase 4).
            $setOnInsert: { analysis: { status: "pending", attempts: 0 } },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  const listens = items.map((item) => {
    const playedAt = new Date(item.played_at);
    return {
      userId: user._id,
      trackId: item.track.id,
      playedAt,
      localDate: localDateOf(playedAt, user.timezone),
      source: "spotify-api",
      context: item.context ? { type: item.context.type, uri: item.context.uri } : undefined,
    };
  });

  // Upserting on the unique { userId, playedAt } skips plays already stored,
  // while a replay has its own playedAt and is kept.
  const result = listens.length
    ? await Listen.bulkWrite(
        listens.map((listen) => ({
          updateOne: {
            filter: { userId: listen.userId, playedAt: listen.playedAt },
            update: { $setOnInsert: listen },
            upsert: true,
          },
        })),
        { ordered: false },
      )
    : null;
  const added = Object.keys(result?.upsertedIds ?? {}).map((index) => listens[index]);

  // If every returned play is newer than the last one stored, older plays may
  // have dropped out of Spotify's 50 before this run.
  const times = listens.map((listen) => listen.playedAt.getTime());
  const newest = times.length ? new Date(Math.max(...times)) : null;
  const oldest = times.length ? new Date(Math.min(...times)) : null;
  const cursor = user.tracking?.cursor;
  const gap = Boolean(cursor && listens.length >= PAGE_SIZE && oldest > cursor);
  if (gap) {
    await SyncGap.updateOne(
      { userId: user._id, from: cursor },
      { $setOnInsert: { to: oldest, detectedAt: new Date() } },
      { upsert: true },
    );
  }

  // $max, so an overlapping run never moves the cursor backwards.
  const update = {
    $set: {
      "tracking.lastPolledAt": new Date(),
      "tracking.consecutiveFailures": 0,
      "tracking.lastError": null,
    },
  };
  if (newest) {
    update.$max = { "tracking.cursor": newest };
  }
  await User.updateOne({ _id: user._id }, update);

  const dates = [...new Set(added.map((listen) => listen.localDate))];
  if (dates.length) {
    await rebuildDailyMoods(user._id, dates);
  }

  return { status: "synced", added: added.length, dates, gap };
}

// Records a failed sync, so the job's log and /api/health can show it.
export function recordSyncFailure(userId, error) {
  return User.updateOne(
    { _id: userId },
    {
      $inc: { "tracking.consecutiveFailures": 1 },
      $set: { "tracking.lastError": error.message },
    },
  );
}
