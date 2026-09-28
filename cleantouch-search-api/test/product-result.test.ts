import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProductDescription, parseSceneResult, toSearchResult } from '../src/gemini-provider.js';

test('builds a useful shopping query when a small product has no readable brand', () => {
  const result = toSearchResult({
    isProduct: true,
    label: '검정 미니 숄더백',
    category: '미니 숄더백',
    color: '검정',
    material: '가죽',
    style: '체인 스트랩',
    confidence: 0.62,
  });

  assert.equal(result.queryLabel, '검정 미니 숄더백');
  assert.equal(result.matches.length, 2);
  assert.equal(result.matches[0]?.matchKind, 'search_link');
  assert.match(result.matches[0]?.title ?? '', /검정.*가죽.*체인 스트랩.*미니 숄더백/);
  assert.match(result.matches[0]?.url ?? '', /search\.shopping\.naver\.com/);
});

test('only puts a readable brand in the query when evidence supports it', () => {
  const result = toSearchResult({
    isProduct: true,
    label: '검정 백팩',
    brand: 'ACME',
    brandConfidence: 0.99,
    brandEvidence: 'ACM',
    category: '백팩',
    color: '검정',
    confidence: 0.7,
  });
  assert.doesNotMatch(result.matches[0]?.title ?? '', /ACME/);
});

test('does not create a misleading link from a generic product word', () => {
  const result = toSearchResult({ isProduct: true, label: '상품', searchQuery: '상품', confidence: 0.9 });
  assert.equal(result.matches.length, 0);
});

test('ignores malformed model fields instead of crashing the request', () => {
  const result = toSearchResult({
    isProduct: true,
    category: 42 as unknown as string,
    label: '검정 백팩',
    confidence: 0.7,
  });
  assert.equal(result.queryLabel, '검정 백팩');
  assert.equal(result.matches.length, 2);
});

test('rejects a JSON array as a product description', () => {
  assert.throws(() => parseProductDescription('[]'));
});

test('keeps multiple objects separate, deduplicates repeated views and validates crop coordinates', () => {
  const bag = { isProduct: true, category: '숄더백', color: '검정', confidence: 0.8, box: [0.1, 0.2, 0.6, 0.8] };
  const result = parseSceneResult(JSON.stringify({ products: [bag, bag, { isProduct: true, category: '운동화', color: '흰색', confidence: 0.7, box: [0.8, 0, 0.1, 1] }, null] }));
  assert.equal(result.products?.length, 2);
  assert.equal(result.matches.length, 4);
  assert.deepEqual(result.products?.[0]?.box, bag.box);
  assert.equal(result.products?.[1]?.box, undefined);
  assert.notEqual(result.products?.[0]?.id, result.products?.[1]?.id);
});

test('empty scenes do not invent products and malformed lists are retryable errors', () => {
  assert.deepEqual(parseSceneResult('{"products":[]}').products, []);
  assert.deepEqual(parseSceneResult('{"isProduct":false}').products, []);
  assert.throws(() => parseSceneResult('{"products":"invalid"}'));
});
