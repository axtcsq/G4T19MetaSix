// Run with: npm test
// Which mood tag each kind of stored song gets.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toMoods } from "../controller/trackController.js";

const analysed = {
  moods: { sound: { name: "Euphoric" }, lyrics: { name: "Deceptively upbeat" } },
  analysis: { status: "done", attempts: 1 },
};

describe("toMoods", () => {
  it("gives both readings with their journal mood", () => {
    assert.deepEqual(toMoods(analysed, true), {
      sound: { name: "Euphoric", axis: "happy" },
      lyrics: { name: "Deceptively upbeat", axis: "anxious" },
      lyricsPending: false,
    });
  });

  it("leaves the lyrics reading out when the user turned lyrics off", () => {
    const tag = toMoods(analysed, false);
    assert.equal(tag.lyrics, null);
    assert.equal(tag.lyricsPending, false);
  });

  it("marks lyrics still to come on a partial song", () => {
    const partial = { moods: { sound: { name: "Serene" }, lyrics: null }, analysis: { status: "partial", attempts: 1 } };
    assert.deepEqual(toMoods(partial, true), {
      sound: { name: "Serene", axis: "relaxed" },
      lyrics: null,
      lyricsPending: true,
    });
  });

  it("shows songs waiting for the job as analysing", () => {
    assert.deepEqual(toMoods({ analysis: { status: "pending", attempts: 0 } }, true), { analysing: true });
    assert.deepEqual(toMoods({ analysis: { status: "failed", attempts: 2 } }, true), { analysing: true });
  });

  it("gives no tag to songs that can never get a mood", () => {
    assert.equal(toMoods({ moods: { sound: null }, analysis: { status: "no-data", attempts: 1 } }, true), null);
    assert.equal(toMoods({ analysis: { status: "failed", attempts: 3 } }, true), null);
  });
});
