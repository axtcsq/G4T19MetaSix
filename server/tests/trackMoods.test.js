// Run with: npm test
// Which mood tag each kind of stored song gets.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toMoods } from "../controller/trackController.js";

const analysed = {
  moods: { sound: { name: "Euphoric" }, lyrics: { name: "Deceptively upbeat" } },
  lyrics: { status: "found", valence: 0.49 },
  analysis: { status: "done", attempts: 1 },
};

// A done song whose lyrics reading is really the sound reading.
const withLyrics = (lyrics) => ({
  moods: { sound: { name: "Serene" }, lyrics: { name: "Serene" } },
  lyrics,
  analysis: { status: "done", attempts: 1 },
});

describe("toMoods", () => {
  it("includes stored tempo when available and omits invalid or missing tempo", () => {
    assert.equal(toMoods({ ...analysed, features: { tempo: 174.1 } }, true).tempo, 174.1);
    for (const tempo of [undefined, null, 0, -10, NaN, Infinity]) {
      assert.equal(Object.hasOwn(toMoods({ ...analysed, features: { tempo } }, true), "tempo"), false);
    }
  });
  it("gives both readings with their journal mood", () => {
    assert.deepEqual(toMoods(analysed, true), {
      sound: { name: "Euphoric", axis: "happy" },
      lyrics: { name: "Deceptively upbeat", axis: "anxious" },
      lyricsNote: null,
    });
  });

  it("leaves the lyrics out, with no note, when the user turned lyrics off", () => {
    const tag = toMoods(analysed, false);
    assert.equal(tag.lyrics, null);
    assert.equal(tag.lyricsNote, null);
  });

  it("notes lyrics still to come on a partial song", () => {
    const partial = { moods: { sound: { name: "Serene" }, lyrics: null }, analysis: { status: "partial", attempts: 1 } };
    assert.deepEqual(toMoods(partial, true), {
      sound: { name: "Serene", axis: "relaxed" },
      lyrics: null,
      lyricsNote: "pending",
    });
  });

  it("notes lyrics that failed every retry as unavailable", () => {
    const stuck = { moods: { sound: { name: "Serene" }, lyrics: null }, analysis: { status: "partial", attempts: 3 } };
    assert.equal(toMoods(stuck, true).lyricsNote, "unavailable");
  });

  it("shows a searched song's sound mood while its lyrics wait for the job", () => {
    const searched = { moods: { sound: { name: "Bittersweet" }, lyrics: null }, analysis: { status: "pending", attempts: 0 } };
    assert.deepEqual(toMoods(searched, true), {
      sound: { name: "Bittersweet", axis: "sad" },
      lyrics: null,
      lyricsNote: "pending",
    });
  });

  it("notes songs whose mood is from the sound alone, and why", () => {
    assert.equal(toMoods(withLyrics({ status: "instrumental" }), true).lyricsNote, "instrumental");
    assert.equal(toMoods(withLyrics({ status: "not-found" }), true).lyricsNote, "none");
    assert.equal(toMoods(withLyrics({ status: "untranslatable" }), true).lyricsNote, "none");
    // Lyrics found, but with no emotional lines to score.
    assert.equal(toMoods(withLyrics({ status: "found", valence: null }), true).lyricsNote, "none");
  });

  it("shows songs waiting for the job as analysing", () => {
    assert.deepEqual(toMoods({ analysis: { status: "pending", attempts: 0 } }, true), { analysing: true });
    assert.deepEqual(toMoods({ analysis: { status: "failed", attempts: 2 } }, true), { analysing: true });
  });

  it("says why songs that can never get a mood have none", () => {
    assert.deepEqual(toMoods({ moods: { sound: null }, analysis: { status: "no-data", attempts: 1 } }, true), {
      noMood: "no-data",
    });
    assert.deepEqual(toMoods({ analysis: { status: "failed", attempts: 3 } }, true), { noMood: "failed" });
  });
});
