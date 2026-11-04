// Run with: npm test
// recommendSongs with fake Last.fm, Spotify, ReccoBeats and database answers.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendSongs } from "../services/recommendations.js";

const HAPPY = { valence: 0.8, energy: 0.7, danceability: 0.4, acousticness: 0.5, instrumentalness: 0 };
const SAD = { valence: 0.2, energy: 0.3, danceability: 0.3, acousticness: 0.6, instrumentalness: 0 };

// Spotify search results for an artist: [song name, features] pairs.
function song(id, name, artist) {
  return {
    id: id.padEnd(22, "0"),
    name,
    artists: [{ id: `${artist}-id`, name: artist }],
    album: { name: `${name} album`, images: [{ url: `big-${id}` }, { url: `small-${id}` }] },
    external_urls: { spotify: `https://open.spotify.com/track/${id}` },
  };
}

// A stored song whose sound and lyrics have both been read.
const analysed = (family, name = family, { instrumentalness = 0, lyrics = { family, name } } = {}) => ({
  analysis: { status: "done" },
  moods: { sound: { name: `${name} (sound)`, family }, lyrics },
  features: { instrumentalness },
  lyrics: { status: instrumentalness >= 0.5 ? "instrumental" : "found" },
});

function fakes({ similar = {}, catalogue = {}, features = {}, stored = {}, library = [], history = { artists: [], played: new Set() } } = {}) {
  const calls = { searches: [], saved: [], filled: [] };
  const deps = {
    similarArtists: async (name) => similar[name] ?? [],
    searchTracks: async (query) => {
      calls.searches.push(query);
      const artist = query.match(/artist:"(.+)"/)[1];
      return catalogue[artist] ?? [];
    },
    fetchFeatures: async (ids) => new Map(ids.filter((id) => features[id]).map((id) => [id, features[id]])),
    storedSongs: async (ids) => new Map(ids.filter((id) => stored[id]).map((id) => [id, stored[id]])),
    analysedSongs: async (query) => {
      calls.filled.push(query);
      return library.filter(
        (track) => !query.exclude.includes(track._id) && track.artists.some((a) => query.artists.includes(a.name)),
      );
    },
    listeningHistory: async () => history,
    saveSongs: async (picks) => calls.saved.push(...picks.map((pick) => pick.track.id)),
  };
  return { deps, calls };
}

const request = { target: "happy", artists: [{ name: "keshi", plays: 10 }], mix: { vocal: 4, instrumental: 0 } };

describe("recommendSongs", () => {
  it("suggests fully analysed songs by similar artists whose mood matches", async () => {
    const bright = song("bright", "Bright", "slchld");
    const gloomy = song("gloomy", "Gloomy", "slchld");
    const { deps, calls } = fakes({
      similar: { keshi: [{ name: "slchld", match: 1 }] },
      catalogue: { slchld: [gloomy, bright] },
      stored: { [bright.id]: analysed("happy", "Euphoric"), [gloomy.id]: analysed("sad", "Melancholic") },
    });
    const tracks = await recommendSongs(request, deps);

    assert.deepEqual(calls.searches, ['artist:"slchld"']);
    assert.deepEqual(tracks.map((track) => track.name), ["Bright"]);
    assert.equal(tracks[0].because, "Similar to keshi");
    assert.equal(tracks[0].imageUrl, "small-bright");
    assert.deepEqual(tracks[0].mood, { name: "Euphoric", family: "happy" });
    assert.deepEqual(calls.saved, []);
  });

  it("never suggests songs whose lyrics are still pending, or unanalysed songs", async () => {
    const pending = song("pending", "Pending", "slchld");
    const fresh = song("fresh", "Fresh", "slchld");
    const { deps } = fakes({
      similar: { keshi: [{ name: "slchld", match: 1 }] },
      catalogue: { slchld: [pending, fresh] },
      features: { [fresh.id]: HAPPY },
      stored: {
        [pending.id]: { ...analysed("happy"), analysis: { status: "partial" }, moods: { sound: { name: "Euphoric", family: "happy" }, lyrics: null } },
      },
    });

    assert.deepEqual(await recommendSongs(request, deps), []);
  });

  it("queues new songs whose sound matches, so later refreshes can suggest them", async () => {
    const bright = song("bright", "Bright", "slchld");
    const gloomy = song("gloomy", "Gloomy", "slchld");
    const known = song("known", "Known", "slchld");
    const { deps, calls } = fakes({
      similar: { keshi: [{ name: "slchld", match: 1 }] },
      catalogue: { slchld: [bright, gloomy, known] },
      features: { [bright.id]: HAPPY, [gloomy.id]: SAD, [known.id]: HAPPY },
      stored: { [known.id]: { ...analysed("happy"), analysis: { status: "pending" } } },
    });
    await recommendSongs(request, deps);

    // Already-stored songs are left to the job; only the new happy one is queued.
    assert.deepEqual(calls.saved, [bright.id]);
  });

  it("still suggests analysed songs when ReccoBeats is down", async () => {
    const ready = song("ready", "Ready", "slchld");
    const fresh = song("fresh", "Fresh", "slchld");
    const { deps, calls } = fakes({
      similar: { keshi: [{ name: "slchld", match: 1 }] },
      catalogue: { slchld: [ready, fresh] },
      stored: { [ready.id]: analysed("happy") },
    });
    deps.fetchFeatures = async () => {
      throw new Error("ReccoBeats 503");
    };
    const tracks = await recommendSongs(request, deps);

    assert.deepEqual(tracks.map((track) => track.name), ["Ready"]);
    assert.deepEqual(calls.saved, []);
  });

  it("matches on the lyrics reading, or the sound alone when lyrics are off", async () => {
    // Sounds happy, but the lyrics make it calm overall.
    const mixed = song("mixed", "Mixed", "HYBS");
    const stored = { [mixed.id]: analysed("happy", "Uplifting", { lyrics: { name: "Serene", family: "calm" } }) };
    const options = { similar: { keshi: [{ name: "HYBS", match: 0.7 }] }, catalogue: { HYBS: [mixed] }, stored };

    const calm = await recommendSongs({ ...request, target: "calm" }, fakes(options).deps);
    assert.deepEqual(calm.map((track) => track.mood.name), ["Serene"]);
    const soundOnly = await recommendSongs({ ...request, useLyrics: false }, fakes(options).deps);
    assert.deepEqual(soundOnly.map((track) => track.mood.name), ["Uplifting (sound)"]);
    assert.deepEqual(await recommendSongs({ ...request, target: "calm", useLyrics: false }, fakes(options).deps), []);
  });

  it("only suggests lyrics-only songs to users with lyrics on", async () => {
    const words = song("words", "Words", "HYBS");
    const stored = {
      [words.id]: {
        analysis: { status: "done" },
        moods: { sound: null, lyrics: { name: "Uplifting", family: "happy", lyricsOnly: true } },
        lyrics: { status: "found" },
      },
    };
    const options = { similar: { keshi: [{ name: "HYBS", match: 0.7 }] }, catalogue: { HYBS: [words] }, stored };

    assert.equal((await recommendSongs(request, fakes(options).deps)).length, 1);
    assert.deepEqual(await recommendSongs({ ...request, useLyrics: false }, fakes(options).deps), []);
  });

  it("fills up to four from analysed songs by similar artists, then the user's own artists", async () => {
    const ready = song("ready", "Ready", "slchld");
    const stored = (id, name, artist, family = "happy") => ({
      _id: id.padEnd(22, "0"),
      name,
      artists: [{ id: `${artist}-id`, name: artist }],
      album: { imageUrl: `cover-${id}` },
      ...analysed(family, `${name} mood`),
    });
    const heard = stored("heard", "Heard Before", "Rini");
    const { deps, calls } = fakes({
      similar: { keshi: [{ name: "slchld", match: 1 }, { name: "HYBS", match: 0.5 }] },
      catalogue: { slchld: [ready] },
      stored: { [ready.id]: analysed("happy", "Ready mood") },
      library: [
        heard,
        stored("stranger", "Stranger", "Not Theirs"),
        stored("byhybs", "By HYBS", "HYBS"),
        stored("sadhybs", "Sad HYBS", "HYBS", "sad"),
        stored("fresh", "Never Played", "Rini"),
        stored("newer", "Also New", "Laufey"),
      ],
      history: { artists: ["keshi", "Rini", "Laufey"], played: new Set([heard._id]) },
    });
    const tracks = await recommendSongs({ ...request, exclude: ["x".repeat(22)], userId: "user-1" }, deps);

    // Similar artists first, then the user's artists, songs they've never played before ones they have.
    assert.deepEqual(tracks.map((track) => track.name), ["Ready", "By HYBS", "Never Played", "Also New"]);
    assert.equal(tracks[1].because, "Similar to keshi");
    assert.equal(tracks[1].imageUrl, "cover-byhybs");
    assert.equal(tracks[2].because, "From Rini");
    assert.deepEqual(tracks[3].mood, { name: "Also New mood", family: "happy" });
    assert.equal(calls.filled[0].family, "happy");
    assert.deepEqual(calls.filled[0].artists, ["slchld", "HYBS"]);
    assert.deepEqual(calls.filled[0].exclude, ["x".repeat(22), ready.id]);
    assert.deepEqual(calls.filled[1].artists, ["keshi", "Rini", "Laufey"]);
  });

  it("suggests a song the user played in an earlier month when nothing new is left", async () => {
    const stored = {
      _id: "old".padEnd(22, "0"),
      name: "Old Favourite",
      artists: [{ id: "rini-id", name: "Rini" }],
      album: {},
      ...analysed("happy"),
    };
    const { deps } = fakes({
      similar: { keshi: [{ name: "slchld", match: 1 }] },
      library: [stored],
      history: { artists: ["Rini"], played: new Set([stored._id]) },
    });

    const tracks = await recommendSongs({ ...request, userId: "user-1" }, deps);
    assert.deepEqual(tracks.map((track) => track.name), ["Old Favourite"]);
  });

  it("doesn't ask the database when the searched songs fill the picks", async () => {
    const catalogue = {};
    const stored = {};
    for (const artist of ["A1", "A2", "A3", "A4"]) {
      catalogue[artist] = [song(`${artist}s`, artist, artist)];
      stored[catalogue[artist][0].id] = analysed("happy");
    }
    const { deps, calls } = fakes({
      similar: { keshi: ["A1", "A2", "A3", "A4"].map((name) => ({ name, match: 1 })) },
      catalogue,
      stored,
    });

    assert.equal((await recommendSongs(request, deps)).length, 4);
    assert.deepEqual(calls.filled, []);
  });

  it("doesn't suggest the user's own artists, songs they played, or another artist's songs", async () => {
    const played = song("played", "Played", "Rini");
    const fresh = song("fresh", "Fresh", "Rini");
    const cover = song("cover", "Cover", "Someone Else");
    const { deps } = fakes({
      similar: { keshi: [{ name: "keshi", match: 1 }, { name: "Rini", match: 0.8 }] },
      catalogue: { Rini: [played, cover, fresh] },
      stored: { [played.id]: analysed("happy"), [fresh.id]: analysed("happy"), [cover.id]: analysed("happy") },
    });
    const tracks = await recommendSongs({ ...request, exclude: [played.id] }, deps);

    assert.deepEqual(tracks.map((track) => track.name), ["Fresh"]);
  });

  it("spreads picks across artists and the user's top artists", async () => {
    const catalogue = {};
    const stored = {};
    for (const artist of ["A1", "A2", "B1"]) {
      catalogue[artist] = [1, 2, 3].map((n) => song(`${artist}s${n}`, `${artist} ${n}`, artist));
      catalogue[artist].forEach((track) => (stored[track.id] = analysed("happy")));
    }
    const { deps } = fakes({
      similar: {
        keshi: [{ name: "A1", match: 1 }, { name: "A2", match: 0.9 }],
        Rini: [{ name: "B1", match: 1 }],
      },
      catalogue,
      stored,
    });
    const tracks = await recommendSongs(
      { ...request, artists: [{ name: "keshi", plays: 10 }, { name: "Rini", plays: 5 }] },
      deps,
    );

    assert.equal(tracks.length, 4);
    // Each artist once before any gets a second song.
    assert.deepEqual(new Set(tracks.slice(0, 3).map((track) => track.artists[0])), new Set(["A1", "A2", "B1"]));
  });

  it("follows the vocal/instrumental mix", async () => {
    const tracks = [1, 2, 3, 4].map((n) => song(`v${n}`, `Vocal ${n}`, `V${n}`));
    const pieces = [1, 2].map((n) => song(`i${n}`, `Piece ${n}`, `I${n}`));
    const stored = {};
    tracks.forEach((track) => (stored[track.id] = analysed("happy")));
    pieces.forEach((track) => (stored[track.id] = analysed("happy", "happy", { instrumentalness: 0.9 })));
    const { deps } = fakes({
      similar: { keshi: [...tracks, ...pieces].map((track, index) => ({ name: track.artists[0].name, match: 1 - index / 10 })) },
      catalogue: Object.fromEntries([...tracks, ...pieces].map((track) => [track.artists[0].name, [track]])),
      stored,
    });
    const picks = await recommendSongs({ ...request, mix: { vocal: 2, instrumental: 2 } }, deps);

    assert.equal(picks.filter((pick) => pick.instrumental).length, 2);
    assert.equal(picks.filter((pick) => !pick.instrumental).length, 2);
  });

  it("falls back to the user's own artists without Last.fm", async () => {
    const own = song("own", "Own", "keshi");
    const { deps, calls } = fakes({ catalogue: { keshi: [own] }, stored: { [own.id]: analysed("happy") } });
    const tracks = await recommendSongs(request, deps);

    assert.equal(tracks[0].because, "From keshi");
    assert.deepEqual(calls.searches, ['artist:"keshi"']);
  });

  it("stops searching when Spotify rate-limits, keeping what it found", async () => {
    const first = song("first", "First", "A1");
    const { deps, calls } = fakes({
      similar: { keshi: [{ name: "A1", match: 1 }, { name: "A2", match: 0.9 }, { name: "A3", match: 0.8 }] },
      catalogue: { A1: [first] },
      stored: { [first.id]: analysed("happy") },
    });
    const search = deps.searchTracks;
    deps.searchTracks = async (query) => {
      if (query.includes("A2")) throw Object.assign(new Error("Spotify 429"), { status: 429 });
      return search(query);
    };
    const tracks = await recommendSongs(request, deps);

    assert.deepEqual(tracks.map((track) => track.name), ["First"]);
    assert.equal(calls.searches.length, 1);
  });
});
