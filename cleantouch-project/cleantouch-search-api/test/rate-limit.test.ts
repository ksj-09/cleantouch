import assert from 'node:assert/strict';
import test from 'node:test';
import { providerRateLimit } from '../src/rate-limit.js';

test('provider limit keeps the wait and minute/day distinction without leaking account details', () => {
  const error = providerRateLimit(new Response('', { status: 429, headers: { 'retry-after': '30.2' } }),
    'Rate limit reached for organization org_private on tokens per minute (TPM)');
  assert.equal(error.retryAfterSeconds, 31);
  assert.equal(error.limitWindow, 'minute');
  assert.match(error.message, /분당.*31초/);
  assert.doesNotMatch(error.message, /무료|org_private/);
  assert.equal(providerRateLimit(new Response(''), 'requests per day').limitWindow, 'day');
});

test('Retry-After accepts an HTTP date and rejects malformed, negative or missing waits', () => {
  const now = Date.parse('2026-09-28T00:00:00Z');
  assert.equal(providerRateLimit(new Response('', { headers: { 'retry-after': 'Mon, 28 Sep 2026 00:00:30 GMT' } }), '', now).retryAfterSeconds, 30);
  for (const value of ['', '-1', 'invalid', '1e999']) {
    const error = providerRateLimit(new Response('', { headers: { 'retry-after': value } }));
    assert.equal(error.retryAfterSeconds, undefined);
    assert.equal(error.limitWindow, 'unknown');
    assert.match(error.message, /잠시 후 다시/);
  }
  assert.equal(providerRateLimit(new Response('')).retryAfterSeconds, undefined);
});
