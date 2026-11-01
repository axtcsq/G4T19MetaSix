import assert from 'node:assert/strict';
import { it } from 'node:test';
import { safeReturnPath } from '../controller/authController.js';

it('OAuth return URLs stay on the application origin after URL normalization', () => {
  assert.equal(safeReturnPath('/calendar?month=10#today'), '/calendar?month=10#today');
  for (const path of [undefined, [], '//evil.test', '/\\evil.test', '/\n/evil.test', '/\t/evil.test', 'https://evil.test']) {
    const safe = safeReturnPath(path);
    assert.equal(safe, '/dashboard');
    assert.equal(new URL(safe, 'https://metafor.test').origin, 'https://metafor.test');
  }
});
