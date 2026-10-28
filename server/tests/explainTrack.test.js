// Run with: npm test
// What the song page explains for each kind of stored song.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { explainTrack } from "../controller/trackController.js";
import { trackMoods } from "../services/mood/index.js";

const songs = JSON.parse(readFileSync(new URL("../testdata/dark.json", import.meta.url), "utf8"));
const kicks = songs.find((song) => song.name === "Pumped Up Kicks");

const stored = {
  features: kicks.features,
  lyrics: { ...kicks.lyrics, highlights: { positive: [], negative: ["All the other kids / with the pumped up kicks"] } },
  moods: trackMoods(kicks.features, kicks.lyrics),
  analysis: { status: "done", attempts: 1 },
};

describe("explainTrack", () => {
  it("explains both readings, the blend and the lyrics", () => {
    const page = explainTrack(stored, true);

    assert.equal(page.sound.name, "Euphoric");
    assert.equal(page.sound.axis, "happy");
    assert.ok(page.sound.blurb.length > 0);
    assert.equal(page.withLyrics.name, "Deceptively upbeat");
    assert.equal(page.withLyrics.axis, "anxious");
    assert.equal(page.blend.contrast, "dark-words");
    assert.equal(page.blend.contrastLabel, "Upbeat sound, darker words");
    assert.deepEqual(
      page.features.map((feature) => feature.key),
      ["valence", "energy", "danceability"],
    );
    assert.equal(page.features[0].value, kicks.features.valence);
    assert.equal(page.lyrics.highlights.negative.length, 1);
    // Strongest feelings first, neutral left out.
    assert.equal(page.lyrics.emotions[0][0], "anger");
    assert.ok(page.lyrics.emotions.every(([emotion]) => emotion !== "neutral"));
  });

  it("shows the sound reading only when the user turned lyrics off", () => {
    const page = explainTrack(stored, false);

    assert.equal(page.lyricsOff, true);
    assert.equal(page.withLyrics, null);
    assert.equal(page.lyrics, undefined);
    assert.equal(page.blend.lyrics, null);
    assert.equal(page.blend.valence, kicks.features.valence);
  });

  it("has no lyrics reading for a searched song whose lyrics aren't read yet", () => {
    const searched = {
      features: kicks.features,
      lyrics: null,
      moods: { sound: { name: "Euphoric" }, lyrics: null },
      analysis: { status: "pending", attempts: 0 },
    };
    const page = explainTrack(searched, true);

    assert.equal(page.tag.lyricsNote, "pending");
    assert.equal(page.sound.name, "Euphoric");
    assert.equal(page.withLyrics, null);
    assert.equal(page.lyrics, undefined);
  });

  it("explains nothing beyond the tag for a song with no audio data", () => {
    const page = explainTrack({ moods: { sound: null }, analysis: { status: "no-data", attempts: 1 } }, true);

    assert.deepEqual(page, { tag: { noMood: "no-data" }, lyricsOff: false });
  });
});
