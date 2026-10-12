const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WatchTimeline, parseScreenText } = require('../watch-timeline');
test('pause, resume and actual rewind positions', () => {
  const clock = new WatchTimeline();
  clock.observe({identity:'a', position:83}, 0);
  assert.equal(clock.observe({paused:true}, 1000).seconds,84);
  assert.equal(clock.observe({}, 2000).seconds,84);
  clock.observe({paused:false},3000);
  assert.equal(clock.observe({},4000).seconds,85);
  assert.equal(clock.observe({position:12},5000).seconds,12);
});
test('confirmed video changes survive empty ticks and restore previous video', () => {
  const clock = new WatchTimeline(); clock.observe({identity:'a',position:20},0);
  clock.observe({identity:'b'},100);clock.observe({},200);clock.observe({identity:'b'},300);clock.observe({},400);
  assert.equal(clock.observe({identity:'b'},500).seconds,0);
  for (const at of [600,700,800]) clock.observe({identity:'a'},at);
  assert(clock.snapshot().seconds >=20);
});
test('ordinary images and missing evidence never invent a new video or rewind', () => {
  const clock = new WatchTimeline(); clock.observe({position:30},0);
  assert.equal(clock.observe({},1000).videoKey,'watch-1');
  const signal = parseScreenText('뒤로 10초');
  assert.equal(clock.observe(signal,1000).seconds,21);
  clock.observe({},1100);
  assert(clock.observe(signal,1200).seconds>21);
  assert.equal(parseScreenText('12:34\n99:99 / 99:99').position,null);
  assert.equal(parseScreenText('1:23 / 4:00').position,83);
  assert.equal(parseScreenText('일시정지됨').paused,true);
});
