import { randomBytes } from "node:crypto";
import { encrypt } from "../lib/crypto.js";
import User from "../models/User.js";
import { authorizeUrl, exchangeCode, fetchProfile, isSpotifyLinked } from "../services/spotifyAuth.js";

// A login that isn't finished within 10 minutes has to start again.
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function clientUrl(path) {
  const origin = process.env.CLIENT_ORIGIN?.split(",")[0] || "http://localhost:5173";
  return new URL(path, origin).toString();
}

// Only paths inside the app, so the login can't be used to send people elsewhere.
function safeReturnPath(next) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
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

// Swaps in a new session ID before storing the user, so a session ID set
// before login can't be reused afterwards.
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

// The user fields the client may see. Never includes the refresh token.
function publicUser(user) {
  return {
    id: user._id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    timezone: user.timezone,
    isDemo: user.isDemo,
    // False for the demo user, and for users who need to log in again.
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

// GET /api/auth/demo, so the login page knows whether to offer the test account
export function demoStatus(req, res) {
  res.json({ enabled: process.env.DEMO_LOGIN === "true" });
}

// POST /api/auth/demo, only when DEMO_LOGIN=true
export async function demoLogin(req, res) {
  if (process.env.DEMO_LOGIN !== "true") {
    return res.status(404).json({ error: "Route not found" });
  }

  const user = await User.findOne({ isDemo: true });
  if (!user) {
    return res.status(503).json({ error: "Demo user not found. Run npm run db:seed first." });
  }

  await startSession(req, user._id);
  res.json(publicUser(user));
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
