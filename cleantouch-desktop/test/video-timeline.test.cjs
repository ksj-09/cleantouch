const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { createTimeline, startTimelineBridge } = require('../video-timeline.cjs');
const { selectLabel, categories, cosine } = require('../ai-categories.js');
const payload = seconds => ({ type: 'video-time', url: 'https://www.youtube.com/watch?v=fixture', instance: 'fixture', title: 'Video', seconds, duration: 300, measuredAt: 10000, focused: true });
test('actual video positions survive pause and seek; stale or ad time is unavailable', () => {
  let now = 10000; const timeline = createTimeline({ now: () => now });
  timeline.receive('edge', payload(83)); assert.equal(timeline.get().seconds, 83);
  timeline.receive('edge', { ...payload(83), paused: true }); assert.equal(timeline.get().seconds, 83);
  timeline.receive('edge', payload(12)); assert.equal(timeline.get().seconds, 12);
  timeline.receive('edge', { type: 'video-unavailable' }); assert.equal(timeline.get().available, false);
  timeline.receive('edge', payload(30)); now += 1300; assert.equal(timeline.get().available, false);
});
test('invalid sites, malformed times, and different video identities are handled', () => {
  const timeline = createTimeline({ now: () => 10000 });
  for (const item of [{ ...payload(5), url: 'https://evil.example/' }, payload(-1), payload(NaN), payload(400)]) timeline.receive('edge', item);
  assert.equal(timeline.get().available, false);
  timeline.receive('edge', payload(5)); const key = timeline.get().videoKey;
  timeline.receive('edge', { ...payload(5), url: 'https://www.youtube.com/watch?v=next', instance: 'next' });
  assert.notEqual(timeline.get().videoKey, key);
});
test('browser reader chooses a visible video and reads actual paused/seeked positions', () => {
  let snapshot; let ad = false; const messages = [];
  const video = { readyState: 4, currentTime: 83, duration: 300, currentSrc: 'fixture.mp4', paused: false, playbackRate: 1,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 500, bottom: 500 }) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../browser-extension/video-reader.js'), 'utf8'), {
    document: { visibilityState: 'visible', title: 'Fixture', hasFocus: () => true, addEventListener: () => {}, querySelectorAll: () => [video], querySelector: () => ad },
    location: { href: 'https://www.youtube.com/watch?v=fixture' }, innerWidth: 1000, innerHeight: 1000,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }), crypto: { randomUUID: () => 'instance' },
    setInterval: callback => { snapshot = callback; },
    chrome: { runtime: { sendMessage: message => { messages.push(message); return Promise.resolve(); } } }, Date,
  });
  assert.equal(messages.at(-1).seconds, 83);
  video.paused = true; snapshot(); assert.equal(messages.at(-1).seconds, 83);
  video.currentTime = 12; snapshot(); assert.equal(messages.at(-1).seconds, 12);
  ad = true; snapshot(); assert.equal(messages.at(-1).type, 'video-unavailable');
});
test('nearby bag categories retain a short useful product name', () => {
  const scores = categories.map(() => .1); scores[0] = .3; scores[1] = .299;
  assert.equal(selectLabel(scores).label, '가방');
  scores[0] = .4; assert.equal(selectLabel(scores).label, '가방');
  assert.equal(cosine([1, 0], [1, 0]), 1); assert.equal(cosine([1, 0], [0, 1]), 0);
});
test('compiled browser native host sends video time to the application named pipe', async () => {
  const timeline = createTimeline(); const server = startTimelineBridge(timeline);
  await once(server, 'listening');
  const child = spawn(path.join(__dirname, '../vendor/timeline-host/CleanTouchVideoHost.exe'), [], { windowsHide: true });
  try {
    const received = once(child.stdout, 'data');
    const data = Buffer.from(JSON.stringify({ ...payload(83), measuredAt: Date.now() }));
    const header = Buffer.alloc(4); header.writeUInt32LE(data.length);
    child.stdin.write(Buffer.concat([header, data]));
    const [answer] = await received; assert(answer.length >= 4);
    assert.equal(timeline.get().seconds, 83);
  } finally { child.stdin.end(); await once(child, 'exit'); await new Promise(resolve => server.close(resolve)); }
});
