import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const apkPath = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../cleantouch-android/app/build/outputs/apk/debug/app-debug.apk'));
const port = Number(process.argv[3] ?? 8099);
const apkName = path.basename(apkPath);

if (!fs.existsSync(apkPath)) throw new Error(`APK not found: ${apkPath}`);

const server = http.createServer((request, response) => {
  if (request.url === '/' || request.url === '/index.html') {
    const body = `<!doctype html><meta name="viewport" content="width=device-width"><title>CleanTouch</title><h1>CleanTouch APK</h1><p><a href="/${apkName}">휴대폰에 APK 다운로드</a></p>`;
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(body);
    return;
  }
  if (request.url !== `/${encodeURIComponent(apkName)}` && request.url !== `/${apkName}`) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const stat = fs.statSync(apkPath);
  response.writeHead(200, {
    'content-type': 'application/vnd.android.package-archive',
    'content-length': stat.size,
    'content-disposition': `attachment; filename="${apkName}"`,
    'cache-control': 'no-store',
  });
  fs.createReadStream(apkPath).pipe(response);
});

server.listen(port, '0.0.0.0', () => console.log(`CleanTouch APK server: http://0.0.0.0:${port}/`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
