import { decrypt, encrypt } from "../lib/crypto.js";
import User from "../models/User.js";
import { isSpotifyLinked, refreshAccessToken } from "../services/spotifyAuth.js";

const RECONNECT = "Log in with Spotify again to connect your account.";

// GET /api/spotify/token
// A short-lived Spotify access token for the browser (Listening room, recent
// history). The refresh token never leaves the server.
export async function getSpotifyToken(req, res) {
  const user = await User.findById(req.user._id).select("+spotify.refreshToken");
  if (!isSpotifyLinked(user) || !user.spotify.refreshToken) {
    return res.status(403).json({ error: RECONNECT });
  }

  let token;
  try {
    token = await refreshAccessToken(decrypt(user.spotify.refreshToken));
  } catch (error) {
    if (error.code === "invalid_grant") {
      // The user removed MetaFor's access in their Spotify account settings.
      user.tracking.status = "revoked";
      user.tracking.lastError = error.message;
      await user.save();
      return res.status(403).json({ error: RECONNECT });
    }
    console.error("[Spotify] Token refresh failed:", error.message);
    return res.status(502).json({ error: "Spotify could not be reached. Please try again." });
  }

  if (token.refresh_token) {
    user.spotify.refreshToken = encrypt(token.refresh_token);
    user.spotify.tokenUpdatedAt = new Date();
  }
  if (token.scope) {
    user.spotify.scope = token.scope;
  }
  if (user.isModified()) {
    await user.save();
  }

  res.set("Cache-Control", "no-store");
  res.json({
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  });
}
