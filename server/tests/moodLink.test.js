// Run with: npm test The Patterns page's line on how the user has been, journal and music together.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moodLink } from "../services/patterns.js";

const patterns = { total: 12, counts: { Happy: 7, Sad: 5 } };

describe("moodLink", () => {
  it("leads with the overall mood, then what was logged most and how the music compares", () => {
    const link = moodLink(patterns, { averageHappiness: 40 }, { main: "sad" });

    assert.equal(link.overall, "sad");
    assert.equal(link.topMood, "Happy");
    assert.equal(
      link.text,
      "Over the last 30 days, your journal and music together lean mostly sad, though you logged Happy most often (7 of your last 12 mood logs). Your top tracks average 40% happiness, so your music sounds moodier than you feel, maybe it's where you put the heavier stuff.",
    );
  });

  it("says the logged mood agrees when it points the same way, Lonely counting as sad", () => {
    assert.match(moodLink(patterns, { averageHappiness: null }, { main: "happy" }).text, /lean mostly happy, and you logged Happy/);
    const lonely = { total: 3, counts: { Lonely: 2, Happy: 1 } };
    assert.match(moodLink(lonely, { averageHappiness: null }, { main: "sad" }).text, /lean mostly sad, and you logged Lonely/);
  });

  it("names the relaxed axis calm", () => {
    assert.match(moodLink(patterns, { averageHappiness: null }, { main: "relaxed" }).text, /lean mostly calm, though/);
  });

  it("says only the overall mood when nothing has been logged", () => {
    assert.deepEqual(moodLink(null, { averageHappiness: 70 }, { main: "happy" }), {
      overall: "happy",
      text: "Over the last 30 days, your journal and music together lean mostly happy.",
    });
  });

  it("falls back to the logged moods without an overall mood, and is null with nothing at all", () => {
    assert.match(moodLink(patterns, { averageHappiness: null }, { main: null }).text, /^You logged Happy most often/);
    assert.equal(moodLink(null, { averageHappiness: 50 }, null), null);
  });
});
