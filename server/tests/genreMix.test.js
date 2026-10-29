import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genreMix } from '../services/listeningProfile.js';

test('genre shares weight plays without inflating artists with multiple tags', () => {
  const result = genreMix([['A', 6], ['B', 2], ['Unknown', 2]], {
    A: [{ name: 'pop', weight: 1 }, { name: 'rock', weight: 1 }],
    B: [{ name: 'rock', weight: 1 }],
  });
  assert.equal(result.taggedArtistPlays, 8);
  assert.equal(result.artistPlays, 10);
  assert.deepEqual(result.genres, [{ name: 'rock', share: 62.5 }, { name: 'pop', share: 37.5 }]);
  assert.deepEqual(genreMix([['Unknown', 2]], {}).genres, []);
});

test('long tails are grouped without losing shares', () => {
  const result = genreMix([['A', 1]], { A: Array.from({ length: 8 }, (_, i) => ({ name: `Genre ${i}`, weight: 1 })) });
  assert.equal(result.genres.length, 6);
  assert.equal(result.genres.at(-1).name, 'Other genres');
  assert.equal(result.genres.reduce((sum, genre) => sum + genre.share, 0), 100);
});
