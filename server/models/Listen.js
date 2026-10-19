import mongoose from "mongoose";

const LISTEN_SOURCES = ["spotify-api", "spotify-export", "seed"];

// One document per play. A replay has a new playedAt, so it is a new listen.
const listenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Spotify track ID, the _id of the song in tracks.
    trackId: { type: String, ref: "Track", required: true },
    playedAt: { type: Date, required: true },
    // "YYYY-MM-DD" in the user's timezone at sync time.
    localDate: { type: String, required: true },
    source: { type: String, enum: LISTEN_SOURCES, required: true },
    // Playlist or album the song was played from, if any.
    context: {
      type: { type: String },
      uri: String,
    },
  },
  {
    collection: "listens",
  },
);

// Drops the same play fetched by two overlapping syncs.
listenSchema.index({ userId: 1, playedAt: -1 }, { unique: true });
listenSchema.index({ userId: 1, localDate: 1 });
listenSchema.index({ trackId: 1 });

const Listen = mongoose.models.Listen || mongoose.model("Listen", listenSchema);

export { LISTEN_SOURCES };
export default Listen;
