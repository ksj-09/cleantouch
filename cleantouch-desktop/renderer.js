const bridge = window.cleanTouch;
const byId = id => document.getElementById(id);
const ui = {
  api: byId('api-url'), serverStatus: byId('server-status'), sources: byId('sources'),
  key: byId('gemini-key'), localSettings: byId('local-settings'), serverSettings: byId('server-settings'),
  localMode: byId('mode-local'), serverMode: byId('mode-server'), removeKey: byId('remove-key'),
  title: byId('phase-title'), detail: byId('phase-detail'), progress: byId('progress'),
  start: byId('start'), stop: byId('stop'), resume: byId('resume'), reset: byId('reset'),
  products: byId('products'), count: byId('product-count'), video: byId('capture-video'),
  startTime: byId('start-time'), filter: byId('product-filter'), enterWidget: byId('enter-widget'),
  widget: byId('widget-panel'), widgetImage: byId('widget-image'), widgetPreview: byId('widget-preview'),
  widgetTime: byId('widget-time'), widgetStatus: byId('widget-status'), widgetAnalyze: byId('widget-analyze'),
  widgetPick: byId('widget-pick'), widgetPin: byId('pin-widget'), widgetTimeEditor: byId('widget-time-editor'),
  widgetStop: byId('widget-stop'),
  widgetTimeInput: byId('widget-time-input'), focusPicker: byId('focus-picker'), focusImage: byId('focus-image'),
  focusViewport: byId('focus-viewport'), focusCanvas: byId('focus-canvas'), focusHint: byId('focus-hint'),
  submitFocus: byId('submit-focus'),
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
let completedFrames = new WeakSet();
let currentFrame = null;
let currentPreviewUrl = '';
let liveBusy = false;
let baseOffsetSeconds = 0;
let focusBlob = null;
let focusRect = null;
let pointerStart = null;
let widgetPinned = true;

function message(error) { return error instanceof Error ? error.message : String(error); }
function clock(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

function parseClock(value) {
  const match = String(value).trim().match(/^(\d{1,4}):([0-5]?\d)$/);
  if (!match) throw new Error('시각을 분:초 형식으로 입력하세요. 예: 02:15');
  return Number(match[1]) * 60 + Number(match[2]);
}

function elapsedSeconds() { return startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0; }
function currentVideoSecond() { return baseOffsetSeconds + elapsedSeconds(); }

function refresh() {
  ui.localSettings.hidden = mode !== 'local';
  ui.serverSettings.hidden = mode !== 'server';
  ui.localMode.classList.toggle('selected', mode === 'local');
  ui.serverMode.classList.toggle('selected', mode === 'server');
  ui.localMode.disabled = ui.serverMode.disabled = phase === 'capturing' || phase === 'analyzing';
  ui.removeKey.disabled = !keyConfigured;
  ui.start.hidden = phase !== 'idle';
  ui.start.disabled = !selectedId || !serverReady;
  ui.startTime.disabled = phase === 'capturing' || phase === 'analyzing';
  ui.stop.hidden = phase !== 'capturing';
  ui.stop.disabled = liveBusy;
  ui.resume.hidden = phase !== 'paused';
  ui.resume.disabled = Date.now() < retryAt;
  ui.reset.hidden = phase === 'idle' || phase === 'capturing';
  ui.count.textContent = String(found.size);
  ui.widgetAnalyze.disabled = phase !== 'capturing' || liveBusy || !currentFrame;
  ui.widgetPick.disabled = phase !== 'capturing' || liveBusy || !currentFrame;
  ui.widgetStop.disabled = phase !== 'capturing' || liveBusy;
  ui.widgetTime.textContent = clock(currentVideoSecond());
  ui.widgetPin.classList.toggle('unpinned', !widgetPinned);
  ui.widgetPin.title = widgetPinned ? '항상 위에 고정 해제' : '항상 위에 고정';
  if (phase === 'capturing') {
    ui.widgetStatus.textContent = liveBusy ? '상품을 분석하고 있어요…' : `화면을 살펴보는 중 · ${found.size}개 상품 발견`;
  } else if (phase === 'analyzing') {
    ui.widgetStatus.textContent = `저장한 장면 분석 중 · ${cursor}/${frames.length}`;
  } else if (phase === 'complete') {
    ui.widgetStatus.textContent = `${found.size}개 상품을 찾았어요. 결과 화면에서 시각별 장면을 확인하세요.`;
  } else if (phase === 'paused') {
    ui.widgetStatus.textContent = '분석이 잠시 멈췄어요. 전체 화면에서 상태를 확인하세요.';
  } else {
    ui.widgetStatus.textContent = '먼저 전체 화면에서 영상 창을 선택하고 캡처를 시작하세요.';
  }
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
  if (captureBusy || !stream || ui.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return currentFrame;
  const elapsed = Date.now() - startedAt;
  if (!force && elapsed - lastSampleAt < sampleInterval) return currentFrame;
  captureBusy = true;
  try {
    const width = ui.video.videoWidth;
    const height = ui.video.videoHeight;
    if (!width || !height) return currentFrame;
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
    currentFrame = { blob, seconds: baseOffsetSeconds + Math.floor(elapsed / 1000) };
    frames.push(currentFrame);
    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = URL.createObjectURL(blob);
    ui.widgetImage.src = currentPreviewUrl;
    ui.widgetImage.hidden = false;
    ui.widgetPreview.querySelector('span').hidden = true;
    lastSampleAt = elapsed;
    refresh();
    return currentFrame;
  } finally { captureBusy = false; }
}

async function startCapture() {
  try {
    baseOffsetSeconds = parseClock(ui.startTime.value);
    await bridge.selectSource(selectedId);
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    ui.video.srcObject = stream;
    await ui.video.play();
    startedAt = Date.now();
    lastSampleAt = -Infinity;
    sampleInterval = 5_000;
    frames = []; cursor = 0; retryAt = 0; found = new Map(); completedFrames = new WeakSet(); currentFrame = null; liveBusy = false;
    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = '';
    ui.widgetImage.hidden = true;
    ui.widgetPreview.querySelector('span').hidden = false;
    ui.filter.value = '';
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
  currentFrame = null;
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

async function cropImage(blob, rect) {
  const bitmap = await createImageBitmap(blob);
  try {
    const x = Math.max(0, Math.floor(rect[0] * bitmap.width));
    const y = Math.max(0, Math.floor(rect[1] * bitmap.height));
    const right = Math.min(bitmap.width, Math.ceil(rect[2] * bitmap.width));
    const bottom = Math.min(bitmap.height, Math.ceil(rect[3] * bitmap.height));
    if (right <= x || bottom <= y) throw new Error('선택 영역이 너무 작아요. 상품을 다시 지정해 주세요.');
    const canvas = document.createElement('canvas');
    canvas.width = right - x; canvas.height = bottom - y;
    canvas.getContext('2d').drawImage(bitmap, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    const crop = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
    if (!crop) throw new Error('선택한 상품 이미지를 만들지 못했어요.');
    return crop;
  } finally { bitmap.close(); }
}

async function recordProducts(result, frame, selectedCrop = null) {
  const products = Array.isArray(result.body?.products) ? result.body.products : [];
  let recognized = 0;
  for (const product of products) {
    const matches = Array.isArray(product.matches) ? product.matches.filter(item => item && typeof item.url === 'string') : [];
    const label = typeof product.label === 'string' ? product.label.trim() : '';
    if (!label || !matches.length) continue;
    recognized++;
    const id = matches.map(item => item.url).sort().join('|');
    const thumb = await thumbnail(selectedCrop || frame.blob, product.box);
    const productValue = found.get(id);
    if (!productValue) {
      found.set(id, { label, matches, seconds: frame.seconds, thumbnail: thumb, sightings: [{ seconds: frame.seconds, frame, thumbnail: thumb }] });
      continue;
    }
    const duplicate = productValue.sightings.find(sighting => sighting.seconds === frame.seconds);
    if (duplicate) {
      if (selectedCrop) {
        URL.revokeObjectURL(duplicate.thumbnail);
        duplicate.thumbnail = thumb;
        productValue.thumbnail = thumb;
      } else URL.revokeObjectURL(thumb);
      continue;
    }
    productValue.sightings.push({ seconds: frame.seconds, frame, thumbnail: thumb });
    productValue.sightings.sort((left, right) => left.seconds - right.seconds);
  }
  return recognized;
}

function productRanges(sightings) {
  const values = [...sightings].sort((left, right) => left.seconds - right.seconds);
  const ranges = [];
  for (const sighting of values) {
    const previous = ranges[ranges.length - 1];
    if (previous && sighting.seconds - previous.end <= 10) previous.end = sighting.seconds;
    else ranges.push({ start: sighting.seconds, end: sighting.seconds });
  }
  return ranges.map(range => range.start === range.end ? clock(range.start) : `${clock(range.start)}–${clock(range.end)}`);
}

function matchingSearch(product) {
  return `${product.label} ${product.matches.map(match => `${match.title || ''} ${match.source || ''}`).join(' ')}`.toLocaleLowerCase();
}

function renderProducts() {
  ui.products.replaceChildren();
  if (!found.size) {
    const empty = document.createElement('p');
    empty.className = 'empty'; empty.textContent = '아직 찾은 상품이 없어요.';
    ui.products.append(empty);
  }
  const query = ui.filter.value.trim().toLocaleLowerCase();
  for (const product of found.values()) {
    const card = document.createElement('article'); card.className = 'product';
    card.hidden = Boolean(query && !matchingSearch(product).includes(query));
    const image = document.createElement('img'); image.src = product.thumbnail; image.alt = product.label;
    const info = document.createElement('div');
    const name = document.createElement('h3'); name.textContent = product.label;
    const ranges = productRanges(product.sightings);
    const time = document.createElement('small'); time.textContent = `확인한 구간: ${ranges.join(' · ')}`;
    const timeline = document.createElement('div'); timeline.className = 'timeline';
    const uniqueTimes = [...new Set(product.sightings.map(item => item.seconds))].sort((a, b) => a - b);
    for (const seconds of uniqueTimes) {
      const point = document.createElement('button'); point.type = 'button'; point.textContent = clock(seconds);
      point.title = '이 시각에 캡처한 장면 크게 보기';
      const sighting = product.sightings.find(item => item.seconds === seconds);
      point.addEventListener('click', () => sighting && showCapturedFrame(sighting.frame));
      timeline.append(point);
    }
    info.append(name, time, timeline);
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
  if (found.size && ![...ui.products.children].some(card => !card.hidden)) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '검색어와 일치하는 상품이 없어요.';
    ui.products.append(empty);
  }
  refresh();
}

async function scanFrame(frame, selectedCrop = null) {
  const imageBytes = new Uint8Array(await frame.blob.arrayBuffer());
  const focusBytes = selectedCrop ? new Uint8Array(await selectedCrop.arrayBuffer()) : undefined;
  const result = await bridge.scan(imageBytes, focusBytes);
  if (result.status !== 200) {
    if ([429, 503].includes(result.status) && ['PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE'].includes(result.body?.code)) {
      retryAt = Date.now() + retrySeconds(result) * 1000;
    }
    throw new Error(result.body?.message || `분석 서버 오류 (HTTP ${result.status})`);
  }
  const recognized = await recordProducts(result, frame, selectedCrop);
  completedFrames.add(frame);
  renderProducts();
  return recognized;
}

async function analyzeCurrentScene() {
  if (liveBusy || phase !== 'capturing') return;
  liveBusy = true; refresh();
  try {
    const frame = await captureFrame(true);
    if (!frame) throw new Error('현재 영상 장면을 가져오지 못했어요.');
    const count = await scanFrame(frame);
    ui.widgetStatus.textContent = count ? `${clock(frame.seconds)} 장면에서 ${count}개 상품을 찾았어요.` : `${clock(frame.seconds)} 장면에서 상품을 찾지 못했어요. 상품을 직접 찍어 다시 시도해 보세요.`;
  } catch (error) {
    ui.widgetStatus.textContent = message(error);
  } finally { liveBusy = false; refresh(); }
}

let focusObjectUrl = '';
let focusFrame = null;
let focusReturnLayout = 'widget';

function syncFocusCanvas() {
  const imageRect = ui.focusImage.getBoundingClientRect();
  const viewportRect = ui.focusViewport.getBoundingClientRect();
  if (!imageRect.width || !imageRect.height) return;
  ui.focusCanvas.width = Math.round(imageRect.width);
  ui.focusCanvas.height = Math.round(imageRect.height);
  ui.focusCanvas.style.width = `${imageRect.width}px`;
  ui.focusCanvas.style.height = `${imageRect.height}px`;
  ui.focusCanvas.style.left = `${imageRect.left - viewportRect.left}px`;
  ui.focusCanvas.style.top = `${imageRect.top - viewportRect.top}px`;
  drawFocusRect();
}

function drawFocusRect() {
  const context = ui.focusCanvas.getContext('2d');
  context.clearRect(0, 0, ui.focusCanvas.width, ui.focusCanvas.height);
  if (!focusRect) return;
  const x = focusRect[0] * ui.focusCanvas.width, y = focusRect[1] * ui.focusCanvas.height;
  const width = (focusRect[2] - focusRect[0]) * ui.focusCanvas.width;
  const height = (focusRect[3] - focusRect[1]) * ui.focusCanvas.height;
  context.fillStyle = 'rgba(89, 231, 187, .18)'; context.fillRect(x, y, width, height);
  context.strokeStyle = '#7be4c5'; context.lineWidth = 2; context.strokeRect(x, y, width, height);
}

async function showFrameInPicker(frame, selectable) {
  focusFrame = frame; focusRect = null;
  ui.submitFocus.disabled = true;
  ui.submitFocus.hidden = !selectable;
  ui.focusHint.textContent = selectable
    ? '상품을 한 번 누르거나 주위를 드래그하세요.'
    : `${clock(frame.seconds)}에 캡처한 장면입니다. 상품을 다시 지정하려면 위젯에서 ‘상품 찍기’를 누르세요.`;
  if (focusObjectUrl) URL.revokeObjectURL(focusObjectUrl);
  focusObjectUrl = URL.createObjectURL(frame.blob);
  ui.focusImage.onload = syncFocusCanvas;
  ui.focusImage.src = focusObjectUrl;
  ui.focusPicker.hidden = false;
  document.body.classList.add('focus-mode');
  await bridge.setWindowLayout('focus');
  requestAnimationFrame(syncFocusCanvas);
}

async function beginFocusPick() {
  if (phase !== 'capturing' || liveBusy) return;
  liveBusy = true; refresh();
  try {
    const frame = await captureFrame(true);
    if (!frame) throw new Error('현재 영상 장면을 가져오지 못했어요.');
    focusReturnLayout = document.body.classList.contains('widget-mode') ? 'widget' : 'dashboard';
    await showFrameInPicker(frame, true);
  } catch (error) {
    ui.widgetStatus.textContent = message(error);
  } finally { liveBusy = false; refresh(); }
}

async function showCapturedFrame(frame) {
  focusReturnLayout = document.body.classList.contains('widget-mode') ? 'widget' : 'dashboard';
  await showFrameInPicker(frame, false);
}

async function closeFocusPicker() {
  ui.focusPicker.hidden = true;
  document.body.classList.remove('focus-mode');
  focusRect = null; focusFrame = null;
  if (focusObjectUrl) URL.revokeObjectURL(focusObjectUrl);
  focusObjectUrl = '';
  await bridge.setWindowLayout(focusReturnLayout);
}

function pointerPosition(event) {
  const rect = ui.focusCanvas.getBoundingClientRect();
  return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
}

function selectFocusArea(rect) {
  let [left, top, right, bottom] = rect;
  if (right - left < .04 || bottom - top < .04) {
    const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
    left = Math.max(0, centerX - .14); right = Math.min(1, centerX + .14);
    top = Math.max(0, centerY - .19); bottom = Math.min(1, centerY + .19);
  }
  focusRect = [left, top, right, bottom];
  ui.submitFocus.disabled = false;
  ui.focusHint.textContent = '선택 영역을 확인하고 상품 분석을 누르세요. 더 정확히 하려면 상품 주위만 드래그하세요.';
  drawFocusRect();
}

async function analyzeSelectedFocus() {
  if (!focusFrame || !focusRect || liveBusy) return;
  const frame = focusFrame;
  const rect = [...focusRect];
  liveBusy = true; ui.submitFocus.disabled = true; refresh();
  try {
    const crop = await cropImage(frame.blob, rect);
    const count = await scanFrame(frame, crop);
    ui.widgetStatus.textContent = count ? `${clock(frame.seconds)}에 선택한 상품 ${count}개를 찾았어요.` : `선택한 영역에서 상품을 찾지 못했어요. 더 넓게 지정해 다시 시도해 보세요.`;
    await closeFocusPicker();
  } catch (error) {
    ui.focusHint.textContent = message(error);
    ui.submitFocus.disabled = false;
  } finally { liveBusy = false; refresh(); }
}

async function analyze() {
  phase = 'analyzing'; refresh();
  while (cursor < frames.length && phase === 'analyzing') {
    const frame = frames[cursor];
    if (completedFrames.has(frame)) { cursor++; refresh(); continue; }
    try { await scanFrame(frame); }
    catch (error) {
      phase = 'paused';
      ui.detail.textContent = `장면 분석을 멈췄어요: ${message(error)}`;
      refresh(); return;
    }
    cursor++;
    refresh();
  }
  phase = 'complete'; refresh();
}

async function reset() {
  for (const product of found.values()) for (const sighting of product.sightings) URL.revokeObjectURL(sighting.thumbnail);
  frames = []; found = new Map(); cursor = 0; retryAt = 0; phase = 'idle'; currentFrame = null;
  completedFrames = new WeakSet();
  if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
  currentPreviewUrl = ''; ui.widgetImage.hidden = true; ui.widgetPreview.querySelector('span').hidden = false;
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
ui.enterWidget.addEventListener('click', async () => {
  ui.widget.hidden = false;
  document.body.classList.add('widget-mode');
  await bridge.setWindowLayout('widget');
});
byId('widget-dashboard').addEventListener('click', async () => {
  document.body.classList.remove('widget-mode');
  ui.widget.hidden = true;
  await bridge.setWindowLayout('dashboard');
});
ui.widgetAnalyze.addEventListener('click', analyzeCurrentScene);
ui.widgetPick.addEventListener('click', beginFocusPick);
ui.widgetStop.addEventListener('click', stopCapture);
ui.widgetPin.addEventListener('click', async () => {
  const result = await bridge.setWindowLayout('pin-toggle');
  widgetPinned = result?.pinned ?? !widgetPinned;
  refresh();
});
byId('widget-setup').addEventListener('click', () => {
  ui.widgetTimeEditor.hidden = !ui.widgetTimeEditor.hidden;
  if (!ui.widgetTimeEditor.hidden) ui.widgetTimeInput.value = clock(currentVideoSecond());
});
byId('apply-widget-time').addEventListener('click', () => {
  try {
    const requested = parseClock(ui.widgetTimeInput.value);
    baseOffsetSeconds = Math.max(-elapsedSeconds(), requested - elapsedSeconds());
    ui.widgetStatus.textContent = `현재 시각을 ${clock(requested)}로 맞췄어요.`;
    refresh();
  } catch (error) { ui.widgetStatus.textContent = message(error); }
});
byId('cancel-focus').addEventListener('click', closeFocusPicker);
ui.submitFocus.addEventListener('click', analyzeSelectedFocus);
ui.focusImage.addEventListener('load', syncFocusCanvas);
ui.focusCanvas.addEventListener('pointerdown', event => {
  if (ui.submitFocus.hidden) return;
  event.preventDefault();
  pointerStart = pointerPosition(event);
  ui.focusCanvas.setPointerCapture(event.pointerId);
});
ui.focusCanvas.addEventListener('pointermove', event => {
  if (!pointerStart) return;
  const point = pointerPosition(event);
  focusRect = [Math.min(pointerStart[0], point[0]), Math.min(pointerStart[1], point[1]),
    Math.max(pointerStart[0], point[0]), Math.max(pointerStart[1], point[1])];
  drawFocusRect();
});
ui.focusCanvas.addEventListener('pointerup', event => {
  if (!pointerStart) return;
  const point = pointerPosition(event);
  selectFocusArea([Math.min(pointerStart[0], point[0]), Math.min(pointerStart[1], point[1]),
    Math.max(pointerStart[0], point[0]), Math.max(pointerStart[1], point[1])]);
  pointerStart = null;
});
ui.focusCanvas.addEventListener('pointercancel', () => { pointerStart = null; });
ui.filter.addEventListener('input', renderProducts);
window.addEventListener('resize', syncFocusCanvas);
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !ui.focusPicker.hidden) closeFocusPicker(); });
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
