import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhoto } from '../controller/moodController.js';

const dataUrl = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];

test('a small JPEG is kept as bytes with its type', () => {
  const photo = parsePhoto(dataUrl('image/jpeg', JPEG));
  assert.equal(photo.type, 'image/jpeg');
  assert.deepEqual([...photo.data], JPEG);
});

test('PNG and WebP photos are accepted too', () => {
  assert.equal(parsePhoto(dataUrl('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d])).type, 'image/png');
  const webp = [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')];
  assert.equal(parsePhoto(dataUrl('image/webp', webp)).type, 'image/webp');
});

test('a file that only claims to be an image is refused', () => {
  assert.equal(parsePhoto(dataUrl('image/jpeg', Buffer.from('<script>'))), null);
  assert.equal(parsePhoto(dataUrl('image/gif', [0x47, 0x49, 0x46])), null);
  assert.equal(parsePhoto('not a data url'), null);
  assert.equal(parsePhoto(42), null);
});

test('a photo over 600 KB is refused', () => {
  const big = Buffer.alloc(600_001);
  big.set(JPEG);
  assert.equal(parsePhoto(dataUrl('image/jpeg', big)), null);
});
