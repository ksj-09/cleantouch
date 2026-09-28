import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { DEFAULT_GEMINI_MODEL, GeminiVisionProvider } from '../dist/gemini-provider.js';
import { ProviderRateLimitError } from '../dist/rate-limit.js';
import { ProviderUnavailableError } from '../dist/vision-provider.js';

const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
const provider = new GeminiVisionProvider(process.env.GEMINI_API_KEY?.trim(), model);
if (!provider.configured) {
  console.error('GEMINI_API_KEY is missing in cleantouch-search-api/.env. Add the key there, then run this check again.');
  process.exitCode = 2;
} else {
  const fixture = new URL('../../artifacts/recognition-tests/small-bag-screen.png', import.meta.url);
  const image = await sharp(await readFile(fixture)).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  const started = performance.now();
  try {
    const result = await provider.search(image);
    const report = { checkedAt: new Date().toISOString(), provider: provider.name, model: provider.model,
      elapsedMs: Math.round(performance.now() - started), productCount: result.products?.length ?? 0, result };
    await writeFile(new URL('../../artifacts/recognition-tests/gemini-latest-response.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ok: true, provider: provider.name, model: provider.model, elapsedMs: report.elapsedMs,
      productCount: report.productCount, labels: result.products?.map(product => product.label) }));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, provider: provider.name, model: provider.model,
      errorType: error.constructor.name, message: error.message,
      ...(error instanceof ProviderRateLimitError ? { retryAfterSeconds: error.retryAfterSeconds, limitWindow: error.limitWindow } : {}),
      ...(error instanceof ProviderUnavailableError ? { retryAfterSeconds: error.retryAfterSeconds } : {}) }));
    process.exitCode = 1;
  }
}
