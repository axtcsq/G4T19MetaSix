// Run with: npm test
// analyseSong with fake ReccoBeats, LRCLIB, DeepL and emotion-model responses,
// so no network or model download is needed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { analyseSong } from "../services/mood/analyse.js";
import { SCORER_VERSION } from "../services/mood/emotion.js";
import { HttpError } from "../services/mood/errors.js";

const songs = JSON.parse(readFileSync(new URL("../testdata/dark.json", import.meta.url), "utf8"));
const kicks = songs.find((song) => song.name === "Pumped Up Kicks");

const track = {
  _id: "kicks-album",
  name: kicks.name,
  artists: [{ name: kicks.artist }],
  album: { name: "Torches" },
  durationMs: 239600,
  isrc: "USSM11003435",
  analysis: { status: "pending", attempts: 0 },
};

function fakes(overrides = {}) {
  const calls = { features: 0, lyrics: 0, translate: 0 };
  const deps = {
    getAudioFeatures: async (id) => {
      calls.features += 1;
      return { id, sourceId: id, ...kicks.features };
    },
    sameRecordingIds: async () => [],
    idsForIsrc: async () => [],
    findLyrics: async () => {
      calls.lyrics += 1;
      return { instrumental: false, text: "All the other kids with the pumped up kicks" };
    },
    isEnglish: () => true,
    translateToEnglish: async () => {
      calls.translate += 1;
      return { from: "ES", english: {} };
    },
    scoreLyrics: async () => kicks.lyrics,
    toChunks: (text) => [text.split("\n")],
    ...overrides,
  };
  return { deps, calls };
}

describe("analyseSong", () => {
  it("gives both readings for an English song", async () => {
    const { deps } = fakes();
    const result = await analyseSong(track, deps);

    assert.equal(result.status, "done");
    assert.equal(result.moods.sound.name, "Euphoric");
    assert.equal(result.moods.lyrics.name, "Deceptively upbeat");
    assert.equal(result.features.sourceId, "kicks-album");
    assert.equal(result.lyrics.status, "found");
    assert.equal(result.lyrics.scorerVersion, SCORER_VERSION);
  });

  it("stores at most two highlight lines each way, as text", async () => {
    const excerpt = (text) => ({ text, translation: `${text} (en)` });
    const { deps } = fakes({
      scoreLyrics: async () => ({
        ...kicks.lyrics,
        highlights: { positive: ["a", "b", "c"].map(excerpt), negative: [excerpt("d")] },
      }),
    });
    const { lyrics } = await analyseSong(track, deps);

    assert.deepEqual(lyrics.highlights, { positive: ["a", "b"], negative: ["d"] });
  });

  it("saves the ID ReccoBeats matched through a fallback", async () => {
    const { deps } = fakes({
      getAudioFeatures: async (id, { fallbacks }) => {
        const [single] = await fallbacks[0]();
        return { id, sourceId: single, ...kicks.features };
      },
      sameRecordingIds: async ({ isrc }) => (isrc === track.isrc ? ["kicks-single"] : []),
    });
    const { features } = await analyseSong(track, deps);

    assert.equal(features.sourceId, "kicks-single");
  });

  it("marks a song ReccoBeats doesn't have as no-data, without fetching lyrics", async () => {
    const { deps, calls } = fakes({
      getAudioFeatures: async () => {
        throw new HttpError(404, "No audio features found for this track.");
      },
    });
    const result = await analyseSong(track, deps);

    assert.equal(result.status, "no-data");
    assert.equal(calls.lyrics, 0);
  });

  it("lets other ReccoBeats errors through, so the song is retried", async () => {
    const { deps } = fakes({
      getAudioFeatures: async () => {
        throw new HttpError(502, "ReccoBeats returned 503.");
      },
    });

    await assert.rejects(analyseSong(track, deps), /ReccoBeats/);
  });

  it("keeps the sound reading when DeepL fails, as partial", async () => {
    const { deps } = fakes({
      isEnglish: () => false,
      translateToEnglish: async () => {
        throw new Error("DEEPL_API_KEY is not set");
      },
    });
    const result = await analyseSong(track, deps);

    assert.equal(result.status, "partial");
    assert.equal(result.lyrics.status, "untranslated");
    assert.equal(result.moods.sound.name, "Euphoric");
    assert.equal(result.moods.lyrics, null);
  });

  it("scores translated lyrics and records the language", async () => {
    const { deps } = fakes({ isEnglish: () => false });
    const result = await analyseSong(track, deps);

    assert.equal(result.status, "done");
    assert.equal(result.lyrics.translatedFrom, "ES");
  });

  it("treats lyrics DeepL can't place as final", async () => {
    const { deps } = fakes({
      isEnglish: () => false,
      translateToEnglish: async () => ({ from: null, english: null }),
    });
    const result = await analyseSong(track, deps);

    assert.equal(result.status, "done");
    assert.equal(result.lyrics.status, "untranslatable");
    assert.equal(result.moods.lyrics.name, result.moods.sound.name);
  });

  it("keeps the sound reading when LRCLIB is down, as partial", async () => {
    const { deps } = fakes({
      findLyrics: async () => {
        throw new Error("LRCLIB returned 503");
      },
    });
    const result = await analyseSong(track, deps);

    assert.equal(result.status, "partial");
    assert.equal(result.lyrics.status, "unavailable");
  });

  it("on a retry, reuses the stored features and only redoes the lyrics", async () => {
    const partial = {
      ...track,
      features: { ...kicks.features, sourceId: "kicks-album" },
      lyrics: { status: "untranslated", scorerVersion: SCORER_VERSION },
      analysis: { status: "partial", attempts: 1 },
    };
    const { deps, calls } = fakes();
    const result = await analyseSong(partial, deps);

    assert.equal(calls.features, 0);
    assert.equal(calls.lyrics, 1);
    assert.equal(result.status, "done");
    assert.equal(result.moods.lyrics.name, "Deceptively upbeat");
  });

  it("doesn't fetch lyrics again when they're already scored", async () => {
    const done = {
      ...track,
      features: { ...kicks.features },
      lyrics: { ...kicks.lyrics, scorerVersion: SCORER_VERSION },
    };
    const { deps, calls } = fakes();
    await analyseSong(done, deps);

    assert.equal(calls.lyrics, 0);
  });
});
