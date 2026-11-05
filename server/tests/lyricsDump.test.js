// Run with: npm test The local LRCLIB copy, using a small SQLite file shaped like LRCLIB's dump.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { openLyricsDump } from "../services/mood/lyrics.js";
import { isTemporary } from "../services/mood/errors.js";

const sqlite = await import("node:sqlite").catch(() => null);
const dir = mkdtempSync(join(tmpdir(), "lrclib-"));
const song = (name, artist, album, seconds) => ({
  name,
  artists: [{ name: artist }],
  album: { name: album },
  duration_ms: seconds * 1000,
});

function makeDump(path, { lyricsColumns = "id INTEGER, plain_lyrics TEXT, instrumental BOOLEAN" } = {}) {
  const db = new sqlite.DatabaseSync(path);
  db.exec(`
    CREATE TABLE tracks (id INTEGER, name_lower TEXT, artist_name_lower TEXT, album_name_lower TEXT,
      duration FLOAT, last_lyrics_id INTEGER);
    CREATE TABLE lyrics (${lyricsColumns});`);
  if (lyricsColumns.includes("instrumental")) {
    db.exec(`
      INSERT INTO tracks VALUES
        (1, 'ruiner', 'nine inch nails', 'the downward spiral (deluxe edition)', 298, 11),
        (2, 'ruiner', 'nine inch nails', 'the downward spiral', 298, 12),
        (3, 'cafe', 'beyonce', 'b', 200, 13),
        (4, 'theme', 'composer', 'score', 120, 14);
      INSERT INTO lyrics VALUES
        (11, 'deluxe words', 0), (12, 'album words', 0), (13, 'accent words', 0), (14, NULL, 1);`);
  }
  db.close();
}

describe("local LRCLIB copy", { skip: !sqlite && "node:sqlite needs Node 22.13+" }, () => {
  let lookup;
  before(async () => {
    makeDump(join(dir, "dump.sqlite3"));
    lookup = await openLyricsDump(join(dir, "dump.sqlite3"));
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it("prefers the same album, ignoring case", () => {
    assert.deepEqual(lookup(song("Ruiner", "Nine Inch Nails", "The Downward Spiral", 299)), {
      instrumental: false,
      text: "album words",
    });
  });

  it("matches names without their accents", () => {
    assert.equal(lookup(song("Café", "Beyoncé", "B", 201)).text, "accent words");
  });

  it("returns instrumentals, and nothing for durations more than 10s apart", () => {
    assert.equal(lookup(song("Theme", "Composer", "Score", 125)).instrumental, true);
    assert.equal(lookup(song("Theme", "Composer", "Score", 140)), null);
    assert.equal(lookup(song("Unknown", "Nobody", "", 100)), null);
  });

  it("isn't used when the file isn't shaped like LRCLIB's dump", async () => {
    makeDump(join(dir, "other.sqlite3"), { lyricsColumns: "id INTEGER, words TEXT" });
    assert.equal(await openLyricsDump(join(dir, "other.sqlite3")), null);
  });
});

describe("isTemporary", () => {
  it("counts busy services and timeouts, not missing songs", () => {
    assert.equal(isTemporary(Object.assign(new Error("busy"), { temporary: true })), true);
    assert.equal(isTemporary(Object.assign(new Error("slow"), { name: "TimeoutError" })), true);
    assert.equal(isTemporary(new Error("fetch failed")), true);
    assert.equal(isTemporary(Object.assign(new Error("No audio features"), { status: 404 })), false);
  });
});
