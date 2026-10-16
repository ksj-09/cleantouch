import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.CLEANTOUCH_DOWNLOAD_PORT || 8100);
const desktopVersion=JSON.parse(fs.readFileSync(path.join(root,'cleantouch-desktop/package.json'),'utf8')).version;
const files = new Map([
  [`CleanTouch-Setup-${desktopVersion}.exe`, {path:path.join(root,`artifacts/downloads/CleanTouch-Setup-${desktopVersion}-Windows-x64.exe`),type:'application/vnd.microsoft.portable-executable'}],
  [`CleanTouch-Portable-${desktopVersion}.exe`, {path:path.join(root,`artifacts/downloads/CleanTouch-Portable-${desktopVersion}-Windows-x64.exe`),type:'application/vnd.microsoft.portable-executable'}],
  ['CleanTouch-Setup-0.1.35.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.35.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.35.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.35.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.34.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.34.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.34.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.34.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.31.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.31.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.31.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.31.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.30.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.30.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.30.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.30.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.29.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.29.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.29.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.29.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.28.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.28.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.28.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.28.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.27.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.27.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.27.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.27.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.26.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.26.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.26.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.26.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Android-0.4.8-debug.apk', { path: path.join(root, 'artifacts/downloads/CleanTouch-Android-0.4.8-debug.apk'), type: 'application/vnd.android.package-archive' }],
  ['CleanTouch-Setup-0.1.25.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.25.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.25.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.25.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Android-0.4.7-debug.apk', { path: path.join(root, 'artifacts/downloads/CleanTouch-Android-0.4.7-debug.apk'), type: 'application/vnd.android.package-archive' }],
  ['CleanTouch-Setup-0.1.24.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.24.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.24.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.24.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Android-0.4.6-debug.apk', { path: path.join(root, 'artifacts/downloads/CleanTouch-Android-0.4.6-debug.apk'), type: 'application/vnd.android.package-archive' }],
  ['CleanTouch-Setup-0.1.23.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.23.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.23.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.23.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.22.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.22.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.22.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.22.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.21.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.21.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.21.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.21.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.20.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.20.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.20.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.20.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Android-0.4.5-debug.apk', { path: path.join(root, 'artifacts/downloads/CleanTouch-Android-0.4.5-debug.apk'), type: 'application/vnd.android.package-archive' }],
  ['CleanTouch-Setup-0.1.19.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.19.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.19.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.19.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Video-Time-0.1.19.zip', { path: path.join(root, 'artifacts/downloads/CleanTouch-Video-Time-0.1.19.zip'), type: 'application/zip' }],
  ['CleanTouch-Setup-0.1.18.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.18.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.18.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.18.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Setup-0.1.17.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.17.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.17.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.17.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Android-0.4.4-debug.apk', { path: path.join(root, 'artifacts/downloads/CleanTouch-Android-0.4.4-debug.apk'), type: 'application/vnd.android.package-archive' }],
  ['CleanTouch-Android-0.4.3-debug.apk', { path: path.join(root, 'artifacts/downloads/CleanTouch-Android-0.4.3-debug.apk'), type: 'application/vnd.android.package-archive' }],
  ['CleanTouch-Setup-0.1.16.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Setup-0.1.16.exe'), type: 'application/vnd.microsoft.portable-executable' }],
  ['CleanTouch-Portable-0.1.16.exe', { path: path.join(root, 'artifacts/downloads/CleanTouch-Portable-0.1.16.exe'), type: 'application/vnd.microsoft.portable-executable' }],
]);

const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CleanTouch 다운로드</title>
<style>body{font:16px/1.65 system-ui,sans-serif;max-width:680px;margin:50px auto;padding:0 20px;background:#f7f4ee;color:#292738}h1{letter-spacing:-1px}a{color:#6848db;font-weight:700}li{margin:18px 0;padding:18px 22px;border:1px solid #e5ded7;border-radius:14px;background:#fffdfb;list-style:none}ul{padding:0}small{color:#6c6682}</style>
<h1>CleanTouch 다운로드</h1><p>휴대폰과 Windows PC에서 사용할 파일을 선택하세요.</p><ul>
<li><a href="/${encodeURIComponent(`CleanTouch-Setup-${desktopVersion}.exe`)}">Windows 설치형 ${desktopVersion}</a></li>
<li><a href="/${encodeURIComponent(`CleanTouch-Portable-${desktopVersion}.exe`)}">Windows 휴대형 · 설치 없이 실행 ${desktopVersion}</a></li>
<li><a href="/${encodeURIComponent('CleanTouch-Android-0.4.8-debug.apk')}">기존 Android APK 0.4.8</a><br><small>PC의 새 화면 함께 보기 기능은 아직 모바일에 반영되지 않았습니다.</small></li></ul>
<p>영상 시간 연결 확장 프로그램 없이 시작합니다. 재생 시간을 확인하면 보정하고, 확인할 수 없으면 시청 추정 시간으로 표시합니다.</p>
<small>상품 윤곽 추출은 기기에 포함된 모델로 실행합니다. AI 상품 검색과 장소 분석은 선택한 이미지를 Gemini에 전송하며 인터넷 연결이 필요합니다. 사용자 API 키 발급은 필요하지 않습니다. Lens 검색에는 Google 인터넷 연결이 필요합니다. Windows에서는 서명되지 않은 설치 파일 경고가 표시될 수 있습니다.</small></html>`;

http.createServer((request, response) => {
  response.setHeader('x-content-type-options','nosniff');
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
  else {const stream=fs.createReadStream(file.path);stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);}
}).listen(port, '0.0.0.0', () => console.log(`CleanTouch downloads: http://0.0.0.0:${port}/`));
