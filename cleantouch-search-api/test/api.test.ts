import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import type { SearchResult, VisualSearchProvider } from '../src/types.js';
import { ProviderNotConfiguredError, ProviderRateLimitError, ProviderUnavailableError } from '../src/vision-provider.js';
import { GeminiVisionProvider } from '../src/gemini-provider.js';

const provider: VisualSearchProvider = {
  configured: true,
  async search() {
    return {
      queryLabel: 'black shoulder bag',
      matches: [{ id: 'one', title: 'Black Shoulder Bag', source: 'shop.test', url: 'https://shop.test/bag', matchKind: 'exact_image' }],
    };
  },
};

async function withServer(run: (baseUrl: string) => Promise<void>, selectedProvider = provider) {
  const server = createApp(selectedProvider).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve) => (server as Server).close(() => resolve())); }
}

test('health reports provider readiness', async () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { providerConfigured: boolean }).providerConfigured, true);
}));

test('health identifies the active model without exposing credentials', async () => withServer(async baseUrl => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();
  assert.deepEqual(body, { ok: true, service: 'cleantouch-search', providerConfigured: true, provider: 'gemini', model: 'gemini-3.8-flash' });
}, { ...provider, name: 'gemini', model: 'gemini-3.8-flash' }));

test('scan returns a provider cooldown for clients to resume the unfinished scene', async () => {
  await withServer(async baseUrl => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#222222' } }).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'scene.png');
    const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '30');
    const body = await response.json() as { code: string; retryAfterSeconds: number; limitWindow: string; message: string };
    assert.equal(body.code, 'PROVIDER_RATE_LIMITED');
    assert.equal(body.retryAfterSeconds, 30);
    assert.equal(body.limitWindow, 'minute');
    assert.match(body.message, /분당.*30초/);
    assert.doesNotMatch(body.message, /무료/);
  }, { configured: true, async search() { throw new ProviderRateLimitError(30, 'minute'); } });
});

test('scan reports a temporary Gemini outage with a safe, resumable 503 response', async () => {
  await withServer(async baseUrl => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#222222' } }).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'scene.png');
    const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '7');
    const body = await response.json() as { code: string; retryAfterSeconds: number; message: string };
    assert.equal(body.code, 'PROVIDER_UNAVAILABLE');
    assert.equal(body.retryAfterSeconds, 7);
    assert.match(body.message, /7초/);
    assert.doesNotMatch(body.message, /private-project|무료/);
  }, { configured: true, async search() { throw new ProviderUnavailableError(7); } });
});

test('Gemini RetryInfo reaches Android as the same 429 cooldown contract', async () => {
  const fakeFetch = (async () => new Response(JSON.stringify({ error: { details: [
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12.3s' },
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
  ] } }), { status: 429 })) as typeof fetch;
  await withServer(async baseUrl => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#222222' } }).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'scene.png');
    const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '13');
    const body = await response.json() as { retryAfterSeconds: number; limitWindow: string };
    assert.equal(body.retryAfterSeconds, 13);
    assert.equal(body.limitWindow, 'minute');
  }, new GeminiVisionProvider('test-key', 'gemini-3.8-flash', fakeFetch));
});

test('scan rejects a request without an image', async () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: new FormData() });
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { code: string }).code, 'INVALID_IMAGE');
}));

test('scan rejects unsupported file types', async () => withServer(async (baseUrl) => {
  const form = new FormData();
  form.append('image', new Blob(['plain text'], { type: 'text/plain' }), 'capture.txt');
  const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { code: string }).code, 'INVALID_IMAGE');
}));

test('scan rejects a corrupted file even when its MIME type says JPEG', async () => withServer(async (baseUrl) => {
  const form = new FormData();
  form.append('image', new Blob(['not an image'], { type: 'image/jpeg' }), 'broken.jpg');
  const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { code: string }).code, 'INVALID_IMAGE');
}));

test('scan normalizes an image and returns provider matches', async () => withServer(async (baseUrl) => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="black"/></svg>');
  const sharp = (await import('sharp')).default;
  const png = await sharp(svg).png().toBuffer();
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), 'capture.png');
  const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
  assert.equal(response.status, 200);
  const body = await response.json() as { matches: Array<{ title: string }>; retention: { imageStored: boolean } };
  assert.equal(body.matches[0]?.title, 'Black Shoulder Bag');
  assert.equal(body.retention.imageStored, false);
}));

test('scan forwards an optional enlarged product view to the provider', async () => {
  let detailImageCount = 0;
  const inspectingProvider: VisualSearchProvider = {
    configured: true,
    async search(_image, detailImages) {
      detailImageCount = detailImages?.length ?? 0;
      return { queryLabel: '미니 숄더백', matches: [] };
    },
  };
  await withServer(async (baseUrl) => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><rect width="30" height="30" fill="black"/></svg>');
    const sharp = (await import('sharp')).default;
    const png = await sharp(svg).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'screen.png');
    form.append('focus', new Blob([png], { type: 'image/png' }), 'focus.png');
    const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
    assert.equal(response.status, 200);
    assert.equal(detailImageCount, 1);
  }, inspectingProvider);
});

test('scene scan preserves every product, its crop and its own shopping links', async () => {
  const products: NonNullable<SearchResult['products']> = [
    { id: 'bag', label: '검정 숄더백', box: [0.1, 0.2, 0.4, 0.6], matches: [
      { id: 'bag-search', title: '검정 숄더백', source: 'shop.test', url: 'https://shop.test/bag', matchKind: 'search_link' },
    ] },
    { id: 'shoes', label: '흰색 운동화', box: [0.5, 0.7, 0.9, 1], matches: [
      { id: 'shoe-search', title: '흰색 운동화', source: 'shop.test', url: 'https://shop.test/shoes', matchKind: 'search_link' },
    ] },
  ];
  await withServer(async (baseUrl) => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'scene.png');
    const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
    assert.equal(response.status, 200);
    const body = await response.json() as SearchResult;
    assert.deepEqual(body.products, products);
    assert.equal(body.matches.length, 2);
  }, { configured: true, async search() {
    return { queryLabel: products[0].label, matches: products.flatMap(product => product.matches), products };
  } });
});

test('scan reports an unavailable provider without storing the image', async () => {
  const unavailableProvider: VisualSearchProvider = {
    configured: false,
    async search() { throw new ProviderNotConfiguredError(); },
  };
  await withServer(async (baseUrl) => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    const sharp = (await import('sharp')).default;
    const png = await sharp(svg).png().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'capture.png');
    const response = await fetch(`${baseUrl}/v1/scans`, { method: 'POST', body: form });
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { code: string }).code, 'PROVIDER_NOT_CONFIGURED');
  }, unavailableProvider);
});
