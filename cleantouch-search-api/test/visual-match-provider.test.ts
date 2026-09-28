import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { VisualMatchProvider } from '../src/visual-match-provider.js';
import { GoogleVisionProvider } from '../src/vision-provider.js';
import type { VisualSearchProvider } from '../src/types.js';

test('crops the detected object and ranks image-matching pages before text search', async () => {
  const scene = await sharp({ create: { width: 100, height: 80, channels: 3, background: '#eeeeee' } })
    .composite([{ input: await sharp({ create: { width: 40, height: 40, channels: 3, background: '#aabbcc' } }).png().toBuffer(), left: 20, top: 16 }])
    .jpeg().toBuffer();
  const textMatch = { id: 'text', title: '아이보리 팬츠 검색', source: '네이버 쇼핑', url: 'https://shop.test/search', matchKind: 'search_link' as const };
  const imageMatch = { id: 'image', title: '비슷한 팬츠', source: 'seller.test', url: 'https://seller.test/pants', matchKind: 'partial_image' as const };
  const recognizer: VisualSearchProvider = { configured: true, async search() {
    return { queryLabel: '아이보리 팬츠', matches: [textMatch], products: [{ id: 'pants', label: '아이보리 팬츠', box: [0.2, 0.2, 0.6, 0.7], matches: [textMatch] }] };
  } };
  let dimensions: { width?: number; height?: number } = {};
  const matcher: VisualSearchProvider = { configured: true, async search(image) {
    dimensions = await sharp(image).metadata();
    return { queryLabel: 'pants', matches: [imageMatch] };
  } };
  const result = await new VisualMatchProvider(recognizer, matcher).search(scene);
  assert.equal(dimensions.width, 40);
  assert.equal(dimensions.height, 40);
  assert.deepEqual(result.products?.[0]?.matches.map(match => match.matchKind), ['partial_image', 'search_link']);
  assert.equal(result.matches[0]?.url, imageMatch.url);
});

test('keeps recognized products when visual lookup fails or an object has no safe crop', async () => {
  const fallback = { id: 'text', title: '검색', source: '쇼핑', url: 'https://shop.test/search', matchKind: 'search_link' as const };
  const recognizer: VisualSearchProvider = { configured: true, async search() {
    return { queryLabel: '팬츠', matches: [fallback], products: [{ id: 'pants', label: '팬츠', box: [0.1, 0.1, 0.9, 0.9], matches: [fallback] }] };
  } };
  const matcher: VisualSearchProvider = { configured: true, async search() { throw new Error('Vision unavailable'); } };
  const image = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  const result = await new VisualMatchProvider(recognizer, matcher).search(image);
  assert.deepEqual(result.matches, [fallback]);
});

test('Vision API key stays in the request header and returns matching pages', async () => {
  const provider = new GoogleVisionProvider(undefined, 'secret-key', (async (url, init) => {
    assert.equal(url, 'https://vision.googleapis.com/v1/images:annotate');
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'secret-key');
    assert.doesNotMatch(String(init?.body), /secret-key/);
    return new Response(JSON.stringify({ responses: [{ webDetection: { bestGuessLabels: [{ label: '바지' }], pagesWithMatchingImages: [
      { url: 'https://seller.test/item', pageTitle: '아이보리 팬츠', partialMatchingImages: [{ url: 'https://seller.test/pants.jpg' }] },
    ] } }] }), { status: 200 });
  }) as typeof fetch);
  const result = await provider.search(Buffer.from('image'));
  assert.equal(result.matches[0]?.matchKind, 'partial_image');
  assert.equal(result.matches[0]?.url, 'https://seller.test/item');
});
