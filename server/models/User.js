import mongoose from "mongoose";

const MOOD_LENSES = ["lyrics", "sound"];
const TRACKING_STATUSES = ["active", "paused", "revoked"];

const userSchema = new mongoose.Schema(
  {
    // The account identity; "demo" for the seeded demo account.
    spotifyId: { type: String, required: true },
    displayName: { type: String, trim: true },
    avatarUrl: String,
    // IANA timezone sent by the browser at login, e.g. "Asia/Singapore".
    timezone: { type: String, default: "UTC" },
    isDemo: { type: Boolean, default: false },
    spotify: {
      // AES-256-GCM encrypted. Never sent to the client.
      refreshToken: { type: String, select: false },
      scope: String,
      tokenUpdatedAt: Date,
    },
    preferences: {
      // "sound" when the user has turned lyrics analysis off on their profile.
      moodLens: { type: String, enum: MOOD_LENSES, default: "lyrics" },
      // False stops the hourly job and Sync now saving new plays. Plays already
      // saved are kept.
      savePlays: { type: Boolean, default: true },
    },
    tracking: {
      status: { type: String, enum: TRACKING_STATUSES, default: "active" },
      // playedAt of the newest stored listen. Only move it forward with $max.
      cursor: Date,
      lastPolledAt: Date,
      consecutiveFailures: { type: Number, default: 0 },
      lastError: String,
    },
    lastLoginAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "users",
  },
);

userSchema.index({ spotifyId: 1 }, { unique: true });
userSchema.index({ "tracking.status": 1 });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export { MOOD_LENSES, TRACKING_STATUSES };
export default User;
