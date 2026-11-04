// Run with: npm test
// The overall mood from journal entries and listening together.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { combineDays, dayAxes, journalAxes, mainAxis, musicAxes } from "../services/overallMood.js";

const close = (actual, expected) =>
  Object.entries(expected).forEach(([axis, value]) => assert.ok(Math.abs(actual[axis] - value) < 1e-9, `${axis}: ${actual[axis]} ≠ ${value}`));

describe("overall mood", () => {
  it("splits a day evenly across all its journal entries", () => {
    close(journalAxes(["Happy", "Happy", "Sad"]), { happy: 2 / 3, sad: 1 / 3, relaxed: 0 });
  });

  it("maps the journal moods without an axis: Excited is happy, Lonely sad, Tired half sad", () => {
    close(journalAxes(["Excited"]), { happy: 1 });
    close(journalAxes(["Lonely"]), { sad: 1 });
    close(journalAxes(["Tired"]), { sad: 0.5, relaxed: 0, happy: 0 });
  });

  it("turns a day's music into shares, so play counts don't matter", () => {
    close(musicAxes({ happy: 30, sad: 10, relaxed: 0, angry: 0, anxious: 0 }), { happy: 0.75, sad: 0.25 });
    close(musicAxes({ happy: 3, sad: 1 }), { happy: 0.75, sad: 0.25 });
    assert.equal(musicAxes({ happy: 0 }), null);
    assert.equal(musicAxes(undefined), null);
  });

  it("weighs the journal 60% and the music 40% on a day with both", () => {
    const day = dayAxes({ moods: ["Sad"], music: musicAxes({ happy: 1 }) });
    close(day, { sad: 0.6, happy: 0.4 });
    assert.equal(mainAxis(day), "sad");
  });

  it("uses whichever source a day has, and skips days with neither", () => {
    close(dayAxes({ moods: ["Relaxed"] }), { relaxed: 1 });
    close(dayAxes({ music: musicAxes({ angry: 2 }) }), { angry: 1 });
    assert.equal(dayAxes({}), null);
  });

  it("counts every day equally over a period and says what it's based on", () => {
    const result = combineDays([
      { date: "2026-11-01", moods: ["Happy", "Happy", "Happy", "Happy"], music: null },
      { date: "2026-11-02", moods: [], music: musicAxes({ sad: 5 }), plays: 120 },
      { date: "2026-11-03", moods: ["Sad"], music: musicAxes({ sad: 1 }), plays: 4 },
      { date: "2026-11-04", moods: [], music: null },
    ]);
    // Day 1 happy, days 2 and 3 fully sad: four entries on one day don't outweigh the others.
    close(result.axes, { happy: 1 / 3, sad: 2 / 3 });
    assert.equal(result.main, "sad");
    assert.equal(result.days.length, 3);
    assert.equal(result.journalDays, 2);
    assert.equal(result.journalEntries, 5);
    assert.equal(result.musicDays, 2);
    assert.equal(result.plays, 124);
  });

  it("has no main mood without any data", () => {
    const result = combineDays([]);
    assert.equal(result.main, null);
    assert.equal(result.days.length, 0);
  });
});
