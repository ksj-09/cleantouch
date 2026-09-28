const bridge = window.cleanTouch;
const byId = id => document.getElementById(id);
const ui = {
  api: byId('api-url'), serverStatus: byId('server-status'), sources: byId('sources'),
  key: byId('gemini-key'), localSettings: byId('local-settings'), serverSettings: byId('server-settings'),
  localMode: byId('mode-local'), serverMode: byId('mode-server'), removeKey: byId('remove-key'),
  title: byId('phase-title'), detail: byId('phase-detail'), progress: byId('progress'),
  start: byId('start'), stop: byId('stop'), resume: byId('resume'), reset: byId('reset'),
  products: byId('products'), count: byId('product-count'), video: byId('capture-video'),
};

let phase = 'idle';
let selectedId = '';
let serverReady = false;
let mode = 'server';
let keyConfigured = false;
let stream = null;
let captureTimer = null;
let captureBusy = false;
let sampleInterval = 5_000;
let lastSampleAt = -Infinity;
let startedAt = 0;
let frames = [];
let cursor = 0;
let retryAt = 0;
let found = new Map();

function message(error) { return error instanceof Error ? error.message : String(error); }
function clock(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

function refresh() {
  ui.localSettings.hidden = mode !== 'local';
  ui.serverSettings.hidden = mode !== 'server';
  ui.localMode.classList.toggle('selected', mode === 'local');
  ui.serverMode.classList.toggle('selected', mode === 'server');
  ui.localMode.disabled = ui.serverMode.disabled = phase === 'capturing' || phase === 'analyzing';
  ui.removeKey.disabled = !keyConfigured;
  ui.start.hidden = phase !== 'idle';
  ui.start.disabled = !selectedId || !serverReady;
  ui.stop.hidden = phase !== 'capturing';
  ui.resume.hidden = phase !== 'paused';
  ui.resume.disabled = Date.now() < retryAt;
  ui.reset.hidden = phase === 'idle' || phase === 'capturing';
  ui.count.textContent = String(found.size);
  if (phase === 'capturing') {
    ui.title.textContent = '화면을 살펴보고 있어요';
    ui.detail.textContent = '선택한 창을 보며 상품이 나오는 장면을 모으고 있습니다.';
    ui.progress.textContent = `${clock(Math.floor((Date.now() - startedAt) / 1000))} · ${frames.length}장면 저장`;
  } else if (phase === 'analyzing') {
    ui.title.textContent = '상품을 찾고 있어요';
    ui.detail.textContent = '장면을 순서대로 분석 서버에 보내고 있습니다.';
    ui.progress.textContent = `${cursor} / ${frames.length}장면 완료`;
  } else if (phase === 'paused') {
    ui.title.textContent = '분석이 잠시 멈췄어요';
    ui.progress.textContent = `${cursor} / ${frames.length}장면 완료`;
    if (retryAt > Date.now()) ui.progress.textContent += ` · ${Math.ceil((retryAt - Date.now()) / 1000)}초 후 재개 가능`;
  } else if (phase === 'complete') {
    ui.title.textContent = '분석을 마쳤어요';
    ui.detail.textContent = found.size ? '이미지가 일치하는 페이지를 먼저 확인하고, 없으면 쇼핑 검색을 이용해 보세요.' : '인식 가능한 상품이 없었어요. 다른 화면으로 다시 시도해 보세요.';
    ui.progress.textContent = `${frames.length}장면 분석 완료`;
  } else {
    ui.title.textContent = '준비됐어요';
    ui.detail.textContent = '창을 고른 뒤 시작하세요. 5초 간격으로 장면을 모읍니다.';
    ui.progress.textContent = '';
  }
}

async function loadSources() {
  const sources = await bridge.listSources();
  ui.sources.replaceChildren();
  if (!sources.length) {
    const note = document.createElement('p');
    note.textContent = '선택할 창을 찾지 못했어요. 유튜브 창을 열고 새로고침해 주세요.';
    ui.sources.append(note);
  }
  if (!sources.some(source => source.id === selectedId)) selectedId = '';
  for (const source of sources) {
    const button = document.createElement('button');
    button.className = `source${source.id === selectedId ? ' selected' : ''}`;
    button.type = 'button';
    const image = document.createElement('img');
    image.src = source.thumbnail;
    image.alt = '';
    const label = document.createElement('span');
    label.textContent = source.name;
    button.append(image, label);
    button.addEventListener('click', () => {
      selectedId = source.id;
      for (const item of ui.sources.children) item.classList.remove('selected');
      button.classList.add('selected');
      refresh();
    });
    ui.sources.append(button);
  }
  refresh();
}

async function checkServer() {
  serverReady = false;
  refresh();
  ui.serverStatus.textContent = '연결 확인 중…';
  try {
    const { status, body } = await bridge.health();
    if (status !== 200 || !body?.providerConfigured) {
      ui.serverStatus.textContent = mode === 'local' ? '내 Gemini API 키를 저장해 주세요.' : '서버가 응답했지만 상품 분석 공급자가 설정되지 않았어요.';
      return;
    }
    if (body.provider !== 'gemini') {
      ui.serverStatus.textContent = '현재 서버의 Gemini 적용을 확인할 수 없어요. 검색 서버를 재시작한 뒤 다시 확인해 주세요.';
      return;
    }
    serverReady = true;
    ui.serverStatus.textContent = body.local
      ? `내 Gemini 키 저장됨 · ${body.model || 'Gemini'} (실제 분석 시 키 유효성 확인)`
      : `Gemini 서버 연결됨${body.model ? ` · ${body.model}` : ''} · ${body.visualMatchesConfigured ? '이미지 일치 검색 준비됨' : '이미지 일치 검색 미설정'}`;
  } catch (error) { ui.serverStatus.textContent = `연결 실패: ${message(error)}`; }
  finally { refresh(); }
}

async function captureFrame(force = false) {
  if (captureBusy || !stream || ui.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const elapsed = Date.now() - startedAt;
  if (!force && elapsed - lastSampleAt < sampleInterval) return;
  captureBusy = true;
  try {
    const width = ui.video.videoWidth;
    const height = ui.video.videoHeight;
    if (!width || !height) return;
    const scale = Math.min(1, 1280 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(ui.video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
    if (!blob) throw new Error('화면 이미지를 만들지 못했어요.');
    if (frames.length >= 24) {
      frames = frames.filter((_, index) => index % 2 === 0);
      sampleInterval *= 2;
    }
    frames.push({ blob, seconds: Math.floor(elapsed / 1000) });
    lastSampleAt = elapsed;
    refresh();
  } finally { captureBusy = false; }
}

async function startCapture() {
  try {
    await bridge.selectSource(selectedId);
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    ui.video.srcObject = stream;
    await ui.video.play();
    startedAt = Date.now();
    lastSampleAt = -Infinity;
    sampleInterval = 5_000;
    frames = []; cursor = 0; retryAt = 0; found = new Map();
    ui.products.replaceChildren();
    phase = 'capturing';
    stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (phase === 'capturing') stopCapture(); });
    await captureFrame(true);
    captureTimer = setInterval(() => { captureFrame().catch(error => { ui.detail.textContent = message(error); }); refresh(); }, 1000);
    refresh();
  } catch (error) {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    ui.detail.textContent = `화면을 시작하지 못했어요: ${message(error)}`;
  }
}

async function stopCapture() {
  if (phase !== 'capturing') return;
  clearInterval(captureTimer);
  try { await captureFrame(true); } catch (error) { ui.detail.textContent = message(error); }
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  ui.video.srcObject = null;
  phase = 'analyzing';
  refresh();
  await analyze();
}

function retrySeconds(result) {
  const bodyValue = Number(result.body?.retryAfterSeconds);
  if (Number.isFinite(bodyValue) && bodyValue > 0) return Math.ceil(bodyValue);
  const headerValue = Number(result.retryAfter);
  return Number.isFinite(headerValue) && headerValue > 0 ? Math.ceil(headerValue) : 30;
}

async function thumbnail(blob, box) {
  if (!Array.isArray(box) || box.length !== 4 || !box.every(value => Number.isFinite(value) && value >= 0 && value <= 1)
    || box[2] <= box[0] || box[3] <= box[1]) return URL.createObjectURL(blob);
  try {
    const bitmap = await createImageBitmap(blob);
    const x = Math.floor(box[0] * bitmap.width);
    const y = Math.floor(box[1] * bitmap.height);
    const width = Math.min(bitmap.width - x, Math.max(1, Math.round((box[2] - box[0]) * bitmap.width)));
    const height = Math.min(bitmap.height - y, Math.max(1, Math.round((box[3] - box[1]) * bitmap.height)));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, x, y, width, height, 0, 0, width, height);
    bitmap.close();
    const crop = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .85));
    return URL.createObjectURL(crop || blob);
  } catch { return URL.createObjectURL(blob); }
}

function renderProducts() {
  ui.products.replaceChildren();
  if (!found.size) {
    const empty = document.createElement('p');
    empty.className = 'empty'; empty.textContent = '아직 찾은 상품이 없어요.';
    ui.products.append(empty);
  }
  for (const product of found.values()) {
    const card = document.createElement('article'); card.className = 'product';
    const image = document.createElement('img'); image.src = product.thumbnail; image.alt = product.label;
    const info = document.createElement('div');
    const time = document.createElement('small'); time.textContent = `${clock(product.seconds)}에 등장`;
    const name = document.createElement('h3'); name.textContent = product.label;
    info.append(time, name);
    const visual = document.createElement('button');
    visual.type = 'button'; visual.textContent = '이 사진으로 Google Lens에서 찾기 ↗';
    visual.addEventListener('click', async () => {
      try {
        const crop = await fetch(product.thumbnail).then(response => response.arrayBuffer());
        const { filename } = await bridge.prepareVisualSearch(new Uint8Array(crop));
        ui.detail.textContent = `${filename}을 다운로드 폴더에 저장했어요. 열린 Google Lens의 이미지 업로드에 이 파일을 넣어 주세요.`;
      } catch (error) { ui.detail.textContent = `이미지 검색을 열지 못했어요: ${message(error)}`; }
    });
    info.append(visual);
    for (const match of product.matches.slice(0, 4)) {
      const link = document.createElement('button');
      const kind = match.matchKind === 'exact_image' ? '같은 이미지' : match.matchKind === 'partial_image' ? '비슷한 이미지' : '문자로 검색';
      link.type = 'button'; link.textContent = `${match.source || '웹'} · ${kind} ↗`;
      link.addEventListener('click', () => bridge.openLink(match.url).catch(error => { ui.detail.textContent = message(error); }));
      info.append(link);
    }
    card.append(image, info); ui.products.append(card);
  }
  refresh();
}

async function analyze() {
  phase = 'analyzing'; refresh();
  while (cursor < frames.length && phase === 'analyzing') {
    const frame = frames[cursor];
    let result;
    try { result = await bridge.scan(new Uint8Array(await frame.blob.arrayBuffer())); }
    catch (error) {
      phase = 'paused'; ui.detail.textContent = `서버에 연결하지 못했어요: ${message(error)}`; refresh(); return;
    }
    if (result.status !== 200) {
      phase = 'paused';
      if ([429, 503].includes(result.status) && ['PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE'].includes(result.body?.code)) {
        retryAt = Date.now() + retrySeconds(result) * 1000;
      }
      ui.detail.textContent = result.body?.message || `분석 서버 오류 (HTTP ${result.status})`;
      refresh(); return;
    }
    const products = Array.isArray(result.body?.products) ? result.body.products : [];
    for (const product of products) {
      const matches = Array.isArray(product.matches) ? product.matches.filter(item => item && typeof item.url === 'string') : [];
      const label = typeof product.label === 'string' ? product.label.trim() : '';
      if (!label || !matches.length) continue;
      const id = matches.map(item => item.url).sort().join('|');
      if (found.has(id)) continue;
      found.set(id, { label, matches, seconds: frame.seconds, thumbnail: await thumbnail(frame.blob, product.box) });
    }
    cursor++;
    renderProducts();
  }
  phase = 'complete'; refresh();
}

async function reset() {
  for (const product of found.values()) URL.revokeObjectURL(product.thumbnail);
  frames = []; found = new Map(); cursor = 0; retryAt = 0; phase = 'idle';
  renderProducts(); refresh();
}

byId('refresh-sources').addEventListener('click', () => loadSources().catch(error => { ui.detail.textContent = message(error); }));
byId('save-api').addEventListener('click', async () => {
  try { const value = await bridge.setApiUrl(ui.api.value); ui.api.value = value.apiUrl; await checkServer(); }
  catch (error) { ui.serverStatus.textContent = `주소 오류: ${message(error)}`; }
});
ui.localMode.addEventListener('click', async () => {
  if (mode === 'local') return;
  try { await bridge.setMode('local'); mode = 'local'; await checkServer(); }
  catch (error) { ui.serverStatus.textContent = message(error); }
});
ui.serverMode.addEventListener('click', async () => {
  if (mode === 'server') return;
  try { await bridge.setMode('server'); mode = 'server'; await checkServer(); }
  catch (error) { ui.serverStatus.textContent = message(error); }
});
byId('save-key').addEventListener('click', async () => {
  try {
    await bridge.setKey(ui.key.value);
    ui.key.value = '';
    keyConfigured = true;
    await checkServer();
  } catch (error) { ui.serverStatus.textContent = `키 저장 실패: ${message(error)}`; }
});
ui.removeKey.addEventListener('click', async () => {
  try { await bridge.removeKey(); keyConfigured = false; await checkServer(); }
  catch (error) { ui.serverStatus.textContent = message(error); }
});
byId('get-key').addEventListener('click', () => bridge.openLink('https://aistudio.google.com/apikey').catch(error => {
  ui.serverStatus.textContent = message(error);
}));
byId('check-api').addEventListener('click', checkServer);
ui.start.addEventListener('click', startCapture);
ui.stop.addEventListener('click', stopCapture);
ui.resume.addEventListener('click', () => { if (Date.now() >= retryAt) analyze(); });
ui.reset.addEventListener('click', reset);
setInterval(() => { if (phase === 'capturing' || phase === 'paused') refresh(); }, 1000);

bridge.getSettings().then(settings => {
  ui.api.value = settings.apiUrl;
  mode = settings.mode;
  keyConfigured = settings.keyConfigured;
  refresh();
  checkServer();
});
loadSources().catch(error => { ui.detail.textContent = message(error); });
refresh();
