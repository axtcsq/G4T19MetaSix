import assert from 'node:assert/strict';
import { it } from 'node:test';
import { apiSafety } from '../middleware/apiSafety.js';

function request(method, headers = {}) {
  let allowed = false;
  const res = { headers: {}, set(values) { Object.assign(this.headers, values); }, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  apiSafety({ method, protocol: 'https', get: (name) => headers[name] ?? (name === 'host' ? 'metafor.test' : undefined) }, res, () => { allowed = true; });
  return { allowed, ...res };
}

it('rejects cross-origin mutations before session or database work', () => {
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    assert.equal(request(method, { Origin: 'https://evil.test' }).code, 403);
    assert.equal(request(method, { 'Sec-Fetch-Site': 'cross-site' }).code, 403);
    assert.equal(request(method, { Origin: 'https://metafor.test' }).allowed, true);
  }
});

it('allows reads and non-browser clients and prevents private response caching', () => {
  assert.equal(request('GET', { Origin: 'https://evil.test' }).allowed, true);
  assert.equal(request('POST').allowed, true);
  assert.equal(request('GET').headers['Cache-Control'], 'no-store');
});
