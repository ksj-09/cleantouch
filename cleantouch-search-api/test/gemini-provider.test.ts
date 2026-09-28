import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiVisionProvider } from '../src/gemini-provider.js';
import { ProviderNotConfiguredError, ProviderRateLimitError, ProviderUnavailableError, VisualSearchError } from '../src/vision-provider.js';

const model = 'gemini-3.8-flash';
const products = [
  { isProduct: true, label: '검정 숄더백', category: '숄더백', color: '검정', confidence: 0.8, box: [0.1, 0.2, 0.4, 0.6] },
  { isProduct: true, label: '흰색 운동화', category: '운동화', color: '흰색', confidence: 0.7, box: [0.5, 0.7, 0.9, 1] },
];
const success = () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [
  { thought: true, text: 'This is not a product result.' },
  { text: JSON.stringify({ products }) },
] } }] }));

test('Gemini scene recognition sends one image securely and preserves multiple products and boxes', async () => {
  let requests = 0;
  const fakeFetch = (async (url, init) => {
    requests += 1;
    assert.equal(String(url), `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
    assert.doesNotMatch(String(url), /test-key|[?&]key=/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'test-key');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.contents[0].parts.filter((part: { inline_data?: unknown }) => part.inline_data).length, 1);
    assert.match(body.contents[0].parts[0].text, /EVERY distinct/);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'LOW' });
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.maxOutputTokens, 4096);
    return success();
  }) as typeof fetch;
  const provider = new GeminiVisionProvider('test-key', model, fakeFetch);
  const result = await provider.search(Buffer.from('test-image'));
  assert.equal(provider.name, 'gemini');
  assert.equal(provider.model, model);
  assert.equal(result.products?.length, 2);
  assert.equal(result.matches.length, 4);
  assert.deepEqual(result.products?.[0]?.box, products[0]?.box);
  assert.deepEqual(result.products?.[1]?.box, products[1]?.box);
  assert.match(result.products?.[0]?.matches[0]?.url ?? '', /search\.shopping\.naver\.com/);
  assert.equal(requests, 1);
});

test('Gemini focus search keeps the full scene and the requested detail view', async () => {
  const fakeFetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const views = body.contents[0].parts.filter((part: { inline_data?: unknown }) => part.inline_data);
    assert.equal(views.length, 2);
    assert.equal(views[1].inline_data.data, Buffer.from('focus').toString('base64'));
    assert.doesNotMatch(body.contents[0].parts[0].text, /EVERY distinct/);
    return success();
  }) as typeof fetch;
  await new GeminiVisionProvider('test-key', model, fakeFetch).search(Buffer.from('scene'), [Buffer.from('focus')]);
});

test('Gemini retries one transient 503 with bounded backoff', async () => {
  let requests = 0;
  const waits: number[] = [];
  const fakeFetch = (async () => {
    requests += 1;
    return requests === 1 ? new Response('{"error":{"status":"UNAVAILABLE"}}', { status: 503 }) : success();
  }) as typeof fetch;
  const result = await new GeminiVisionProvider('test-key', model, fakeFetch, async milliseconds => { waits.push(milliseconds); })
    .search(Buffer.from('image'));
  assert.equal(requests, 2);
  assert.equal(waits.length, 1);
  assert(waits[0] >= 1_000 && waits[0] < 1_250);
  assert.equal(result.products?.length, 2);
});

test('Gemini honors a longer 503 Retry-After without making another request or exposing upstream details', async () => {
  let requests = 0;
  const fakeFetch = (async () => {
    requests += 1;
    return new Response('{"error":{"message":"temporary for private-project"}}', { status: 503, headers: { 'retry-after': '5' } });
  }) as typeof fetch;
  await assert.rejects(new GeminiVisionProvider('test-key', model, fakeFetch, async () => {}).search(Buffer.from('image')), error => {
    assert(error instanceof ProviderUnavailableError);
    assert.equal(error.retryAfterSeconds, 5);
    assert.match(error.message, /5초/);
    assert.doesNotMatch(error.message, /private-project/);
    return true;
  });
  assert.equal(requests, 1);
});

test('Gemini preserves RetryInfo and per-minute quota IDs without retrying immediately', async () => {
  let requests = 0;
  const fakeFetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { message: 'quota for private-project', details: [
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30.2s' },
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier' }] },
    ] } }), { status: 429 });
  }) as typeof fetch;
  await assert.rejects(new GeminiVisionProvider('test-key', model, fakeFetch).search(Buffer.from('image')), error => {
    assert(error instanceof ProviderRateLimitError);
    assert.equal(error.retryAfterSeconds, 31);
    assert.equal(error.limitWindow, 'minute');
    assert.match(error.message, /분당/);
    assert.doesNotMatch(error.message, /private-project|무료/);
    return true;
  });
  assert.equal(requests, 1);
});

test('Gemini daily quotas take precedence and honor the longer of header and body waits', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({ error: { details: [
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' },
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [
      { quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' },
      { quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' },
    ] },
  ] } }), { status: 429, headers: { 'retry-after': '45' } })) as typeof fetch;
  await assert.rejects(new GeminiVisionProvider('test-key', model, fakeFetch).search(Buffer.from('image')), error => {
    assert(error instanceof ProviderRateLimitError);
    assert.equal(error.retryAfterSeconds, 45);
    assert.equal(error.limitWindow, 'day');
    return true;
  });
});

test('Gemini HTML or malformed 429 responses still preserve the rate-limit status', async () => {
  for (const body of ['<html>Too many requests</html>', '{"error":{"details":[null,7,{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"bad"}]}}']) {
    const fakeFetch = (async () => new Response(body, { status: 429, headers: { 'retry-after': '15' } })) as typeof fetch;
    await assert.rejects(new GeminiVisionProvider('test-key', model, fakeFetch).search(Buffer.from('image')), error => {
      assert(error instanceof ProviderRateLimitError);
      assert.equal(error.retryAfterSeconds, 15);
      assert.equal(error.limitWindow, 'unknown');
      return true;
    });
  }
});

test('Gemini missing credentials do not send a request', async () => {
  const provider = new GeminiVisionProvider('', model, (async () => { assert.fail('must not call the network'); }) as typeof fetch);
  assert.equal(provider.configured, false);
  await assert.rejects(provider.search(Buffer.from('image')), ProviderNotConfiguredError);
});

test('Gemini upstream errors never include raw project or key details', async () => {
  for (const status of [400, 401, 403, 404, 503]) {
    const fakeFetch = (async () => new Response(JSON.stringify({ error: { message: 'key=test-key project=private-project' } }), { status })) as typeof fetch;
    await assert.rejects(new GeminiVisionProvider('test-key', model, fakeFetch).search(Buffer.from('image')), error => {
      assert(error instanceof VisualSearchError);
      assert.doesNotMatch(error.message, /test-key|private-project/);
      return true;
    });
  }
});

test('Gemini network errors, invalid JSON and incomplete generations cannot become completed scenes', async () => {
  const responses = [
    'invalid JSON', 'null', '{}',
    JSON.stringify({ candidates: [{ content: { parts: 'invalid' } }] }),
    JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"products":[]}' }] } }] }),
    JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"products":"invalid"}' }] } }] }),
  ];
  for (const body of responses) {
    await assert.rejects(new GeminiVisionProvider('test-key', model, (async () => new Response(body)) as typeof fetch).search(Buffer.from('image')), VisualSearchError);
  }
  await assert.rejects(new GeminiVisionProvider('test-key', model, (async () => { throw new Error('socket failed'); }) as typeof fetch).search(Buffer.from('image')), VisualSearchError);
});
