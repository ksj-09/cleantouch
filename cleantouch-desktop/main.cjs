const { app, BrowserWindow, desktopCapturer, ipcMain, safeStorage, session, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const DEFAULT_API_URL = 'http://192.168.0.19:8790';
let selectedSourceId = '';
let apiUrl = DEFAULT_API_URL;
let mode = 'server';
let localKey = '';

function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }
function keyPath() { return path.join(app.getPath('userData'), 'gemini-key.bin'); }

function validApiUrl(input) {
  const parsed = new URL(String(input).trim());
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('서버 주소는 http:// 또는 https:// 주소로 입력해 주세요.');
  }
  return parsed.href.replace(/\/+$/, '');
}

function safeShoppingUrl(input) {
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

async function readSettings() {
  try {
    const value = JSON.parse(await fs.readFile(settingsPath(), 'utf8'));
    apiUrl = value.apiUrl === 'http://192.168.100.103:8790' ? DEFAULT_API_URL : validApiUrl(value.apiUrl);
    mode = value.mode === 'local' ? 'local' : 'server';
  } catch { /* Keep the local development address until the user changes it. */ }
}

async function saveSettings() {
  await fs.writeFile(settingsPath(), JSON.stringify({ apiUrl, mode }), { mode: 0o600 });
}

async function readLocalKey() {
  try {
    const encrypted = await fs.readFile(keyPath());
    localKey = safeStorage.decryptString(encrypted);
  } catch { localKey = ''; }
}

async function scanLocally(image) {
  const { GeminiVisionProvider, DEFAULT_GEMINI_MODEL } = await import('./vendor/gemini-provider.js');
  const { ProviderNotConfiguredError, ProviderUnavailableError, VisualSearchError } = await import('./vendor/provider-errors.js');
  const { ProviderRateLimitError } = await import('./vendor/rate-limit.js');
  try {
    const result = await new GeminiVisionProvider(localKey, DEFAULT_GEMINI_MODEL).search(Buffer.from(image));
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof ProviderRateLimitError) return { status: 429, body: { code: 'PROVIDER_RATE_LIMITED', message: error.message,
      retryAfterSeconds: error.retryAfterSeconds, limitWindow: error.limitWindow } };
    if (error instanceof ProviderUnavailableError) return { status: 503, body: { code: 'PROVIDER_UNAVAILABLE', message: error.message,
      retryAfterSeconds: error.retryAfterSeconds } };
    if (error instanceof ProviderNotConfiguredError) return { status: 503, body: { code: 'PROVIDER_NOT_CONFIGURED', message: error.message } };
    if (error instanceof VisualSearchError) return { status: 502, body: { code: 'VISUAL_SEARCH_FAILED', message: error.message } };
    return { status: 500, body: { code: 'INTERNAL_ERROR', message: '상품 분석 중 오류가 발생했어요.' } };
  }
}

async function fetchApi(resource, options = {}) {
  const response = await fetch(`${apiUrl}${resource}`, { ...options, signal: AbortSignal.timeout(90_000) });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch { body = { message: `서버 응답을 읽지 못했어요. (HTTP ${response.status})` }; }
  return { status: response.status, body, retryAfter: response.headers.get('retry-after') };
}

function createWindow() {
  const page = path.join(__dirname, 'index.html');
  const window = new BrowserWindow({
    x: 100, y: 100, width: 1100, height: 820, minWidth: 760, minHeight: 620,
    title: 'CleanTouch', backgroundColor: '#101922',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false,
    },
  });
  window.loadFile(page);
  window.webContents.setWindowOpenHandler(({ url }) => {
    const safe = safeShoppingUrl(url);
    if (safe) shell.openExternal(safe);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, destination) => {
    if (destination !== pathToFileURL(page).href) event.preventDefault();
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('kr.cleantouch.desktop');
  await readSettings();
  await readLocalKey();
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    const chosen = sources.find(source => source.id === selectedSourceId);
    callback(chosen ? { video: chosen } : {});
  });
  ipcMain.handle('sources:list', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'], thumbnailSize: { width: 240, height: 135 } });
    return sources.filter(source => source.name !== 'CleanTouch').map(source => ({
      id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL(),
    }));
  });
  ipcMain.handle('source:select', async (_event, id) => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    if (!sources.some(source => source.id === id)) throw new Error('선택한 창을 찾지 못했어요. 목록을 새로고침해 주세요.');
    selectedSourceId = id;
  });
  ipcMain.handle('settings:get', () => ({ apiUrl, mode, keyConfigured: Boolean(localKey) }));
  ipcMain.handle('settings:set-mode', async (_event, value) => {
    if (!['local', 'server'].includes(value)) throw new Error('지원하지 않는 연결 방식입니다.');
    mode = value;
    await saveSettings();
    return { mode };
  });
  ipcMain.handle('settings:set-api', async (_event, value) => {
    apiUrl = validApiUrl(value);
    await saveSettings();
    return { apiUrl };
  });
  ipcMain.handle('settings:set-key', async (_event, value) => {
    const key = String(value).trim();
    if (!key || key.length > 512) throw new Error('Gemini API 키를 확인해 주세요.');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('이 PC에서 키를 안전하게 저장할 수 없어요.');
    await fs.writeFile(keyPath(), safeStorage.encryptString(key), { mode: 0o600 });
    localKey = key;
    return { keyConfigured: true };
  });
  ipcMain.handle('settings:remove-key', async () => {
    localKey = '';
    await fs.rm(keyPath(), { force: true });
    return { keyConfigured: false };
  });
  ipcMain.handle('api:health', () => mode === 'local'
    ? { status: 200, body: { ok: true, providerConfigured: Boolean(localKey), provider: 'gemini', model: 'gemini-3.5-flash-lite', local: true } }
    : fetchApi('/health'));
  ipcMain.handle('api:scan', async (_event, image) => {
    if (!(image instanceof Uint8Array) || image.length === 0 || image.length > 8 * 1024 * 1024) {
      throw new Error('장면 이미지의 크기가 올바르지 않아요.');
    }
    if (mode === 'local') return scanLocally(image);
    const form = new FormData();
    form.append('image', new Blob([image], { type: 'image/jpeg' }), 'scene.jpg');
    return fetchApi('/v1/scans', { method: 'POST', body: form });
  });
  ipcMain.handle('links:open', (_event, value) => {
    const safe = safeShoppingUrl(value);
    if (!safe) throw new Error('열 수 없는 상품 링크예요.');
    return shell.openExternal(safe);
  });
  ipcMain.handle('visual:prepare', async (_event, image) => {
    if (!(image instanceof Uint8Array) || image.length === 0 || image.length > 8 * 1024 * 1024) {
      throw new Error('상품 이미지의 크기가 올바르지 않아요.');
    }
    const { nativeImage } = require('electron');
    const picture = nativeImage.createFromBuffer(Buffer.from(image));
    if (picture.isEmpty()) throw new Error('상품 이미지를 읽지 못했어요.');
    const filename = `CleanTouch-product-${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;
    const destination = path.join(app.getPath('downloads'), filename);
    await fs.writeFile(destination, picture.toJPEG(90));
    await shell.openExternal('https://lens.google.com/');
    shell.showItemInFolder(destination);
    return { filename };
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
