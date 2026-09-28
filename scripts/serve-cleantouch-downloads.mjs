import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.CLEANTOUCH_DOWNLOAD_PORT || 8100);
const files = new Map([
  ['app-debug.apk', { path: path.join(root, 'cleantouch-android/app/build/outputs/apk/debug/app-debug.apk'), type: 'application/vnd.android.package-archive' }],
  ['CleanTouch Setup 0.1.4.exe', { path: path.join(root, 'cleantouch-desktop/dist/CleanTouch Setup 0.1.4.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch 0.1.4.exe', { path: path.join(root, 'cleantouch-desktop/dist/CleanTouch 0.1.4.exe'), type: 'application/vnd.microsoft.portable-executable' }],
]);

const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CleanTouch 다운로드</title>
<style>body{font:16px system-ui,sans-serif;max-width:680px;margin:50px auto;padding:0 20px;background:#101922;color:#f2faf7}a{color:#8cf0ce}li{margin:18px 0}small{color:#adc4c0}</style>
<h1>CleanTouch 다운로드</h1><p>휴대폰과 Windows PC에서 사용할 파일을 선택하세요.</p><ul>
<li><a href="/app-debug.apk">Android APK</a></li>
<li><a href="/${encodeURIComponent('CleanTouch Setup 0.1.4.exe')}">Windows 설치형</a></li>
<li><a href="/${encodeURIComponent('CleanTouch 0.1.4.exe')}">Windows 휴대형 · 설치 없이 실행</a></li></ul>
<small>이 주소는 현재 PC와 같은 네트워크에서만 열립니다. PC 앱의 Gemini 키는 사용자가 각자 설정합니다.</small></html>`;

http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
  let name;
  try { name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname.slice(1)); }
  catch { response.writeHead(400); response.end(); return; }
  if (!name || name === 'index.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(page), 'cache-control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : page);
    return;
  }
  const file = files.get(name);
  if (!file || !fs.existsSync(file.path)) { response.writeHead(404); response.end('Not found'); return; }
  const stat = fs.statSync(file.path);
  response.writeHead(200, { 'content-type': file.type, 'content-length': stat.size,
    'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' });
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(file.path).pipe(response);
}).listen(port, '0.0.0.0', () => console.log(`CleanTouch downloads: http://0.0.0.0:${port}/`));
