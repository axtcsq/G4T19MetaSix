import User from "../models/User.js";

// Puts the logged-in user on req.user or sends a 401. Use on every route that touches a user's data.
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
