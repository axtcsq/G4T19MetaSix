import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { encrypt } from "../lib/crypto.js";
import MoodLog from "../models/MoodLog.js";
import User from "../models/User.js";
import { authorizeUrl, exchangeCode, fetchProfile, isSpotifyLinked } from "../services/spotifyAuth.js";
import { ELEMENT_TRAITS, parseBirthday, SIGN_TRAITS, starSign } from "../data/quizzes/spotifyHoroscope.js";

// A login that isn't finished within 10 minutes has to start again.
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function clientUrl(path) {
  const origin = process.env.CLIENT_ORIGIN?.split(",")[0] || "http://localhost:5173";
  return new URL(path, origin).toString();
}

// Only paths inside the app, so the login can't be used to send people elsewhere.
export function safeReturnPath(next) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || /[\\\x00-\x20]/.test(next)) {
    return "/dashboard";
  }
  return next;
}

// Returns the IANA name if the browser sent a real timezone, otherwise null.
function validTimezone(timezone) {
  if (typeof timezone !== "string" || !timezone) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

// New session ID before storing the user, so one set before login can't be reused
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        return reject(error);
      }
      req.session.userId = userId.toString();
      resolve();
    });
  });
}

// Star sign for a YYYY-MM-DD birthday and what it says about their listening. null if no birthday.
function horoscope(birthday) {
  const date = parseBirthday(birthday);
  if (!date) return null;
  const sign = starSign(date.month, date.day);
  return { ...sign, reading: `${SIGN_TRAITS[sign.name]} ${ELEMENT_TRAITS[sign.element]}` };
}

// The user fields the client may see. Never includes the refresh token.
export function publicUser(user) {
  return {
    id: user._id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    timezone: user.timezone,
    isDemo: user.isDemo,
    birthday: user.birthday ?? null,
    starSign: horoscope(user.birthday),
    pinnedEntryId: user.pinnedEntryId ?? null,
    // False for users who need to log in again.
    spotifyLinked: isSpotifyLinked(user),
    preferences: user.preferences,
    tracking: {
      status: user.tracking.status,
      lastPolledAt: user.tracking.lastPolledAt ?? null,
    },
  };
}

// GET /api/auth/login?tz=Asia/Singapore&next=/calendar
export function login(req, res) {
  const state = randomBytes(16).toString("hex");
  req.session.login = {
    state,
    timezone: validTimezone(req.query.tz),
    returnTo: safeReturnPath(req.query.next),
    startedAt: Date.now(),
  };

  res.redirect(authorizeUrl(state));
}

// GET /api/auth/callback, where Spotify sends the browser back after login
export async function callback(req, res) {
  const pending = req.session.login;
  delete req.session.login;

  const { code, state, error } = req.query;
  const expired = !pending || Date.now() - pending.startedAt > LOGIN_TIMEOUT_MS;
  if (expired || typeof state !== "string" || state !== pending.state) {
    return res.redirect(clientUrl("/login?error=expired"));
  }
  if (error || typeof code !== "string") {
    // The user pressed Cancel on Spotify's consent page.
    return res.redirect(clientUrl("/login?error=denied"));
  }

  try {
    const token = await exchangeCode(code);
    const profile = await fetchProfile(token.access_token);
    const now = new Date();

    const changes = {
      displayName: profile.display_name || profile.id,
      avatarUrl: profile.images?.[0]?.url ?? null,
      "spotify.refreshToken": encrypt(token.refresh_token),
      "spotify.scope": token.scope,
      "spotify.tokenUpdatedAt": now,
      "tracking.status": "active",
      "tracking.consecutiveFailures": 0,
      "tracking.lastError": null,
      lastLoginAt: now,
    };
    if (pending.timezone) {
      changes.timezone = pending.timezone;
    }

    const user = await User.findOneAndUpdate(
      { spotifyId: profile.id, isDemo: { $ne: true } },
      { $set: changes },
      { upsert: true, returnDocument: "after", runValidators: true },
    );

    await startSession(req, user._id);
    res.redirect(clientUrl(pending.returnTo ?? "/dashboard"));
  } catch (error) {
    console.error("[Auth] Spotify login failed:", error.message);
    // In Development Mode, Spotify answers 403 for accounts not on the app's user list.
    const reason = error.status === 403 ? "not-allowed" : "spotify";
    res.redirect(clientUrl(`/login?error=${reason}`));
  }
}

// POST /api/auth/logout
export function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }
    res.clearCookie("metafor.sid");
    res.status(204).end();
  });
}

// GET /api/me
export function getMe(req, res) {
  res.json(publicUser(req.user));
}

// PATCH /api/me/settings: update submitted profile preferences.
export async function updateSettings(req, res) {
  const { analyseLyrics, savePlays, birthday, reminderTime, pinnedEntryId } = req.body ?? {};
  const changes = {};
  if (analyseLyrics !== undefined) {
    if (typeof analyseLyrics !== "boolean") {
      return res.status(400).json({ error: "analyseLyrics must be true or false" });
    }
    changes["preferences.moodLens"] = analyseLyrics ? "lyrics" : "sound";
  }
  if (savePlays !== undefined) {
    if (typeof savePlays !== "boolean") {
      return res.status(400).json({ error: "savePlays must be true or false" });
    }
    changes["preferences.savePlays"] = savePlays;
  }
  if (birthday !== undefined) {
    if (birthday !== null && !parseBirthday(birthday)) {
      return res.status(400).json({ error: "Please enter a real birthday that isn't in the future" });
    }
    changes.birthday = birthday;
  }
  if (reminderTime !== undefined) {
    if (reminderTime !== null && (typeof reminderTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime))) {
      return res.status(400).json({ error: "reminderTime must be a time like 21:30" });
    }
    changes["preferences.reminderTime"] = reminderTime;
  }
  if (pinnedEntryId !== undefined) {
    if (pinnedEntryId !== null) {
      // Only the user's own entries can be pinned.
      const own =
        mongoose.isObjectIdOrHexString(pinnedEntryId) &&
        (await MoodLog.exists({ _id: pinnedEntryId, userId: req.user._id }));
      if (!own) {
        return res.status(400).json({ error: "That journal entry can't be pinned" });
      }
    }
    changes.pinnedEntryId = pinnedEntryId;
  }
  if (!Object.keys(changes).length) {
    return res.status(400).json({ error: "Nothing to change" });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: changes },
    { returnDocument: "after", runValidators: true },
  );
  res.json(publicUser(user));
}
