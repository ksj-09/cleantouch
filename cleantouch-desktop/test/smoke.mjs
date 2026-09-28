import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createMockServer } = require('./mock-api.cjs');
const server = createMockServer().listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;

let socket;
try {
  const targets = await (await fetch('http://127.0.0.1:9223/json')).json();
  const page = targets.find(target => target.type === 'page' && target.title === 'CleanTouch');
  assert(page, 'Start the packaged app with --remote-debugging-port=9223 first');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let nextId = 1;
  async function evaluate(expression) {
    const id = nextId++;
    const answer = new Promise((resolve, reject) => {
      const listener = event => {
        const value = JSON.parse(event.data);
        if (value.id !== id) return;
        socket.removeEventListener('message', listener);
        if (value.error || value.result?.exceptionDetails) reject(new Error(JSON.stringify(value.error || value.result.exceptionDetails)));
        else resolve(value.result?.result?.value);
      };
      socket.addEventListener('message', listener);
    });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    return answer;
  }
  const settings = await evaluate('window.cleanTouch.getSettings()');
  try {
    if (settings.keyConfigured) {
      await evaluate(`window.cleanTouch.setMode('local')`);
      const local = await evaluate('window.cleanTouch.health()');
      assert.equal(local.body.providerConfigured, true);
      assert.equal(local.body.provider, 'gemini');
    }
    await evaluate(`window.cleanTouch.setMode('server')`);
    await evaluate(`window.cleanTouch.setApiUrl('http://127.0.0.1:${port}')`);
    const health = await evaluate('window.cleanTouch.health()');
    assert.equal(health.body.provider, 'gemini');
    const outcome = await evaluate(`(async () => {
      const sources = await window.cleanTouch.listSources();
      const source = sources.find(item => item.id.startsWith('screen:')) || sources[0];
      if (!source) throw new Error('No screen capture source is available');
      await window.cleanTouch.selectSource(source.id);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      try {
        const video = document.createElement('video');
        video.muted = true;
        video.srcObject = stream;
        await video.play();
        if (video.readyState < 2) await new Promise(resolve => video.addEventListener('loadeddata', resolve, { once: true }));
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(1280, video.videoWidth);
        canvas.height = Math.max(1, Math.round(video.videoHeight * canvas.width / video.videoWidth));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
        const result = await window.cleanTouch.scan(new Uint8Array(await blob.arrayBuffer()));
        return { status: result.status, label: result.body?.products?.[0]?.label, width: canvas.width };
      } finally { stream.getTracks().forEach(track => track.stop()); }
    })()`);
    assert.equal(outcome.status, 200);
    assert.equal(outcome.label, '테스트 상품');
    assert(outcome.width > 0);
    console.log('Packaged screen capture and scan IPC: OK');
  } finally {
    await evaluate(`window.cleanTouch.setApiUrl(${JSON.stringify(settings.apiUrl)})`);
    await evaluate(`window.cleanTouch.setMode(${JSON.stringify(settings.mode)})`);
  }
} finally {
  socket?.close();
  await new Promise(resolve => server.close(resolve));
}
