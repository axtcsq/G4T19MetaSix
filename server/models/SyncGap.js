import mongoose from "mongoose";

// A period where a user's plays may be missing.
const syncGapSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    detectedAt: { type: Date, default: Date.now },
  },
  {
    collection: "syncGaps",
  },
);

syncGapSchema.index({ userId: 1, from: -1 });

const SyncGap = mongoose.models.SyncGap || mongoose.model("SyncGap", syncGapSchema);

export default SyncGap;
