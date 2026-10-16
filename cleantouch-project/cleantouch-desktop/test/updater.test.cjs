const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdateController } = require('../updater.cjs');
function setup(supported = true) {
  const updater = new EventEmitter();
  let installs = 0, downloads = 0, checks = 0, callback;
  updater.quitAndInstall = () => installs++;
  updater.downloadUpdate = async () => downloads++;
  updater.checkForUpdates = async () => checks++;
  const controller = createUpdateController(updater, { supported,
    schedule: fn => { callback = fn; return 1; }, cancel: () => { callback = undefined; } });
  return { updater, controller, tick: () => { const fn = callback; callback = undefined; fn?.(); },
    counts: () => ({ installs, downloads, checks }) };
}
test('checking and availability never download or install without consent', async () => {
  const f = setup();
  await f.controller.check();
  f.updater.emit('update-available', { version: '0.2.0' });
  assert.equal(f.updater.autoDownload, false);
  assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.deepEqual(f.counts(), { installs: 0, downloads: 0, checks: 1 });
  await f.controller.download();
  f.updater.emit('update-downloaded', { version: '0.2.0' });
  f.tick();
  assert.equal(f.counts().installs, 0);
});
test('installation waits for activity to finish and can be canceled', () => {
  const f = setup();
  f.updater.emit('update-downloaded', { version: '0.2.0' });
  f.controller.activity(true); f.controller.install(); f.tick();
  assert.equal(f.counts().installs, 0);
  f.controller.activity(false); f.controller.defer(); f.tick();
  assert.equal(f.counts().installs, 0);
  f.controller.install(); f.tick();
  assert.equal(f.counts().installs, 1);
});
test('new capture cancels scheduled restart; repeated idle reports do not starve it', () => {
  const f = setup();
  f.updater.emit('update-downloaded', { version: '0.2.0' });
  f.controller.install(); f.controller.activity(true); f.tick();
  assert.equal(f.counts().installs, 0);
  f.controller.activity(false); f.controller.activity(false); f.tick();
  assert.equal(f.counts().installs, 1);
});
test('errors and portable mode never install', async () => {
  const f = setup();
  f.updater.emit('update-downloaded', { version: '0.2.0' });
  f.controller.install(); f.updater.emit('error', new Error('network')); f.tick();
  assert.equal(f.counts().installs, 0);
  assert.equal(f.controller.get().status, 'error');
  const portable = setup(false);
  await portable.controller.check(); await portable.controller.download(); portable.controller.install(); portable.tick();
  assert.deepEqual(portable.counts(), { installs: 0, downloads: 0, checks: 0 });
});
