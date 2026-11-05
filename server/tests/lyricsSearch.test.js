// Finding lyrics when LRCLIB credits a song differently from Spotify.
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { baseTitle, findLyrics } from "../services/mood/lyrics.js";

const song = {
  name: "I (feat. Enon Kawatani)",
  artists: [{ name: "Ichika Nito" }, { name: "Enon Kawatani" }],
  album: { name: "I" },
  duration_ms: 227000,
};
const hit = (fields) => ({
  trackName: "I (feat. Enon Kawatani)",
  artistName: "Ichika",
  duration: 227,
  instrumental: false,
  plainLyrics: "Some words",
  ...fields,
});

// Answers each request from what it asks for. Returns the requests made.
function lrclib(answer) {
  const asked = [];
  mock.method(globalThis, "fetch", async (url) => {
    const { pathname, searchParams } = new URL(url);
    const params = Object.fromEntries(searchParams);
    asked.push({ path: pathname.replace("/api", ""), ...params });
    const body = answer(pathname.replace("/api", ""), params);
    return { ok: body != null, status: body == null ? 404 : 200, json: async () => body, headers: new Headers() };
  });
  return asked;
}
// Nothing from the exact lookup or the search on the full artist name.
const onlyWide = (hits) => (path, params) => {
  if (path === "/get") return null;
  return params.artist_name === "Ichika Nito" ? [] : hits(params);
};

afterEach(() => mock.restoreAll());

describe("baseTitle", () => {
  it("removes credits and remaster notes but keeps the rest", () => {
    assert.equal(baseTitle("I (feat. Enon Kawatani)"), "I");
    assert.equal(baseTitle("Song [with Someone]"), "Song");
    assert.equal(baseTitle("Song ft. Someone"), "Song");
    assert.equal(baseTitle("Song - 2011 Remaster"), "Song");
    assert.equal(baseTitle("Song (Live)"), "Song (Live)");
    assert.equal(baseTitle("Feat"), "Feat");
  });
});

describe("findLyrics", () => {
  it("finds a song LRCLIB credits under a shorter artist name", async () => {
    lrclib(onlyWide(() => [hit()]));
    assert.deepEqual(await findLyrics(song), { instrumental: false, text: "Some words" });
  });

  it("matches the title without its credits", async () => {
    lrclib(onlyWide((params) => (params.artist_name === "ichika" ? [hit({ trackName: "I (feat. 川谷絵音)" })] : [])));
    assert.equal((await findLyrics(song)).text, "Some words");
  });

  it("does not take a different song by the same artist", async () => {
    lrclib(onlyWide(() => [hit({ trackName: "i miss you", plainLyrics: "Wrong song" })]));
    assert.equal(await findLyrics(song), null);
  });

  it("does not take the same title by a different artist", async () => {
    lrclib(onlyWide(() => [hit({ artistName: "Someone Else", plainLyrics: "Wrong artist" })]));
    assert.equal(await findLyrics(song), null);
  });

  it("does not take a hit of a different length", async () => {
    lrclib(onlyWide(() => [hit({ duration: 240, plainLyrics: "Wrong length" })]));
    assert.equal(await findLyrics(song), null);
  });

  it("prefers lyrics over an instrumental mark on another copy", async () => {
    lrclib(onlyWide(() => [hit({ instrumental: true, plainLyrics: null }), hit()]));
    assert.equal((await findLyrics(song)).instrumental, false);
  });

  it("keeps looking when the exact match has no lyrics", async () => {
    lrclib((path) => (path === "/get" ? hit({ plainLyrics: null }) : [hit({ artistName: "Ichika Nito" })]));
    assert.equal((await findLyrics(song)).text, "Some words");
  });

  it("makes no extra requests when the exact match has lyrics", async () => {
    const asked = lrclib(() => hit({ artistName: "Ichika Nito" }));
    await findLyrics(song);
    assert.equal(asked.length, 1);
  });

  it("stops after two wider searches when LRCLIB has nothing", async () => {
    const asked = lrclib(onlyWide(() => []));
    assert.equal(await findLyrics(song), null);
    assert.equal(asked.length, 4);
  });
});
