// Spotify login (Authorization Code flow). The client secret stays on the
// server; the browser only ever gets our session cookie.
const ACCOUNTS_URL = "https://accounts.spotify.com";
const API_URL = "https://api.spotify.com/v1";

// recently-played feeds mood tracking. The rest are what Spotify's Web Playback
// SDK needs for the Listening room (playback itself needs Premium).
export const SCOPES = [
  "user-read-recently-played",
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
];

function config() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
    throw new Error("SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET and SPOTIFY_REDIRECT_URI are required");
  }
  return {
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri: SPOTIFY_REDIRECT_URI,
  };
}

// Throws an error with Spotify's status code, so callers can tell a user who
// isn't on the app's allowed list (403) from Spotify being down.
async function spotifyFetch(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = body.error_description ?? body.error?.message ?? body.error ?? "request failed";
    const error = new Error(`Spotify ${response.status}: ${reason}`);
    error.status = response.status;
    // e.g. "invalid_grant" when the user has removed the app's access.
    error.code = typeof body.error === "string" ? body.error : undefined;
    throw error;
  }
  return body;
}

export function authorizeUrl(state) {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    state,
  });
  return `${ACCOUNTS_URL}/authorize?${params}`;
}

function requestToken(params) {
  const { clientId, clientSecret } = config();
  return spotifyFetch(`${ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
}

// Returns { access_token, refresh_token, scope, expires_in }.
export function exchangeCode(code) {
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config().redirectUri,
  });
}

// Returns { access_token, scope, expires_in }, plus a new refresh_token when
// Spotify rotates it.
export function refreshAccessToken(refreshToken) {
  return requestToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

// Whether the browser can get a token for this user: a real Spotify login that
// hasn't been revoked and granted every scope the app asks for. Users who logged
// in before a scope was added have to log in once more.
export function isSpotifyLinked(user) {
  if (user.isDemo || user.tracking?.status === "revoked" || !user.spotify?.tokenUpdatedAt) {
    return false;
  }
  const granted = (user.spotify.scope ?? "").split(" ");
  return SCOPES.every((scope) => granted.includes(scope));
}

export function fetchProfile(accessToken) {
  return spotifyFetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
