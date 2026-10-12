const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
function startWindowsMediaTime(app) {
  let latest = { available: false }; let receivedAt = 0;
  if (process.platform !== 'win32') return { get: () => latest, close() {} };
  const file = path.join(app.getPath('userData'), 'windows-media-time.ps1');
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.copyFileSync(path.join(app.getAppPath(), 'windows-media-time.ps1'), file);
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  let pending = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    pending += chunk; if (pending.length > 32768) pending = '';
    let end; while ((end = pending.indexOf('\n')) >= 0) { const line = pending.slice(0, end); pending = pending.slice(end + 1); try { latest = JSON.parse(line); receivedAt = Date.now(); } catch {} }
  });
  child.on('error', () => { latest = { available: false }; });
  child.on('exit', () => { latest = { available: false }; });
  return { get: () => Date.now() - receivedAt < 2000 ? latest : { available: false }, close: () => child.kill() };
}
module.exports = { startWindowsMediaTime };
