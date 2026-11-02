// Run with: npm test
// recommendSongs with fake Last.fm, Spotify and ReccoBeats answers.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendSongs } from "../services/recommendations.js";

const HAPPY = { valence: 0.8, energy: 0.7, danceability: 0.4, acousticness: 0.5, instrumentalness: 0 };
const CALM = { valence: 0.7, energy: 0.2, danceability: 0.3, acousticness: 0.8, instrumentalness: 0 };
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

function fakes({ similar = {}, catalogue = {}, features = {} } = {}) {
  const calls = { searches: [], saved: [] };
  const deps = {
    similarArtists: async (name) => similar[name] ?? [],
    searchTracks: async (query) => {
      calls.searches.push(query);
      const artist = query.match(/artist:"(.+)"/)[1];
      return catalogue[artist] ?? [];
    },
    fetchFeatures: async (ids) => new Map(ids.filter((id) => features[id]).map((id) => [id, features[id]])),
    saveSongs: async (picks) => calls.saved.push(...picks.map((pick) => pick.track.id)),
  };
  return { deps, calls };
}

const request = { target: "happy", artists: [{ name: "keshi", plays: 10 }], mix: { vocal: 4, instrumental: 0 } };

describe("recommendSongs", () => {
  it("suggests songs by similar artists whose sound matches the mood", async () => {
    const bright = song("bright", "Bright", "slchld");
    const gloomy = song("gloomy", "Gloomy", "slchld");
    const { deps, calls } = fakes({
      similar: { keshi: [{ name: "slchld", match: 1 }] },
      catalogue: { slchld: [gloomy, bright] },
      features: { [bright.id]: HAPPY, [gloomy.id]: SAD },
    });
    const tracks = await recommendSongs(request, deps);

    assert.deepEqual(calls.searches, ['artist:"slchld"']);
    assert.deepEqual(tracks.map((track) => track.name), ["Bright"]);
    assert.equal(tracks[0].because, "Similar to keshi");
    assert.equal(tracks[0].imageUrl, "small-bright");
    assert.equal(tracks[0].mood.family, "happy");
    assert.deepEqual(calls.saved, [bright.id]);
  });

  it("doesn't suggest the user's own artists, songs they played, or another artist's songs", async () => {
    const played = song("played", "Played", "Rini");
    const fresh = song("fresh", "Fresh", "Rini");
    const cover = song("cover", "Cover", "Someone Else");
    const { deps } = fakes({
      similar: { keshi: [{ name: "keshi", match: 1 }, { name: "Rini", match: 0.8 }] },
      catalogue: { Rini: [played, cover, fresh] },
      features: { [played.id]: HAPPY, [fresh.id]: HAPPY, [cover.id]: HAPPY },
    });
    const tracks = await recommendSongs({ ...request, exclude: [played.id] }, deps);

    assert.deepEqual(tracks.map((track) => track.name), ["Fresh"]);
  });

  it("only suggests calm songs for a calm target", async () => {
    const lively = song("lively", "Lively", "HYBS");
    const quiet = song("quiet", "Quiet", "HYBS");
    const { deps } = fakes({
      similar: { keshi: [{ name: "HYBS", match: 0.7 }] },
      catalogue: { HYBS: [lively, quiet] },
      features: { [lively.id]: HAPPY, [quiet.id]: CALM },
    });
    const tracks = await recommendSongs({ ...request, target: "calm" }, deps);

    assert.deepEqual(tracks.map((track) => track.name), ["Quiet"]);
  });

  it("spreads picks across artists and the user's top artists", async () => {
    const catalogue = {};
    const features = {};
    for (const artist of ["A1", "A2", "B1"]) {
      catalogue[artist] = [1, 2, 3].map((n) => song(`${artist}s${n}`, `${artist} ${n}`, artist));
      catalogue[artist].forEach((track) => (features[track.id] = HAPPY));
    }
    const { deps } = fakes({
      similar: {
        keshi: [{ name: "A1", match: 1 }, { name: "A2", match: 0.9 }],
        Rini: [{ name: "B1", match: 1 }],
      },
      catalogue,
      features,
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
    const features = {};
    tracks.forEach((track) => (features[track.id] = HAPPY));
    pieces.forEach((track) => (features[track.id] = { ...HAPPY, instrumentalness: 0.9 }));
    const { deps } = fakes({
      similar: { keshi: [...tracks, ...pieces].map((track, index) => ({ name: track.artists[0].name, match: 1 - index / 10 })) },
      catalogue: Object.fromEntries([...tracks, ...pieces].map((track) => [track.artists[0].name, [track]])),
      features,
    });
    const picks = await recommendSongs({ ...request, mix: { vocal: 2, instrumental: 2 } }, deps);

    assert.equal(picks.filter((pick) => pick.instrumental).length, 2);
    assert.equal(picks.filter((pick) => !pick.instrumental).length, 2);
  });

  it("falls back to the user's own artists without Last.fm", async () => {
    const own = song("own", "Own", "keshi");
    const { deps, calls } = fakes({ catalogue: { keshi: [own] }, features: { [own.id]: HAPPY } });
    const tracks = await recommendSongs(request, deps);

    assert.equal(tracks[0].because, "From keshi");
    assert.deepEqual(calls.searches, ['artist:"keshi"']);
  });

  it("stops searching when Spotify rate-limits, keeping what it found", async () => {
    const first = song("first", "First", "A1");
    const { deps, calls } = fakes({
      similar: { keshi: [{ name: "A1", match: 1 }, { name: "A2", match: 0.9 }, { name: "A3", match: 0.8 }] },
      catalogue: { A1: [first] },
      features: { [first.id]: HAPPY },
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
