const net = require('node:net');
const crypto = require('node:crypto');
const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
function pipeName() { return '\\\\.\\pipe\\cleantouch.timeline.' + crypto.createHash('sha256').update(os.userInfo().username).digest('hex').slice(0, 16); }
function extensionId(key) { return crypto.createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, char => String.fromCharCode(97 + parseInt(char, 16))); }
function createTimeline({ now = Date.now } = {}) {
  const clients = new Map();
  function receive(id, payload) {
    if (!payload || payload.type === 'video-unavailable') { clients.delete(id); return; }
    if (payload.type !== 'video-time') return;
    let url;
    try { url = new URL(payload.url); } catch { return; }
    if (url.protocol !== 'https:' || !/(^|\.)(youtube\.com|instagram\.com)$/.test(url.hostname)) return;
    if (!Number.isFinite(payload.seconds) || !Number.isFinite(payload.duration) || payload.seconds < 0 || payload.seconds > payload.duration || payload.duration <= 0 || payload.duration > 604800) return;
    if (!Number.isFinite(payload.measuredAt) || Math.abs(now() - payload.measuredAt) > 2000) return;
    const previous = clients.get(id);
    const focusedAt = payload.focused ? now() : previous?.focusedAt || 0;
    const videoId = url.hostname.includes('youtube.com') ? (url.searchParams.get('v') || url.pathname) : url.pathname;
    clients.set(id, { seconds: payload.seconds, duration: payload.duration, title: String(payload.title || '').slice(0, 250), videoKey: `${url.hostname}:${videoId}:${String(payload.instance || '').slice(0, 64)}`, measuredAt: payload.measuredAt, receivedAt: now(), focusedAt });
  }
  function get() {
    const active = [...clients.values()].filter(item => now() - item.receivedAt < 1200).sort((a, b) => b.focusedAt - a.focusedAt || b.receivedAt - a.receivedAt);
    if (!active.length || !active[0].focusedAt) return { available: false };
    const result = active[0];
    return { available: true, seconds: result.seconds, title: result.title, videoKey: result.videoKey, measuredAt: result.measuredAt };
  }
  return { receive, get, remove: id => clients.delete(id) };
}
function startTimelineBridge(timeline) {
  const server = net.createServer(socket => {
    const id = crypto.randomUUID(); let pending = Buffer.alloc(0);
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, chunk]);
      if (pending.length > 32768) { socket.destroy(); return; }
      while (pending.length >= 4) {
        const length = pending.readUInt32LE();
        if (length < 2 || length > 8192) { socket.destroy(); return; }
        if (pending.length < length + 4) break;
        try { timeline.receive(id, JSON.parse(pending.subarray(4, length + 4).toString('utf8'))); } catch { socket.destroy(); return; }
        pending = pending.subarray(length + 4);
        const answer = Buffer.from(JSON.stringify({ connected: true }));
        const header = Buffer.alloc(4); header.writeUInt32LE(answer.length);
        socket.write(Buffer.concat([header, answer]));
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => timeline.remove(id));
  });
  server.on('error', error => console.warn('Video timeline bridge unavailable:', error.code));
  server.listen(pipeName());
  return server;
}
async function registerTimelineHost(app) {
  if (process.platform !== 'win32') return;
  const extension = JSON.parse(await fs.readFile(path.join(app.getAppPath(), 'browser-extension', 'manifest.json'), 'utf8'));
  const host = app.isPackaged ? path.join(process.resourcesPath, 'timeline-host', 'CleanTouchVideoHost.exe') : path.join(app.getAppPath(), 'vendor', 'timeline-host', 'CleanTouchVideoHost.exe');
  const manifestPath = path.join(app.getPath('userData'), 'video-time-host.json');
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify({ name: 'kr.cleantouch.timeline', description: 'CleanTouch local video playback time', path: host, type: 'stdio', allowed_origins: [`chrome-extension://${extensionId(extension.key)}/`] }));
  for (const browser of ['Google\\Chrome', 'Microsoft\\Edge']) await new Promise((resolve, reject) => {
    execFile('reg.exe', ['add', `HKCU\\Software\\${browser}\\NativeMessagingHosts\\kr.cleantouch.timeline`, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], { windowsHide: true }, error => error ? reject(error) : resolve());
  });
}
async function extractExtension(app) {
  const directory = path.join(app.getPath('userData'), 'browser-extension');
  await fs.mkdir(directory, { recursive: true });
  for (const name of ['manifest.json', 'background.js', 'video-reader.js', '설치안내.txt']) await fs.copyFile(path.join(app.getAppPath(), 'browser-extension', name), path.join(directory, name));
  return directory;
}
module.exports = { pipeName, extensionId, createTimeline, startTimelineBridge, registerTimelineHost, extractExtension };
