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

  it("lists every music mood under the mood it counts towards", () => {
    const rows = [row("2026-10-01", "Melancholic", 5), row("2026-10-01", "Bittersweet", 3), row("2026-10-02", "Euphoric", 2)];
    const summary = summariseMusicMoods(rows, new Map(), true);

    assert.deepEqual(summary.moods, [
      { name: "Melancholic", axis: "sad", plays: 5, share: 50, mixed: false },
      { name: "Bittersweet", axis: "sad", plays: 3, share: 30, mixed: true },
      { name: "Euphoric", axis: "happy", plays: 2, share: 20, mixed: false },
    ]);
  });

  it("counts logged days whose music matched the logged mood", () => {
    const rows = [row("2026-10-01", "Melancholic", 3), row("2026-10-02", "Euphoric", 3), row("2026-10-03", "Serene", 1)];
    const moods = new Map([
      ["2026-10-01", ["Sad"]],
      ["2026-10-02", ["Angry"]],
    ]);
    const summary = summariseMusicMoods(rows, moods, false);

    assert.equal(summary.comparedDays, 2);
    assert.equal(summary.matchedDays, 1);
  });

  it("weighs every entry of a logged day, and maps moods like Lonely onto the music's moods", () => {
    const rows = [row("2026-10-01", "Euphoric", 3), row("2026-10-02", "Melancholic", 2), row("2026-10-03", "Melancholic", 1)];
    const moods = new Map([
      // Mostly happy, though the last entry was Sad.
      ["2026-10-01", ["Sad", "Happy", "Happy"]],
      // Logged Happy last, but mostly sad.
      ["2026-10-02", ["Happy", "Sad", "Sad"]],
      ["2026-10-03", ["Lonely"]],
    ]);
    const summary = summariseMusicMoods(rows, moods, false);

    assert.equal(summary.comparedDays, 3);
    assert.equal(summary.matchedDays, 3);
  });
});
