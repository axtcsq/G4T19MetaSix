// Run with: npm test The rough mood for songs with lyrics but no sound data.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lyricsOnlyMood } from "../services/mood/mood.js";

const words = (valence, emotions = {}, emotionalShare = 0.6) => ({
  status: "found",
  valence,
  emotionalShare,
  emotions: { joy: 0, anger: 0, disgust: 0, ...emotions },
});

describe("lyricsOnlyMood", () => {
  it("names positive lyrics Uplifting and negative ones Melancholic", () => {
    // The lyric model's neutral point is 0.25, not 0.5.
    assert.equal(lyricsOnlyMood(words(0.6, { joy: 0.5 })).name, "Uplifting");
    assert.equal(lyricsOnlyMood(words(0.3)).name, "Uplifting");
    assert.equal(lyricsOnlyMood(words(0.15, { joy: 0.02 })).name, "Melancholic");
  });

  it("names angry lyrics without joy Aggressive", () => {
    assert.deepEqual(lyricsOnlyMood(words(0.1, { anger: 0.3, disgust: 0.1 })), { tone: "tense", name: "Aggressive" });
    assert.equal(lyricsOnlyMood(words(0.1, { anger: 0.3, disgust: 0.1, joy: 0.2 })).name, "Melancholic");
  });

  it("gives no mood without readable, emotional lyrics", () => {
    assert.equal(lyricsOnlyMood(null), null);
    assert.equal(lyricsOnlyMood({ status: "not-found" }), null);
    assert.equal(lyricsOnlyMood(words(0.6, { joy: 0.5 }, 0.1)), null);
  });
});
