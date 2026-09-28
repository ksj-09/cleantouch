import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { GroqVisionProvider } from '../src/groq-provider.js';
import { ProviderRateLimitError } from '../src/rate-limit.js';

async function tinyJpeg() {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: '#222222' } }).jpeg().toBuffer();
}

function successResponse() {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          isProduct: true,
          label: '검은색 숄더백',
          category: '숄더백',
          color: '검은색',
          confidence: 0.8,
        }),
      },
    }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('Groq provider retries one transient upstream failure', async () => {
  let requests = 0;
  const fakeFetch = (async () => {
    requests += 1;
    if (requests === 1) {
      return new Response(JSON.stringify({ error: { message: 'temporary' } }), { status: 503 });
    }
    return successResponse();
  }) as typeof fetch;

  const result = await new GroqVisionProvider('test-key', 'test-model', fakeFetch).search(await tinyJpeg());

  assert.equal(requests, 2);
  assert.equal(result.queryLabel, '검은색 숄더백');
  assert.equal(result.matches.length, 2);
});

test('Groq provider does not retry a permanent request error', async () => {
  let requests = 0;
  const fakeFetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 });
  }) as typeof fetch;

  await assert.rejects(
    new GroqVisionProvider('test-key', 'test-model', fakeFetch).search(await tinyJpeg()),
    /bad request/,
  );
  assert.equal(requests, 1);
});

test('Groq provider reports a usage limit without retrying immediately', async () => {
  let requests = 0;
  const fakeFetch = (async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 });
  }) as typeof fetch;

  await assert.rejects(
    new GroqVisionProvider('test-key', 'test-model', fakeFetch).search(await tinyJpeg()),
    /잠시 후 다시/,
  );
  assert.equal(requests, 1);
});

test('Groq provider preserves the upstream retry delay and handles non-JSON 429 bodies', async () => {
  for (const body of [JSON.stringify({ error: { message: 'tokens per minute' } }), '<html>Too many requests</html>']) {
    let requests = 0;
    const fakeFetch = (async () => {
      requests += 1;
      return new Response(body, { status: 429, headers: { 'retry-after': '30' } });
    }) as typeof fetch;
    await assert.rejects(new GroqVisionProvider('test-key', 'test-model', fakeFetch).search(await tinyJpeg()), error => {
      assert(error instanceof ProviderRateLimitError);
      assert.equal(error.retryAfterSeconds, 30);
      assert.equal(error.limitWindow, body.startsWith('{') ? 'minute' : 'unknown');
      return true;
    });
    assert.equal(requests, 1);
  }
});

test('Groq provider sends only the focused product view when one is available', async () => {
  let sentImages = 0;
  const fakeFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ content: Array<{ type?: string }> }>;
    };
    sentImages = body.messages[0]?.content.filter((part) => part.type === 'image_url').length ?? 0;
    return successResponse();
  }) as typeof fetch;
  const image = await tinyJpeg();

  await new GroqVisionProvider('test-key', 'test-model', fakeFetch).search(image, [image]);

  assert.equal(sentImages, 1);
});
