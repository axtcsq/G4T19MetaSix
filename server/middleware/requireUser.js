import User from "../models/User.js";

// Loads the logged-in user into req.user, or responds with 401. Put it on every
// route that reads or writes a user's data.
export async function requireUser(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const user = await User.findById(userId);
  if (!user) {
    // The account was deleted, so the session is no longer valid.
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Not logged in" });
  }

  req.user = user;
  next();
}
