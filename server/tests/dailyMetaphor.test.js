import { afterEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanMetaphor,
  fallbackMetaphor,
  localDate,
  mainMood,
  metaphorPrompt,
  writeMetaphor,
} from '../services/dailyMetaphor.js';
import { MOOD_METAPHORS } from '../data/moodMetaphors.js';

afterEach(() => {
  mock.restoreAll();
  delete process.env.GROQ_API_KEY;
});

test("today is the user's own date", () => {
  const lateNightUtc = new Date('2026-11-04T18:30:00Z');
  assert.equal(localDate(lateNightUtc, 'UTC'), '2026-11-04');
  assert.equal(localDate(lateNightUtc, 'Asia/Singapore'), '2026-11-05');
});

test('the main mood is the most common, with ties going to the latest', () => {
  assert.equal(mainMood(['Sad', 'Happy', 'Sad']), 'Sad');
  assert.equal(mainMood(['Tired', 'Happy']), 'Tired');
  assert.equal(mainMood([]), null);
});

test('every mood has fallback lines that stay the same all day', () => {
  for (const mood of ['Sad', 'Happy', 'Relaxed', 'Anxious', 'Angry', 'Excited', 'Tired', 'Lonely']) {
    assert.ok(MOOD_METAPHORS[mood].length > 0, mood);
    assert.ok(MOOD_METAPHORS[mood].includes(fallbackMetaphor(mood, '2026-11-04')));
  }
  assert.notEqual(fallbackMetaphor('Sad', '2026-11-04'), fallbackMetaphor('Sad', '2026-11-05'));
  assert.equal(fallbackMetaphor(null, '2026-11-04'), null);
});

test('replies are tidied, and ones Home cannot show are dropped', () => {
  assert.equal(cleanMetaphor('  "Your calm is a lo-fi loop."\n'), 'Your calm is a lo-fi loop.');
  assert.equal(cleanMetaphor(''), null);
  assert.equal(cleanMetaphor('x'.repeat(200)), null);
  assert.equal(cleanMetaphor(undefined), null);
});

test('the prompt lists only what MetaFor knows', () => {
  assert.equal(
    metaphorPrompt({ moods: ['Anxious'], genre: 'indie folk', artist: null }),
    'Moods checked in today, newest first: Anxious\nGenre they listen to most: indie folk',
  );
  assert.match(metaphorPrompt({ moods: [], genre: null, artist: 'Laufey' }), /No mood checked in yet today/);
});

test('Groq writes the line, and a failure gives null for the fallback', async () => {
  process.env.GROQ_API_KEY = 'test-key';
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"metaphor":"Your worry is a quiet indie bridge."}' } }] }),
  }));
  assert.equal(await writeMetaphor({ moods: ['Anxious'], genre: 'indie', artist: null }), 'Your worry is a quiet indie bridge.');
  const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
  assert.match(body.messages[1].content, /Anxious/);

  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 429, json: async () => ({}) }));
  mock.method(console, 'error', () => {});
  assert.equal(await writeMetaphor({ moods: ['Anxious'], genre: null, artist: null }), null);
});

test('without a Groq key nothing is sent', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => assert.fail('should not call Groq'));
  assert.equal(await writeMetaphor({ moods: ['Happy'], genre: null, artist: null }), null);
  assert.equal(fetchMock.mock.callCount(), 0);
});
