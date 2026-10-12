const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categories, selectLabel } = require('../ai-categories');
function scores(values) { return categories.map(([id]) => values[id] ?? .1); }
test('jeans and pants being close does not erase jeans', () => {
  assert.equal(selectLabel(scores({jeans:.29,pants:.285})).label,'청바지');
});
test('uncertain noun remains useful but marked as an estimate', () => {
  const result = selectLabel(scores({handbag:.24,shirt:.239}));
  assert.equal(result.label,'가방'); assert.equal(result.uncertain,true);
});
test('lightsaber names stay short and ambiguous colors are omitted', () => {
  assert.equal(selectLabel(scores({'purple-lightsaber':.32,'lightsaber':.30})).label,'보라색 광선검');
  assert.equal(selectLabel(scores({'blue-lightsaber':.32,'purple-lightsaber':.315})).label,'광선검');
});
test('background and invalid scores never invent a product name', () => {
  assert.equal(selectLabel(scores({background:.40,jeans:.20})).label,'종류 미확인');
  assert.equal(selectLabel(categories.map(() => NaN)).category,'unknown');
});
