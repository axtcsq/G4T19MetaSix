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
    // "YYYY-MM-DD", set on the profile. Used for the star sign.
    birthday: { type: String, default: null },
    // The journal entry pinned to the profile page.
    pinnedEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "MoodLog", default: null },
    // Home's metaphor of the day, kept so Groq writes it once a day. key is
    // the date and that day's check-in moods, so a new check-in gets a new line.
    dailyMetaphor: {
      key: String,
      text: String,
      mood: String,
      genre: String,
    },
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
      // "HH:MM" in the user's own time, or null for no check-in reminder.
      reminderTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, default: null },
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
