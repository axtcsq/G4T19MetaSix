// Run with: npm test
// The music-mood summary on the Personality page.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summariseMusicMoods } from "../services/moodMusic.js";

const row = (date, mood, plays) => ({ _id: { date, mood }, plays });

describe("summariseMusicMoods", () => {
  it("is null before any played song has a mood", () => {
    assert.equal(summariseMusicMoods([], new Map(), true), null);
  });

  it("lists the moods played most, with their journal mood", () => {
    const rows = [row("2026-10-01", "Melancholic", 6), row("2026-10-01", "Euphoric", 2), row("2026-10-02", "Serene", 2)];
    const summary = summariseMusicMoods(rows, new Map(), true);

    assert.equal(summary.plays, 10);
    assert.equal(summary.lens, "lyrics");
    assert.deepEqual(summary.top[0], { name: "Melancholic", axis: "sad", plays: 6, share: 60 });
    assert.deepEqual(summary.axes, [
      { axis: "happy", share: 20 },
      { axis: "relaxed", share: 20 },
      { axis: "sad", share: 60 },
    ]);
  });

  it("counts logged days whose music matched the logged mood", () => {
    const rows = [row("2026-10-01", "Melancholic", 3), row("2026-10-02", "Euphoric", 3), row("2026-10-03", "Serene", 1)];
    const moods = new Map([
      ["2026-10-01", "Sad"],
      ["2026-10-02", "Angry"],
    ]);
    const summary = summariseMusicMoods(rows, moods, false);

    assert.equal(summary.comparedDays, 2);
    assert.equal(summary.matchedDays, 1);
  });
});
