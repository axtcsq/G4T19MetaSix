import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streakFrom } from '../services/streak.js';

// "YYYY-MM-DD" for each day from start, count days long.
const days = (start, count) =>
  Array.from({ length: count }, (_, index) =>
    new Date(Date.parse(`${start}T00:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10),
  );

test('no check-ins is no streak', () => {
  assert.deepEqual(streakFrom([], '2026-11-04'), {
    days: 0,
    checkedInToday: false,
    savers: 0,
    maxSavers: 2,
    nextSaverIn: 7,
    savedYesterday: false,
  });
});

test("the streak holds until today ends, even before today's check-in", () => {
  const streak = streakFrom(days('2026-11-01', 3), '2026-11-04');
  assert.equal(streak.days, 3);
  assert.equal(streak.checkedInToday, false);
  assert.equal(streakFrom(days('2026-11-01', 4), '2026-11-04').checkedInToday, true);
});

test('several check-ins on one day count once', () => {
  assert.equal(streakFrom(['2026-11-04', '2026-11-04'], '2026-11-04').days, 1);
});

test('7 days in a row earn a saver, at most 2', () => {
  assert.equal(streakFrom(days('2026-10-29', 7), '2026-11-04').savers, 1);
  assert.equal(streakFrom(days('2026-10-29', 7), '2026-11-04').nextSaverIn, 7);
  const long = streakFrom(days('2026-09-30', 36), '2026-11-04');
  assert.equal(long.savers, 2);
  assert.equal(long.nextSaverIn, null);
});

test('a saver covers one missed day and the streak carries on', () => {
  // 7 days to 3 Nov, nothing on 4 Nov, then back on 5 Nov.
  const dates = [...days('2026-10-28', 7), '2026-11-05'];
  const streak = streakFrom(dates, '2026-11-05');
  assert.equal(streak.days, 8);
  assert.equal(streak.savers, 0);
  assert.equal(streakFrom(days('2026-10-28', 7), '2026-11-05').savedYesterday, true);
});

test('a missed day with no saver starts the streak again', () => {
  const dates = [...days('2026-10-30', 3), '2026-11-03', '2026-11-04'];
  assert.equal(streakFrom(dates, '2026-11-04').days, 2);
});
