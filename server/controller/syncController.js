import { recordSyncFailure, syncUser } from "../services/sync.js";

// Opening the dashboard twice in a row shouldn't call Spotify twice.
const MIN_INTERVAL_MS = 60 * 1000;

// POST /api/sync: "Sync now". Saves the logged-in user's newest plays from
// Spotify straight away, instead of waiting for the hourly job.
export async function syncNow(req, res) {
  const { isDemo, tracking } = req.user;
  if (isDemo) {
    return res.status(409).json({ error: "The test account isn't connected to Spotify." });
  }
  if (tracking.status !== "active") {
    return res.status(403).json({ error: "Log in with Spotify again to resume tracking." });
  }
  if (tracking.lastPolledAt && Date.now() - tracking.lastPolledAt.getTime() < MIN_INTERVAL_MS) {
    return res.json({ added: 0, skipped: true });
  }

  try {
    const result = await syncUser(req.user._id);
    if (result.status === "revoked") {
      return res.status(403).json({ error: "Log in with Spotify again to resume tracking." });
    }
    res.json({ added: result.added, gap: result.gap });
  } catch (error) {
    console.error("[Sync] Sync now failed:", error.message);
    await recordSyncFailure(req.user._id, error);
    res.status(502).json({ error: "Spotify could not be reached. Please try again." });
  }
}
