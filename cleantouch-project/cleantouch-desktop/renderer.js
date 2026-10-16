const bridge = window.cleanTouch;
function setTheme(dark) {
  document.body.classList.toggle('dark-theme', dark);
  localStorage.setItem('cleantouch-theme', dark ? 'dark' : 'light');
  for (const button of document.querySelectorAll('.theme-toggle')) {
    button.setAttribute('aria-label', dark ? '밝은 테마로 전환' : '어두운 테마로 전환');
    button.title = dark ? '밝은 테마' : '어두운 테마';
  }
}
setTheme(localStorage.getItem('cleantouch-theme') === 'dark');
let videoTime = { available: false };
let videoTimeRequest = 0;
const watchTracker = new watchTime.WatchTimeline();
let aiWorker;
let aiRequest = 0;
const aiPending = new Map();
function classifyProduct(blob) {
  if (!aiWorker) {
    aiWorker = new Worker(new URL('ai-label-worker.js', document.baseURI), { type: 'module' });
    aiWorker.onmessage = ({ data }) => {
      const pending = aiPending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer); aiPending.delete(data.id);
      data.error ? pending.reject(new Error(data.error)) : pending.resolve(data);
    };
    aiWorker.onerror = error => {
      for (const pending of aiPending.values()) { clearTimeout(pending.timer); pending.reject(new Error(error.message || '상품 분류 AI 실행 실패')); }
      aiPending.clear(); aiWorker.terminate(); aiWorker = null;
    };
  }
  const id = ++aiRequest;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      aiPending.delete(id); reject(new Error('상품 분류 AI가 응답하지 않아요. 분석을 다시 시도해 주세요.'));
      for (const pending of aiPending.values()) { clearTimeout(pending.timer); pending.reject(new Error('상품 분류 AI 시간 초과')); }
      aiPending.clear(); aiWorker?.terminate(); aiWorker = null;
    }, 120000);
    aiPending.set(id, { resolve, reject, timer });
    aiWorker.postMessage({ id, blob });
  });
}
async function readVideoTime() {
  const request = ++videoTimeRequest;
  const sourceStream = stream;
  let media;
  try { media = await bridge.getVideoTime(); } catch { media = { available: false }; }
  if (request !== videoTimeRequest || sourceStream !== stream) return videoTime;
  if (stream) videoTime = watchTracker.observe(media.scene?.available ? {
    identity: media.scene.key, title: media.scene.title, position: media.available ? media.seconds : null,
    paused: typeof media.scene.paused === 'boolean' ? media.scene.paused : media.matched ? media.paused : undefined, estimated:media.estimated, authoritative: true,
  } : (media.available || media.matched) ? {
    identity: media.videoKey, title: media.title, position: media.available ? media.seconds : null,
    paused: media.paused, estimated:media.estimated, authoritative: true,
  } : {});
  else videoTime = { available: false };
  const status = document.getElementById('video-time-status');
  if (status) status.textContent = videoTime.available ? `${videoTime.title} · ${videoTime.estimated ? '시청 추정 ' : '재생 '}${clock(videoTime.seconds)}${videoTime.paused ? ' · 일시정지' : ''}` : '화면을 시작하면 영상 전환과 재생 상태를 자동 확인합니다.';
  return videoTime;
}
const byId = id => document.getElementById(id);
const buttonIcon = {
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.1 7.1L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.9L12 2Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>',
  remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-10 4v7m4-7v7M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
};
function addButtonIcon(button, name) {
  const wrapper = document.createElement('span');
  wrapper.className = 'button-icon'; wrapper.innerHTML = buttonIcon[name];
  button.classList.add('with-icon'); button.prepend(wrapper);
}
byId('collection-help').textContent='화면 변화를 확인해 대표 이미지만 보관합니다. 비슷한 화면은 줄이고, 분석할 때 앞뒤 이미지도 함께 확인합니다.';
const ui = {
  serverStatus: byId('server-status'),
  title: byId('phase-title'), detail: byId('phase-detail'), progress: byId('progress'),
  start: byId('start'), stop: byId('stop'), resume: byId('resume'), reset: byId('reset'),
  products: byId('products'), count: byId('product-count'), video: byId('capture-video'),
  filter: byId('product-filter'), enterWidget: byId('enter-widget'),
  widget: byId('widget-panel'), widgetPreview: byId('widget-preview'),
  widgetTime: byId('widget-time'), widgetStatus: byId('widget-status'), widgetAnalyze: byId('widget-analyze'),
  widgetPin: byId('pin-widget'),
  widgetStop: byId('widget-stop'),
  focusPicker: byId('focus-picker'), focusImage: byId('focus-image'),
  focusViewport: byId('focus-viewport'), focusCanvas: byId('focus-canvas'), focusHint: byId('focus-hint'),
  submitFocus: byId('submit-focus'),
  analyzeAll: byId('analyze-all'), collectionStatus: byId('collection-status'),
  currentScreen: byId('current-screen'), widgetAll: byId('widget-all'), scanResume: byId('scan-resume'), widgetScanResume: byId('widget-scan-resume'),
};

let phase = 'idle';
let captureStopping=false;
let captureStopPending=null;
let capturePaused=false,autoAnalysis=false;
let starting = false;
let batchStarting = false;
let reportedBusy;
let serverReady = false;
let stream = null;
let captureEpoch = 0;
let capturePlanRequest = 0;
let capturePlan = null;
let previewAt = 0;
async function updateCapturePlan() {
  if (!stream || !ui.video.videoWidth) return;
  const sourceStream = stream, epoch = captureEpoch, request = ++capturePlanRequest;
  let geometry;
  try { geometry = await bridge.getCaptureGeometry(); } catch { geometry = null; }
  if (sourceStream !== stream || epoch !== captureEpoch || request !== capturePlanRequest) return;
  // Missing geometry must never turn a video-only session into desktop sharing.
  capturePlan = sceneCapture.planCapture(ui.video.videoWidth,ui.video.videoHeight,{...geometry,trackVideo:true});
  return capturePlan;
}
function previewFrame(at) {
  const canvas=document.getElementById('capture-preview');
  const frozen=capturePaused&&!window.cleanTouchLive?.sharing;
  if(stream&&!frozen&&capturePlan?.blocked){
    canvas.hidden=true;const hint=ui.widgetPreview.querySelector('span');hint.hidden=false;hint.textContent=capturePlan.reason;
  }
  if(stream&&!frozen&&capturePlan&&!capturePlan.blocked&&ui.video.readyState>=2&&at-previewAt>=33){
    previewAt=at;canvas.width=480;canvas.height=Math.max(1,Math.round(480*capturePlan.source.height/capturePlan.source.width));
    sceneCapture.drawFrame(canvas.getContext('2d'),ui.video,capturePlan,canvas.width,canvas.height);
    canvas.hidden=false;
    ui.widgetPreview.querySelector('span').hidden=true;
  }
  requestAnimationFrame(previewFrame);
}
requestAnimationFrame(previewFrame);
let captureTimer = null;
let captureBusy = false;
let capturePending = null;
let collectedBytes = 0;
let collectionFull = false;
let collectionError = '';
const COLLECTION_LIMIT = 250 * 1024 * 1024;
let startedAt = 0;
let frames = [];
let cursor = 0;
let retryAt = 0;
let analysisWaitUntil = 0;
let found = new Map();
let completedFrames = new WeakSet();
let currentFrame = null;
let duplicateFrames = 0;
const sceneCollector=new cleanTouchSceneDedup.SceneCollector();
let liveBusy = false;
let focusBlob = null;
let focusRect = null;
let focusPoint = null;
let focusMaskPreview = null;
let focusSelectionImage = null;
let focusExclusionPoints = [], focusAdditionPoints = [], focusCorrectionMode = null;
let interactiveSegmenterPromise = null;
let objectDetectorPromise = null;
let pointerStart = null;
let widgetPinned = true;
let lastNotice = '';

function message(error) { return error instanceof Error ? error.message : String(error); }
function clock(seconds) { return Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}` : '영상 시간 확인 안 됨'; }

function elapsedSeconds() { return startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0; }
function currentVideoSecond() { return videoTime.available ? videoTime.seconds : null; }

function refresh() {
  document.body.classList.toggle('session-active', phase !== 'idle');
  const busy = starting || batchStarting || Boolean(stream) || phase === 'analyzing' || liveBusy;
  if (busy !== reportedBusy) {
    reportedBusy = busy;
    bridge.updateActivity(busy).catch(() => { reportedBusy = undefined; });
  }

  ui.start.hidden = phase !== 'idle';
  ui.start.disabled = starting;
  byId('widget-start').hidden=ui.start.hidden;
  byId('widget-start').disabled=starting;
  ui.analyzeAll.disabled = starting || batchStarting || liveBusy || phase === 'analyzing' || !frames.length || Date.now() < retryAt;
  ui.widgetAll.disabled = ui.analyzeAll.disabled;
  byId('analysis-cancel').hidden=byId('widget-analysis-cancel').hidden=phase!=='analyzing'&&!batchStarting;
  ui.scanResume.hidden = ui.widgetScanResume.hidden = !stream || !capturePaused;
  ui.scanResume.disabled=ui.widgetScanResume.disabled=phase==='analyzing'||batchStarting||captureStopping||collectionFull;
  ui.collectionStatus.textContent = collectionFull
    ? '저장 한도에 도달해 장면 수집을 멈췄어요. 모아둔 장면을 전체 분석해 주세요.'
    : collectionError || `대표 이미지 ${frames.length}장${duplicateFrames ? ` · 비슷한 이미지 ${duplicateFrames}장 제외` : ''}`;
  ui.stop.hidden = !stream;
  ui.stop.disabled = captureStopping || starting || capturePaused;
  ui.resume.hidden = phase !== 'paused';
  ui.resume.disabled = Date.now() < retryAt;
  ui.reset.hidden = phase === 'idle' || phase === 'capturing';
  ui.reset.disabled = liveBusy || batchStarting || phase === 'analyzing';
  ui.count.textContent = String(found.size);
  ui.widgetAnalyze.disabled = phase === 'analyzing' || starting || liveBusy || batchStarting || !currentFrame || Date.now() < retryAt;
  ui.currentScreen.disabled = ui.widgetAnalyze.disabled;
  ui.currentScreen.hidden = ui.widgetAnalyze.hidden = phase === 'idle';
  ui.analyzeAll.closest('details').hidden = ui.widgetAll.closest('details').hidden = !frames.length;
  ui.widgetStop.hidden = !stream || capturePaused;
  ui.widgetStop.disabled = !stream || captureStopping || starting || capturePaused;
  ui.widgetTime.textContent = `${videoTime.estimated ? '≈ ' : ''}${clock(currentVideoSecond())}${videoTime.paused ? ' · 멈춤' : ''}`;
  ui.widgetPin.classList.toggle('unpinned', !widgetPinned);
  ui.widgetPin.title = widgetPinned ? '항상 위에 고정 해제' : '항상 위에 고정';
  if (phase === 'capturing') {
    ui.widgetStatus.textContent = liveBusy ? '상품을 살펴보고 있어요…' : collectionFull ? '장면을 더 모을 수 없어요 · 지나간 상품 찾기를 눌러 결과를 확인하세요.' : collectionError || `화면을 살펴보는 중 · 대표 이미지 ${frames.length}장`;
  } else if (phase === 'analyzing') {
    ui.widgetStatus.textContent = `${stream&&!capturePaused?'스캔 계속 중 · ':'스캔 일시정지 · '}분석 ${cursor}/${frames.length}`;
    if(analysisWaitUntil>Date.now())ui.widgetStatus.textContent=`AI 연결 대기 ${Math.ceil((analysisWaitUntil-Date.now())/1000)}초 · 자동으로 이어집니다`;
  } else if (phase === 'review') {
    ui.widgetStatus.textContent = frames.some(frame => !completedFrames.has(frame))
      ? `수집 일시정지 · ${frames.length}장면을 분석할 수 있어요.`
      : '분석 완료 · 수집 계속하기를 누르면 이어서 모읍니다.';
  } else if (phase === 'complete') {
    ui.widgetStatus.textContent = frames.some(frame => !completedFrames.has(frame))
      ? '지나간 상품 찾기를 눌러 모아둔 장면을 확인하세요.'
      : `${found.size}개 상품을 찾았어요. 결과 화면에서 시각별 장면을 확인하세요.`;
  } else if (phase === 'paused') {
    ui.widgetStatus.textContent = '분석이 멈췄어요. 큰 화면에서 이어서 할 수 있어요.';
  } else {
    ui.widgetStatus.textContent = '시작하면 영상 장면을 모읍니다.';
  }
  if (collectionError && !liveBusy && phase !== 'analyzing') ui.widgetStatus.textContent=collectionError;
  if (lastNotice && !liveBusy && phase !== 'analyzing') ui.widgetStatus.textContent = lastNotice;
  if (phase === 'capturing') {
    ui.title.textContent = '화면을 살펴보고 있어요';
    ui.detail.textContent = '현재 장면에서 상품을 선택하거나, 모은 장면을 모두 분석하세요.';
    ui.progress.textContent = `${clock(Math.floor((Date.now() - startedAt) / 1000))} · 대표 이미지 ${frames.length}장 저장`;
  } else if (phase === 'analyzing') {
    ui.title.textContent = '상품을 찾고 있어요';
    ui.detail.textContent = stream&&!capturePaused ? '새 장면을 계속 모으고 있습니다.' : '수집을 멈추고 모은 장면을 분석하고 있습니다.';
    ui.progress.textContent = `${cursor} / ${frames.length}장면 완료`;
  } else if (phase === 'paused') {
    ui.title.textContent = '분석이 잠시 멈췄어요';
    ui.progress.textContent = `${cursor} / ${frames.length}장면 완료`;
    if (retryAt > Date.now()) ui.progress.textContent += ` · ${Math.ceil((retryAt - Date.now()) / 1000)}초 후 재개 가능`;
  } else if (phase === 'review') {
    ui.title.textContent = capturePaused?'스캔을 일시정지했어요':'모두 분석을 마쳤어요';
    ui.detail.textContent = '결과를 확인한 뒤 수집을 재개할 수 있어요.';
    ui.progress.textContent = `${found.size}개 상품 · ${frames.length}장면`;
  } else if (phase === 'complete') {
    const pending = frames.some(frame => !completedFrames.has(frame));
    ui.title.textContent = pending ? '장면 수집을 마쳤어요' : '분석을 마쳤어요';
    ui.detail.textContent = pending ? '모아둔 장면 전체 분석을 누르면 이전 장면들의 상품을 찾습니다.'
      : found.size ? '상품별 결과와 발견한 시점을 확인하세요.' : '분석한 장면에서 상품을 찾지 못했어요.';
    ui.progress.textContent = `선택한 상품 결과 ${found.size}개`;
  } else {
    ui.title.textContent = '준비됐어요';
    ui.detail.textContent = '시작하면 화면을 살펴보고 상품 장면을 모읍니다.';
    ui.progress.textContent = '';
  }
}

async function checkServer() {
  serverReady = false;
  ui.serverStatus.textContent = '상품 찾기 연결 확인 중…';
  try {
    const [detector] = await Promise.all([getProductObjectDetector(), classifyProduct(null)]);
    serverReady = Boolean(detector);
    ui.serverStatus.textContent = serverReady ? '기기 내 상품 분석 준비 완료' : '상품 분석 모델을 불러오지 못했어요. 앱을 다시 실행해 주세요.';
  } catch {
    ui.serverStatus.textContent = '상품 분석 모델을 불러오지 못했어요. 앱을 다시 실행해 주세요.';
  } finally { refresh(); }
}
async function captureFrame(fresh=false) {
  const sourceStream = stream, epoch = captureEpoch;
  while (capturePending) await capturePending;
  if (!sourceStream || sourceStream !== stream || epoch !== captureEpoch || ui.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return fresh ? null : currentFrame;
  let release;
  capturePending = new Promise(resolve => { release = resolve; });
  const elapsed = Date.now() - startedAt;
  captureBusy = true;
  try {
    const width = ui.video.videoWidth;
    const height = ui.video.videoHeight;
    if (!width || !height) return fresh ? null : currentFrame;
    const timing = await readVideoTime();
    const plan = await updateCapturePlan();
    if (sourceStream !== stream || epoch !== captureEpoch) return null;
    if(!plan || plan.blocked){collectionError=plan?.reason||'영상 위치를 확인하고 있어요. 잠시 후 다시 시도해 주세요.';refresh();return null;}
    collectionError='';
    const scale = Math.min(1, 1920 / Math.max(plan.source.width, plan.source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(plan.source.width * scale));
    canvas.height = Math.max(1, Math.round(plan.source.height * scale));
    sceneCapture.drawFrame(canvas.getContext('2d'),ui.video,plan,canvas.width,canvas.height);
    const recent=!fresh&&!capturePaused&&plan.linked?window.recentScenes?.items.filter(x=>x.key===(timing.videoKey||'unlinked')&&Date.now()-x.at<1000).reduce((best,x)=>!best||x.quality+x.change*.3>best.quality+best.change*.3?x:best,null):null;
    const blob = recent?.blob || await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
    if (sourceStream !== stream || epoch !== captureEpoch) return null;
    if (!blob) throw new Error('화면 이미지를 만들지 못했어요.');
    // A paused video may yield hundreds of identical JPEGs. Keep a fresh still
    // for direct selection, but analyze an unchanged consecutive image once.
    let fingerprint='';
    if(!fresh&&!capturePaused&&crypto.subtle)try{fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');}catch{}
    let visualSignature=null;
    if(!fresh&&!capturePaused&&window.cleanTouchSceneDedup)try{visualSignature=await window.cleanTouchSceneDedup.signature(blob);}catch{}
    if(sourceStream!==stream||epoch!==captureEpoch)return null;
    currentFrame = { blob, videoOnly:plan.linked, id: crypto.randomUUID(), seconds: timing.available ? Math.floor(timing.seconds) : null,
      videoKey: timing.videoKey||plan.scene?.key||'unlinked', videoTitle: timing.title||plan.scene?.title||'', timeEstimated: timing.estimated, capturedAt: recent?recent.at-startedAt:elapsed, fingerprint, visualSignature };
    if(recent&&Number.isFinite(recent.seconds))currentFrame.seconds=Math.floor(recent.seconds);
    if (plan.trackVideo && !plan.linked) {
      collectionError='영상 영역을 확인하는 중이에요. 상품 직접 선택은 사용할 수 있어요.';
    } else if(capturePaused||fresh){
      // Explicit sharing can refresh a still image while collection is paused.
    } else {
      const decision=sceneCollector.decide(currentFrame,frames,{canReplace:phase!=='analyzing'&&!batchStarting,isCompleted:frame=>completedFrames.has(frame)});
      if(decision.action==='duplicate'){
        const retained=frames[decision.index];retained.lastCapturedAt=currentFrame.capturedAt;retained.lastSeenSeconds=currentFrame.seconds;duplicateFrames++;
      }else if(decision.action==='skip'){
        duplicateFrames++;
        const retained=frames.at(-1);
        if(retained&&phase!=='analyzing'&&!batchStarting&&!completedFrames.has(retained)){
          const evidence=cleanTouchSceneDedup.evidenceFor(retained,[...(retained.evidenceFrames||[]),currentFrame]);
          const nextBytes=collectedBytes-cleanTouchSceneDedup.frameBytes(retained)+cleanTouchSceneDedup.frameBytes({...retained,evidenceFrames:evidence});
          if(nextBytes<=COLLECTION_LIMIT){retained.evidenceFrames=evidence;collectedBytes=nextBytes;}
        }
      }
      else {
        const previous=decision.action==='replace'?frames[decision.index]:null;
        currentFrame.evidenceFrames=cleanTouchSceneDedup.evidenceFor(currentFrame,previous?[previous,...(previous.evidenceFrames||[])]:frames.slice(-1).flatMap(f=>[f,...(f.evidenceFrames||[])]));
        const nextBytes=collectedBytes+cleanTouchSceneDedup.frameBytes(currentFrame)-cleanTouchSceneDedup.frameBytes(previous);
        if(nextBytes<=COLLECTION_LIMIT){
          if(previous){currentFrame.segmentStartedAt=previous.segmentStartedAt??previous.capturedAt;frames[decision.index]=currentFrame;}
          else frames.push(currentFrame);
          collectedBytes=nextBytes;
        }else{collectionFull=true;capturePaused=true;phase='review';}
      }
    }
    ui.widgetPreview.querySelector('span').hidden = true;
    refresh();
    return currentFrame;
  } finally { captureBusy = false; capturePending = null; release(); }
}

async function startCapture() {
  if (starting || phase !== 'idle') return;
  if(!await window.cleanTouchPermissions.request('capture'))return;
  if(starting||phase!=='idle')return;
  starting = true; refresh();
  const startEpoch=++captureEpoch;
  capturePlan = null;
  lastNotice = '';
  try {
    const update = await bridge.updateActivity(true);
    if (update.status === 'installing') throw new Error('업데이트 설치 중입니다. 재시작 후 사용해 주세요.');
    if(startEpoch!==captureEpoch)return;
    await bridge.authorizeCapture();
    if(startEpoch!==captureEpoch){bridge.revokeCapture().catch(()=>{});return;}
    const capturedStream=await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 } }, audio: false });
    if(startEpoch!==captureEpoch){capturedStream.getTracks().forEach(track=>track.stop());return;}
    stream=capturedStream;
    ui.video.srcObject = stream;
    ui.video.hidden = true;
    await ui.video.play();
    if(startEpoch!==captureEpoch)return;
    startedAt = Date.now();
    watchTracker.reset();
    window.clearRecentScenes?.();
    collectedBytes = 0; collectionFull = false; collectionError = '';
    frames = []; cursor = 0; retryAt = 0; found = new Map(); completedFrames = new WeakSet(); currentFrame = null; liveBusy = false; duplicateFrames = 0;
    sceneCollector.reset();
    ui.widgetPreview.querySelector('span').hidden = false;
    ui.filter.value = '';
    ui.products.replaceChildren();
    renderWidgetProducts();
    phase = 'capturing';
    // Prepare the tap model while the user watches, before their first selection.
    void getInteractiveSegmenter().catch(()=>{});
    capturePaused=false;autoAnalysis=false;
    ui.widget.hidden = false;
    document.body.classList.add('widget-mode');
    await bridge.setWindowLayout('widget');
    await new Promise(resolve=>setTimeout(resolve,150));
    if(startEpoch!==captureEpoch)return;
    const startedStream=stream;
    stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (stream===startedStream) void stopCapture(true); },{once:true});
    await captureFrame();
    if(startEpoch!==captureEpoch)return;
    captureTimer = setInterval(() => {
      if (stream && !capturePaused && !captureStopping && !collectionFull && !captureBusy) captureFrame().catch(() => {
        collectionError = '장면 저장에 실패했어요. 화면 공유 상태를 확인해 주세요.'; refresh();
      });
    }, 1000);
    ui.widget.hidden = false;
    document.body.classList.add('widget-mode');
    await bridge.setWindowLayout('widget');
    refresh();
  } catch (error) {
    clearInterval(captureTimer);
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    window.cleanTouchPermissions.revoke();bridge.revokeCapture().catch(()=>{});
    ui.video.srcObject = null;
    ui.video.hidden = true;
    phase = 'idle';
    capturePlan = null;
    lastNotice = error?.name==='NotAllowedError' ? '화면을 시작하지 못했어요. 화면 캡처 권한을 확인한 뒤 시작 버튼을 다시 눌러 주세요.' : `화면을 시작하지 못했어요: ${message(error)}`;
  } finally { starting = false; refresh(); if(phase==='idle'&&lastNotice)ui.detail.textContent=lastNotice; bridge.updateActivity(phase === 'capturing' || liveBusy).catch(() => {}); }
}

async function stopCapture(release=false) {
  if (captureStopping) { await captureStopPending; if(release&&stream)await stopCapture(true); return; }
  if (!stream){if(release){captureEpoch++;window.cleanTouchPermissions.revoke();bridge.revokeCapture().catch(()=>{});}return;}
  if (!release&&capturePaused) return;
  let resolveStop;
  captureStopPending = new Promise(resolve=>{resolveStop=resolve;});
  captureStopping=true;refresh();
  try{
  if(release)clearInterval(captureTimer);
  if(!release)try { await captureFrame(true); } catch (error) { ui.detail.textContent = message(error); }
  capturePaused=true;
  if(release){
  captureEpoch++;
  if(window.cleanTouchLive?.sharing)window.cleanTouchLive.stop();
  window.cleanTouchPermissions.revoke();bridge.revokeCapture().catch(()=>{});
  window.clearRecentScenes?.();
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  currentFrame = null;
  capturePlan = null;
  ui.video.srcObject = null;
  ui.video.hidden = true;
  ui.widgetPreview.querySelector('span').hidden = false;
  byId('capture-preview').hidden=true;
  }
  if(phase!=='analyzing'&&phase!=='paused')phase = release?'complete':'review';
  }finally{captureStopping=false;captureStopPending=null;resolveStop();}
  refresh();
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

async function getInteractiveSegmenter() {
  if (!interactiveSegmenterPromise) {
    interactiveSegmenterPromise = (async () => {
      const vision = window.Vision;
      if (!vision?.InteractiveSegmenter) throw new Error('상품 윤곽 모델을 불러오지 못했어요.');
      const wasmPath = new URL('vendor/tasks-vision/wasm/', document.baseURI).href;
      const modelPath = new URL('vendor/tasks-vision/models/interactive_segmentation.task', document.baseURI).href;
      const fileset = await vision.FilesetResolver.forVisionTasks(wasmPath);
      return vision.InteractiveSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
      });
    })().catch(error => { interactiveSegmenterPromise = null; throw error; });
  }
  return interactiveSegmenterPromise;
}

async function getProductObjectDetector() {
  if (!window.Vision?.ObjectDetector) return null;
  if (!objectDetectorPromise) {
    objectDetectorPromise = (async () => {
      const vision = window.Vision;
      const wasmPath = new URL('vendor/tasks-vision/wasm/', document.baseURI).href;
      const modelPath = new URL('vendor/tasks-vision/models/product_detector.tflite', document.baseURI).href;
      const fileset = await vision.FilesetResolver.forVisionTasks(wasmPath);
      return vision.ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
        maxResults: 12,
        scoreThreshold: .3,
      });
    })().catch(error => {
      objectDetectorPromise = null;
      console.warn('Local product detector unavailable; using point segmentation on the full frame.', error);
      return null;
    });
  }
  return objectDetectorPromise;
}

function intersectionOverUnion(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const intersection = width * height;
  const areaA = (a.right - a.left) * (a.bottom - a.top);
  const areaB = (b.right - b.left) * (b.bottom - b.top);
  return intersection / Math.max(1, areaA + areaB - intersection);
}

function selectedObjectRegions(imageCanvas, point, detector) {
  if (!detector) return [];
  const { width, height } = imageCanvas;
  const regions = [{ left: 0, top: 0, right: width, bottom: height }];
  for (const topRatio of [0, .35]) for (const leftRatio of [0, .35]) {
    regions.push({
      left: Math.round(width * leftRatio), top: Math.round(height * topRatio),
      right: Math.min(width, Math.round(width * (leftRatio + .65))),
      bottom: Math.min(height, Math.round(height * (topRatio + .65))),
    });
  }
  const px = point ? point[0] * width : 0, py = point ? point[1] * height : 0;
  const hits = [];
  for (const region of regions) {
    const tile = document.createElement('canvas');
    tile.width = region.right - region.left; tile.height = region.bottom - region.top;
    if (tile.width < 16 || tile.height < 16) continue;
    tile.getContext('2d').drawImage(imageCanvas, region.left, region.top, tile.width, tile.height, 0, 0, tile.width, tile.height);
    const result = detector.detect(tile);
    for (const detection of result.detections || []) {
      const category = (detection.categories || []).slice().sort((a, b) => b.score - a.score)[0];
      const box = detection.boundingBox;
      if (!box || !category || category.score < .3) continue;
      // A browser page often gets reported as a laptop covering the entire
      // detection tile. It is not an independently located product.
      if (!point && ['laptop', 'tv'].includes(category.categoryName) && box.width * box.height > tile.width * tile.height * .9) continue;
      const left = Math.max(0, region.left + box.originX);
      const top = Math.max(0, region.top + box.originY);
      const right = Math.min(width, left + box.width);
      const bottom = Math.min(height, top + box.height);
      if (right <= left || bottom <= top || (point && (px < left || px > right || py < top || py > bottom))) continue;
      if (['person', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'traffic light', 'stop sign', 'fire hydrant', 'parking meter'].includes(category.categoryName)) continue;
      const fullFrame=region.left===0&&region.top===0&&region.right===width&&region.bottom===height;
      const edge=3;
      const clipped=!fullFrame&&((region.left>0&&box.originX<=edge)||(region.top>0&&box.originY<=edge)||(region.right<width&&box.originX+box.width>=tile.width-edge)||(region.bottom<height&&box.originY+box.height>=tile.height-edge));
      hits.push({ left, top, right, bottom, score: category.score, category: category.categoryName || '',fullFrame,clipped });
    }
  }
  const unique = objectRegions.select(hits);
  return point ? unique.slice(0, 3) : unique;
}

function glowingObjectRegions(canvas) {
  const small=document.createElement('canvas'),scale=Math.min(1,800/Math.max(canvas.width,canvas.height));
  small.width=Math.round(canvas.width*scale);small.height=Math.round(canvas.height*scale);
  const ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,small.width,small.height);
  return glowProducts.findGlowRegions(ctx.getImageData(0,0,small.width,small.height).data,small.width,small.height)
    .map(region=>({left:region.left/scale,top:region.top/scale,right:region.right/scale,bottom:region.bottom/scale,glow:true,color:region.color}));
}

function applyGlowColor(classification, region) {
  const colors={purple:'보라색',red:'빨간색',blue:'파란색',green:'초록색'};
  if((classification.category.includes('lightsaber')||/광선검/.test(classification.label)) && colors[region.color]) return {...classification,category:region.color+'-lightsaber',label:colors[region.color]+' 광선검'};
  return classification;
}

async function isolateTappedObject(blob, point, corrections=[], additions=[]) {
  focusMaskPreview = null;
  const source = await createImageBitmap(blob);
  try {
    const imageCanvas = document.createElement('canvas');
    imageCanvas.width = source.width; imageCanvas.height = source.height;
    imageCanvas.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0);
    const detector = await getProductObjectDetector();
    let candidateRegions = [];
    const personExclusions=[];
    const ridge=glowProducts.findPointRidge?.(imageCanvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height).data,source.width,source.height,point);
    if(detector)try{
      for(const detection of detector.detect(imageCanvas).detections||[]){
        if(!detection.categories?.some(category=>category.categoryName==='person'&&category.score>=.5))continue;
        const r=detection.boundingBox;if(!r)continue;
        if(ridge?.points.some(([x,y])=>x<r.originX-4||x>r.originX+r.width+4||y<r.originY-4||y>r.originY+r.height+4))personExclusions.push([r.originX+r.width*.5,r.originY+r.height*.5,true]);
        for(const ratio of [.12,.9])personExclusions.push([r.originX+r.width*.5,r.originY+r.height*ratio]);
        for(const ratio of [.2,.8])personExclusions.push([r.originX+r.width*ratio,r.originY+r.height*.5]);
      }
    }catch{ /* Segmentation also works without person detections. */ }
    try { candidateRegions = selectedObjectRegions(imageCanvas, point, detector); }
    catch (error) { console.warn('Local product detection failed; using point segmentation on the full frame.', error); }
    const glowing = glowingObjectRegions(imageCanvas).filter(region => point[0]*source.width >= region.left && point[0]*source.width <= region.right && point[1]*source.height >= region.top && point[1]*source.height <= region.bottom);
    candidateRegions = [...glowing, ...candidateRegions];
    const detectedRegions = candidateRegions.map(rect => {
      const padding = Math.max(12, Math.round(Math.max(rect.right - rect.left, rect.bottom - rect.top) * .22));
      return {
        left: Math.max(0, Math.floor(rect.left - padding)),
        top: Math.max(0, Math.floor(rect.top - padding)),
        right: Math.min(source.width, Math.ceil(rect.right + padding)),
        bottom: Math.min(source.height, Math.ceil(rect.bottom + padding)),
      };
    });
    detectedRegions.push({ left: 0, top: 0, right: source.width, bottom: source.height });
    const segmenter = await getInteractiveSegmenter();

    for (const region of detectedRegions) {
      const targetCanvas = document.createElement('canvas');
      targetCanvas.width = region.right - region.left;
      targetCanvas.height = region.bottom - region.top;
      if (targetCanvas.width < 16 || targetCanvas.height < 16) continue;
      targetCanvas.getContext('2d', { willReadFrequently: true }).drawImage(
        imageCanvas, region.left, region.top, targetCanvas.width, targetCanvas.height, 0, 0, targetCanvas.width, targetCanvas.height,
      );
      const targetPoint = [
        Math.max(0, Math.min(1, (point[0] * source.width - region.left) / targetCanvas.width)),
        Math.max(0, Math.min(1, (point[1] * source.height - region.top) / targetCanvas.height)),
      ];
      segmenter.setImage(targetCanvas);
      const excludedPoints=[];
      const includedPoints=[];
      for(const [x,y] of ridge?.points||[]){const px=(x-region.left)/targetCanvas.width,py=(y-region.top)/targetCanvas.height;if(px>0&&px<1&&py>0&&py<1)includedPoints.push([px,py]);}
      for(const [x,y] of additions){
        const px=(x*source.width-region.left)/targetCanvas.width,py=(y*source.height-region.top)/targetCanvas.height;
        if(px>0&&px<1&&py>0&&py<1)includedPoints.push([px,py]);
      }
      for(const [x,y] of corrections){
        const px=(x*source.width-region.left)/targetCanvas.width,py=(y*source.height-region.top)/targetCanvas.height;
        if(px>0&&px<1&&py>0&&py<1)excludedPoints.push([px,py]);
      }
      for(const [x,y,forced] of personExclusions){
        const px=(x-region.left)/targetCanvas.width,py=(y-region.top)/targetCanvas.height;
        if(px>0&&px<1&&py>0&&py<1&&(forced||Math.hypot(px-targetPoint[0],py-targetPoint[1])>.25))excludedPoints.push([px,py]);
      }
      const mask = segmenter.segment([{
        // BrushMode is declared in the TS types but not exported by this browser bundle.
        brushMode: 1, // BrushMode.POSITIVE
        point: [{ x: targetPoint[0], y: targetPoint[1] }], isCompleted: true,
      },...includedPoints.map(([x,y])=>({brushMode:1,point:[{x,y}],isCompleted:true})),
      ...excludedPoints.map(([x,y])=>({brushMode:2,point:[{x,y}],isCompleted:true}))]);
      try {
        const values = mask.getAsFloat32Array();
        const maskWidth = mask.width, maskHeight = mask.height;
        if (!values || maskWidth < 1 || maskHeight < 1 || values.length !== maskWidth * maskHeight) continue;
        const maskLength = maskWidth * maskHeight;
        const clickedX = Math.max(0, Math.min(maskWidth - 1, Math.floor(targetPoint[0] * maskWidth)));
        const clickedY = Math.max(0, Math.min(maskHeight - 1, Math.floor(targetPoint[1] * maskHeight)));
        let seed = -1, peak = -Infinity;
        const searchRadius = Math.min(12, Math.ceil(Math.max(maskWidth, maskHeight) * .025));
        for (let y = Math.max(0, clickedY - searchRadius); y <= Math.min(maskHeight - 1, clickedY + searchRadius); y++) {
          for (let x = Math.max(0, clickedX - searchRadius); x <= Math.min(maskWidth - 1, clickedX + searchRadius); x++) {
            const index = y * maskWidth + x;
            if (!Number.isFinite(values[index])) continue;
            const distance = (x - clickedX) ** 2 + (y - clickedY) ** 2;
            const adjusted = values[index] - Math.sqrt(distance) * .001;
            if (adjusted > peak) { peak = adjusted; seed = index; }
          }
        }
        if (seed < 0 || values[seed] < .22) continue;
        const threshold = Math.max(.35, Math.min(.70, values[seed] * .8));
        const component = new Uint8Array(maskLength);
        const queue = new Int32Array(maskLength);
        let head = 0, tail = 0;
        queue[tail++] = seed; component[seed] = 1;
        let left = maskWidth, top = maskHeight, right = -1, bottom = -1;
        while (head < tail) {
          const index = queue[head++], x = index % maskWidth, y = Math.floor(index / maskWidth);
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
          for (let ny = Math.max(0, y - 1); ny <= Math.min(maskHeight - 1, y + 1); ny++) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(maskWidth - 1, x + 1); nx++) {
              const next = ny * maskWidth + nx;
              if (!component[next] && values[next] >= threshold) { component[next] = 1; queue[tail++] = next; }
            }
          }
        }
        const boxRatio = ((right - left + 1) * (bottom - top + 1)) / maskLength;
        if (tail < 48 || boxRatio > .96 || tail / maskLength > .94) continue;

        const selected = component.slice();
        for (let i = 0; i < tail; i++) {
          const index = queue[i], x = index % maskWidth, y = Math.floor(index / maskWidth);
          for (let ny = Math.max(0, y - 1); ny <= Math.min(maskHeight - 1, y + 1); ny++) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(maskWidth - 1, x + 1); nx++) {
              const next = ny * maskWidth + nx;
              if (!selected[next] && values[next] >= threshold * .5) selected[next] = 1;
            }
          }
        }
        left = maskWidth; top = maskHeight; right = -1; bottom = -1;
        for (let y = 0; y < maskHeight; y++) for (let x = 0; x < maskWidth; x++) {
          if (selected[y * maskWidth + x]) {
            left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
        }
        if (right < left || bottom < top) continue;
        // Never substitute a nearby object when the clicked point is outside
        // the chosen mask. Retry the wider region instead.
        if (!selected[clickedY * maskWidth + clickedX]) continue;
        // A mask cut off by a detection crop must be retried with a wider region.
        if((region.left>0&&left<=1)||(region.top>0&&top<=1)||(region.right<source.width&&right>=maskWidth-2)||(region.bottom<source.height&&bottom>=maskHeight-2))continue;

        const localPreview = document.createElement('canvas');
        localPreview.width = maskWidth; localPreview.height = maskHeight;
        const previewContext = localPreview.getContext('2d');
        const previewPixels = previewContext.createImageData(maskWidth, maskHeight);
        for (let y = 0; y < maskHeight; y++) {
          const row = y * maskWidth;
          for (let x = 0; x < maskWidth; x++) {
            const index = row + x;
            if (!selected[index]) continue;
            const boundary = x === 0 || y === 0 || x === maskWidth - 1 || y === maskHeight - 1
              || !selected[index - 1] || !selected[index + 1]
              || !selected[index - maskWidth] || !selected[index + maskWidth];
            const pixel = index * 4;
            previewPixels.data[pixel] = 82; previewPixels.data[pixel + 1] = 239;
            previewPixels.data[pixel + 2] = 190; previewPixels.data[pixel + 3] = boundary ? 245 : 125;
          }
        }
        previewContext.putImageData(previewPixels, 0, 0);
        const fullPreview = document.createElement('canvas');
        fullPreview.width = source.width; fullPreview.height = source.height;
        fullPreview.getContext('2d').drawImage(localPreview, region.left, region.top, targetCanvas.width, targetCanvas.height);
        focusMaskPreview = fullPreview;

        const scaleX = targetCanvas.width / maskWidth, scaleY = targetCanvas.height / maskHeight;
        left = Math.max(0, Math.floor(left * scaleX)); top = Math.max(0, Math.floor(top * scaleY));
        right = Math.min(targetCanvas.width, Math.ceil((right + 1) * scaleX));
        bottom = Math.min(targetCanvas.height, Math.ceil((bottom + 1) * scaleY));
        const margin = Math.max(4, Math.round(Math.max(right - left, bottom - top) * .035));
        left = Math.max(0, left - margin); top = Math.max(0, top - margin);
        right = Math.min(targetCanvas.width, right + margin); bottom = Math.min(targetCanvas.height, bottom + margin);
        const width = right - left, height = bottom - top;
        if (width < 16 || height < 16) { focusMaskPreview = null; continue; }

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width; resultCanvas.height = height;
        const context = resultCanvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(targetCanvas, left, top, width, height, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height);
        const alphaThreshold = threshold * .5;
        for (let y = 0; y < height; y++) {
          const sourceY = top + y;
          const maskY = Math.min(maskHeight - 1, Math.floor((sourceY + .5) / scaleY));
          for (let x = 0; x < width; x++) {
            const sourceX = left + x;
            const maskX = Math.min(maskWidth - 1, Math.floor((sourceX + .5) / scaleX));
            const maskIndex = maskY * maskWidth + maskX;
            const confidence = selected[maskIndex] ? Math.max(0, Math.min(1, values[maskIndex])) : 0;
            const alphaIndex = (y * width + x) * 4 + 3;
            // Mask confidence controls membership, not the object's opacity.
            // Translucent interiors become pale when flattened onto white and
            // can change the colour Gemini/Lens sees.
            pixels.data[alphaIndex] = confidence < alphaThreshold ? 0 : 255;
          }
        }
        context.putImageData(pixels, 0, 0);
        const result = await new Promise(resolve => resultCanvas.toBlob(resolve, 'image/png'));
        if (result) {result.selectionBox=[(region.left+left)/source.width,(region.top+top)/source.height,(region.left+right)/source.width,(region.top+bottom)/source.height];return result;}
      } finally { mask.close(); }
    }
    focusMaskPreview = null;
    return null;
  } finally { source.close(); }
}
let scanGeneration = 0;
async function assessProductImage(blob){
  const bitmap=await createImageBitmap(blob);
  try{
    const canvas=document.createElement('canvas'),scale=Math.min(1,96/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.max(3,Math.round(bitmap.width*scale));canvas.height=Math.max(3,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const quality=candidatePolicy.rasterQuality(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
    return {...quality,score:quality.detail*Math.log2(2+bitmap.width*bitmap.height),width:bitmap.width,height:bitmap.height};
  }finally{bitmap.close();}
}
async function recordProducts(result, frame, selectedCrop = null, operation = scanGeneration) {
  const products = Array.isArray(result.body?.products) ? result.body.products : [];
  let recognized = 0;
  for (const product of products) {
    if (operation !== scanGeneration) return 0;
    const label = typeof product.label === 'string' ? product.label.trim() : '';
    product.label=label;
    const matches = productIdentity.shoppingMatches(Array.isArray(product.matches) ? product.matches.filter(item => item && typeof item.url === 'string') : [], label);
    if (!label || (!matches.length && !result.body?.local)) continue;
    recognized++;
    const videoKey = frame.videoKey || 'unlinked';
    const possible=[...found.entries()].filter(([,value])=>value.videoKey===videoKey);
    const similarityOf=value=>product.embedding?Math.max(0,...(value.embeddings||[value.embedding]).filter(Boolean).map(e=>productAI.cosine(e,product.embedding))):0;
    let similar=possible.filter(([,value])=>{
      const sameSighting=value.sightings.find(s=>s.frame===frame),sameFrame=!!sameSighting;
      const reference={...value,box:sameSighting?.box||value.lastBox||value.box},similarity=similarityOf(value);
      return candidatePolicy.duplicate(reference,product,similarity,sameFrame)||candidatePolicy.trackDuplicate(reference,product,similarity,frame.capturedAt-value.lastCapturedAt,sameFrame);
    }).sort((a,b)=>similarityOf(b[1])-similarityOf(a[1]))[0];
    const id = similar ? similar[0] : `${videoKey}:${productIdentity.identityKey(label)}:${crypto.randomUUID()}`;
    let imageBlob = product.imageBlob || selectedCrop || frame.blob;
    if (!product.imageBlob && Array.isArray(product.box) && product.box.length === 4) {
      try { imageBlob = await cropImage(imageBlob, product.box); } catch { /* Keep the original image when no valid box is returned. */ }
    }
    const imageQuality=await assessProductImage(imageBlob);
    imageQuality.score=candidatePolicy.representativeScore(imageQuality,product.wholeProduct);
    if (operation !== scanGeneration) return 0;
    const thumb = URL.createObjectURL(imageBlob);
    const productValue = found.get(id);
    if (!productValue) {
      found.set(id, { label, matches, imageBlob,imageQuality,sourceFrame:frame,embeddings:product.embedding?[product.embedding]:[], embedding: product.embedding, box:product.box,lastBox:product.box,lastCapturedAt:frame.capturedAt,verified:product.verified, uncertain: product.uncertain, alternatives: product.alternatives, videoKey, videoTitle: frame.videoTitle,
        seconds: frame.seconds, thumbnail: thumb, sightings: [{ seconds: frame.seconds, frame, thumbnail: thumb,box:product.box }] });
      continue;
    }
    const duplicate = productValue.sightings.find(sighting => sighting.frame === frame);
    if(product.embedding){productValue.embeddings||=[productValue.embedding];productValue.embeddings.push(product.embedding);if(productValue.embeddings.length>8)productValue.embeddings.splice(1,1);}
    const betterImage=selectedCrop||imageQuality.score>(productValue.imageQuality?.score||0)*1.1;
    const mergedLabel=candidatePolicy.reconcileLabel(productValue.label,label);
    if(mergedLabel!==productValue.label){productValue.label=mergedLabel;productValue.uncertain=true;productValue.matches=productIdentity.shoppingMatches(productValue.matches,mergedLabel);}
    if(/^(광선검)( 장난감)?$/.test(productValue.label)&&!/^(광선검)( 장난감)?$/.test(label)){productValue.label=label;productValue.uncertain=product.uncertain;}
    if (duplicate) {
      if (betterImage) {
        URL.revokeObjectURL(duplicate.thumbnail);
        duplicate.thumbnail = thumb;
        duplicate.box=product.box;
        productValue.thumbnail = thumb;
        productValue.imageBlob = imageBlob;
        productValue.sourceFrame = frame;
        productValue.box = product.box;
        productValue.embedding = product.embedding;
        productValue.imageQuality=imageQuality;
      } else URL.revokeObjectURL(thumb);
      continue;
    }
    productValue.lastBox=product.box;
    productValue.lastCapturedAt=frame.capturedAt;
    if(betterImage){productValue.thumbnail=thumb;productValue.imageBlob=imageBlob;productValue.imageQuality=imageQuality;productValue.sourceFrame=frame;productValue.box=product.box;productValue.embedding=product.embedding;}
    productValue.verified||=product.verified;
    productValue.sightings.push({ seconds: frame.seconds, frame, thumbnail: thumb,box:product.box });
    productValue.sightings.sort((left, right) => left.seconds - right.seconds);
  }
  return recognized;
}

function productRanges(sightings) {
  const values = sightings.filter(sighting => Number.isFinite(sighting.seconds)).sort((left, right) => left.seconds - right.seconds);
  if (!values.length) return ['영상 시간 확인 안 됨'];
  const ranges = [];
  for (const sighting of values) {
    const previous = ranges[ranges.length - 1];
    if (previous && sighting.seconds - previous.end <= 10) previous.end = sighting.seconds;
    else ranges.push({ start: sighting.seconds, end: sighting.seconds });
  }
  const result = ranges.map(range => range.start === range.end ? clock(range.start) : `${clock(range.start)}–${clock(range.end)}`);
  if (values.length !== sightings.length) result.push('시간 미확인 장면 있음');
  return result;
}

function matchingSearch(product) {
  return `${product.label} ${product.matches.map(match => `${match.title || ''} ${match.source || ''}`).join(' ')}`.toLocaleLowerCase();
}

async function identifyRecordedProduct(product){
  const frame=product.sourceFrame||product.sightings?.find(s=>s.thumbnail===product.thumbnail)?.frame;
  try{const evidence=await buildSelectedProductEvidence(frame,product.box);await window.cleanTouchPlaceChat.identify(product.imageBlob,product.label,false,evidence);}
  catch(error){ui.widgetStatus.textContent=message(error);ui.detail.textContent=message(error);}
}
function renderWidgetProducts(){
 const list=byId('widget-product-list');if(!list)return;list.replaceChildren();byId('widget-result-count').textContent=String(found.size);
 for(const product of [...found.values()].reverse()){
  const row=document.createElement('div');row.className='widget-product';const image=document.createElement('img');image.src=product.thumbnail;image.alt=product.label;
  const info=document.createElement('div'),name=document.createElement('strong');name.textContent=product.label;
  const ai=document.createElement('button');ai.className='product-ai';ai.textContent='같은 상품 찾기';ai.onclick=()=>identifyRecordedProduct(product);image.onclick=ai.onclick;
  const lens=document.createElement('button');lens.className='product-lens';lens.textContent='Lens';lens.onclick=async()=>{try{await bridge.searchVisual(new Uint8Array(await product.imageBlob.arrayBuffer()));}catch(error){ui.widgetStatus.textContent=message(error);}};
  const time=document.createElement('small');time.textContent=productRanges(product.sightings||[]).join(' · ')+(product.uncertain?' · 확인 필요':'');
  const scene=document.createElement('button');scene.textContent='장면';scene.title='원본 장면에서 확인';scene.disabled=!product.sightings?.[0]?.frame;scene.onclick=()=>showCapturedFrame(product.sightings[0].frame);
  const remove=document.createElement('button');remove.className='product-remove';remove.textContent='제외';remove.title='잘못 인식된 결과를 목록에서 제외';remove.onclick=()=>removeProduct(product);
  addButtonIcon(ai,'sparkle');addButtonIcon(lens,'search');addButtonIcon(remove,'remove');
  const extra=document.createElement('details');extra.className='simple-options product-options';const summary=document.createElement('summary');summary.textContent='다른 검색 · 목록 관리';extra.append(summary,lens,scene,remove);info.append(name,time,ai,extra);row.append(image,info);list.append(row);
 }
 if(!found.size)list.textContent='상품을 찾으면 여기에 나타납니다.';
}
function removeProduct(product){
  for(const [key,value] of found)if(value===product)found.delete(key);
  for(const sighting of product.sightings||[])URL.revokeObjectURL(sighting.thumbnail);
  renderProducts();refresh();
}
function renderProducts() {
  renderWidgetProducts();
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
    const time = document.createElement('small'); time.textContent = `영상 등장 시점: ${ranges.join(' · ')}${product.videoTitle ? ' · ' + product.videoTitle : ''}${product.sightings.some(s => s.frame.timeEstimated) ? ' · 시청 추정 시간 포함' : ''}`;
    const timeline = document.createElement('div'); timeline.className = 'timeline';
    const displayedTimes = new Set();
    for (const sighting of product.sightings) {
      const seconds = sighting.seconds;
      if (Number.isFinite(seconds) && displayedTimes.has(seconds)) continue;
      if (Number.isFinite(seconds)) displayedTimes.add(seconds);
      const point = document.createElement('button'); point.type = 'button'; point.textContent = Number.isFinite(seconds) ? clock(seconds) : '저장 장면 보기';
      point.title = '이 시각에 캡처한 장면 크게 보기';
      point.addEventListener('click', () => sighting && showCapturedFrame(sighting.frame));
      timeline.append(point);
    }
    info.append(name, time, timeline);
    if(product.groupedByAppearance){const groupNote=document.createElement('small');groupNote.textContent='같은 색·종류의 상품 후보 묶음';info.append(groupNote);}
    if (product.uncertain) {
      const uncertainty = document.createElement('small');
      uncertainty.textContent = product.label === '종류 미확인' ? '사진을 눌러 비슷한 상품 찾기' : 'AI 추정';
      info.append(uncertainty);
    }
    const visual = document.createElement('button');
    visual.type = 'button'; visual.className='product-lens'; visual.textContent = 'Google 이미지로 찾기';
    addButtonIcon(visual,'search');
    visual.addEventListener('click', async () => {
      try {
        const crop = await product.imageBlob.arrayBuffer();
        await bridge.searchVisual(new Uint8Array(crop));
        ui.detail.textContent = '선택한 상품 사진을 Google Lens에 전달했어요. 열린 창에서 비슷한 이미지 결과를 확인하세요.';
      } catch (error) { ui.detail.textContent = `Google Google 이미지로 찾기을 시작하지 못했어요: ${message(error)}`; }
    });
    const ai=document.createElement('button');ai.type='button';ai.className='product-ai';ai.textContent='같은 상품 찾기';
    addButtonIcon(ai,'sparkle');
    ai.addEventListener('click',()=>identifyRecordedProduct(product));
    image.addEventListener('click', () => ai.click());
    image.title = '이 상품 알아보기'; image.style.cursor = 'pointer';
    const remove=document.createElement('button');remove.type='button';remove.className='product-remove';remove.textContent='잘못된 결과 제외';remove.addEventListener('click',()=>removeProduct(product));
    addButtonIcon(remove,'remove');
    const extra=document.createElement('details');extra.className='simple-options product-options';const summary=document.createElement('summary');summary.textContent='다른 검색 · 목록 관리';extra.append(summary,visual,remove);info.append(ai,extra);
    for (const match of product.matches.slice(0, 4)) {
      const link = document.createElement('button');
      const kind = match.matchKind === 'exact_image' ? '같은 이미지' : match.matchKind === 'partial_image' ? '비슷한 이미지' : '문자로 검색';
      link.type = 'button'; link.textContent = `${match.source || '웹'} · ${kind} ↗`;
      link.addEventListener('click', () => bridge.openLink(match.url).catch(error => { ui.detail.textContent = message(error); }));
      extra.append(link);
    }
    card.append(image, info); ui.products.append(card);
  }
  if (found.size && ![...ui.products.children].some(card => !card.hidden)) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '검색어와 일치하는 상품이 없어요.';
    ui.products.append(empty);
  }
  refresh();
}

let precisionChecks=0,lastPrecisionCheck=0,precisionBackoff=0,precisionOmitted=0,precisionWindowAt=Date.now();
function precisionAvailable(){if(Date.now()-precisionWindowAt>=60000){precisionChecks=0;precisionWindowAt=Date.now();}return precisionChecks<8&&Date.now()>=precisionBackoff;}
const precisionCache=[];
const wholeObjectCache=[];
const analyzedSceneCache=[];
const temporalGlowCache=new WeakMap();
const temporalProductCache=new WeakMap();
function adjacentSceneFrames(frame){
  const nearby=[...frames,...(frame.evidenceFrames||[])].filter(f=>f!==frame&&f.videoKey===frame.videoKey&&Number.isFinite(f.capturedAt)&&Math.abs(f.capturedAt-frame.capturedAt)<=2200);
  const before=nearby.filter(f=>f.capturedAt<frame.capturedAt).sort((a,b)=>b.capturedAt-a.capturedAt)[0];
  const after=nearby.filter(f=>f.capturedAt>frame.capturedAt).sort((a,b)=>a.capturedAt-b.capturedAt)[0];
  return [before,frame,after].filter(Boolean);
}
async function temporalSceneEvidence(frame){
  // Retain the target itself when equal bytes occur in an earlier paused frame.
  const candidates=[frame,...adjacentSceneFrames(frame).filter(f=>f!==frame)],unique=[],digests=new Set();
  for(const f of candidates){
    const digest=f.sceneDigest||Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await f.blob.arrayBuffer())),n=>n.toString(16).padStart(2,'0')).join('');
    f.sceneDigest=digest;if(digests.has(digest))continue;digests.add(digest);unique.push(f);
  }
  return unique.sort((a,b)=>a.capturedAt-b.capturedAt);
}
async function hasTemporalGlowEvidence(frame,region,width,height){
  if(!region.color)return false;
  const scenes=await temporalSceneEvidence(frame);if(scenes.length<2)return false;
  for(const f of scenes){
    if(f===frame)continue;
    let evidence=temporalGlowCache.get(f);
    if(!evidence){const bitmap=await createImageBitmap(f.blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();evidence={regions:glowingObjectRegions(canvas),width:canvas.width,height:canvas.height};temporalGlowCache.set(f,evidence);}
    const cx=(region.left+region.right)/2/width,cy=(region.top+region.bottom)/2/height;
    if(evidence.regions.some(r=>r.color===region.color&&Math.hypot((r.left+r.right)/2/evidence.width-cx,(r.top+r.bottom)/2/evidence.height-cy)<.4))return true;
  }
  return false;
}
async function hasTemporalProductEvidence(frame,box,classification){
  if(classification.category==='unknown')return false;
  const scenes=await temporalSceneEvidence(frame);if(scenes.length<2)return false;
  for(const neighbour of scenes){
    if(neighbour===frame)continue;
    let cache=temporalProductCache.get(neighbour);if(!cache){cache=new Map();temporalProductCache.set(neighbour,cache);}
    const key=box.map(n=>n.toFixed(3)).join(':');let evidence=cache.get(key);
    if(!evidence){
      const crop=await cropImage(neighbour.blob,box);
      if(!candidatePolicy.usableRaster(await assessProductImage(crop)))continue;
      evidence=await classifyProduct(crop);cache.set(key,evidence);if(cache.size>8)cache.delete(cache.keys().next().value);
    }
    if(!evidence.uncertain&&candidatePolicy.agrees(classification,evidence)&&productAI.cosine(classification.embedding,evidence.embedding)>=.82)return true;
  }
  return false;
}
async function encodeTemporalScene(blob){return cleanTouchImage.encode(blob);}
async function confirmCandidate(crop,classification,frame,operation){
  const cached=precisionCache.find(item=>item.videoKey===frame.videoKey&&productAI.cosine(item.embedding,classification.embedding)>.985);
  if(cached)return cached.data;
  if(!precisionAvailable())return null;
  const wait=Math.max(0,lastPrecisionCheck+6500-Date.now());
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  if(operation!==scanGeneration)return null;
  precisionChecks++;lastPrecisionCheck=Date.now();ui.detail.textContent='상품 후보를 AI로 재확인하고 있어요. 후보 사진만 전송합니다.';
  try{
    const bitmap=await createImageBitmap(crop);const c=document.createElement('canvas');const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);const context=c.getContext('2d');context.fillStyle='white';context.fillRect(0,0,c.width,c.height);context.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
    const data=await bridge.identifyProduct(c.toDataURL('image/jpeg',.9).split(',')[1],'','scan:'+operation);
    if(operation!==scanGeneration)return null;
    // A crop alone cannot establish a light-emitting object's state or colour.
    const confirmed=!/광선검/.test(data.label)&&data.confidence==='high'&&data.query&&candidatePolicy.productLabel(data.label)?{...classification,label:data.label,uncertain:false,verified:true,reason:data.reason}:null;
    precisionCache.push({videoKey:frame.videoKey,embedding:classification.embedding,data:confirmed});if(precisionCache.length>64)precisionCache.shift();return confirmed;
  }catch{if(operation===scanGeneration)precisionBackoff=Date.now()+60000;return null;}
}
async function locateSceneProducts(blob,frame,operation){
  frame.analysisDeferred=false;
  if(!frame.videoOnly)return [];
  if(!precisionAvailable()){frame.analysisDeferred=true;return [];}
  const wait=Math.max(0,lastPrecisionCheck+6500-Date.now());if(wait)await new Promise(r=>setTimeout(r,wait));
  if(operation!==scanGeneration)return [];
  precisionChecks++;lastPrecisionCheck=Date.now();ui.detail.textContent='영상 속 상품의 전체 위치를 AI로 확인하고 있어요…';
  try{
    const bitmap=await createImageBitmap(blob),c=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
    const encoded=await cleanTouchImage.encode(blob);
    const evidence=await temporalSceneEvidence(frame);
    const images=evidence.length>=2?await Promise.all(evidence.filter(f=>f!==frame).map(f=>encodeTemporalScene(f.blob))):undefined;
    const data=await bridge.placeChat({_requestGroup:'scan:'+operation,task:'objects',image:encoded,images,messages:[{role:'user',text:'대상 장면의 상품을 앞뒤 장면과 비교해 상태 변화를 검증하고 위치를 분석해줘.'}]});
    if(operation!==scanGeneration)return [];
    const products=[];
    for(const object of data.products||[]){
      if(!candidatePolicy.productLabel(object.label)||!Array.isArray(object.box)||object.box.length!==4||!object.box.every(n=>Number.isFinite(n)&&n>=0&&n<=1))continue;
      if(!object.temporalVerified){precisionOmitted++;continue;}
      const box=object.box,width=(box[2]-box[0])*c.width,height=(box[3]-box[1])*c.height;
      if(!candidatePolicy.quality(width,height,32)&&!(/광선검/.test(object.label)&&Math.min(width,height)>=6&&Math.max(width,height)>=64))continue;
      let crop=await cropImage(blob,box),classification;
      try{classification=await classifyProduct(crop);}catch{classification={category:'unknown',uncertain:true};}
      const cropQuality=await assessProductImage(crop);
      if(!/광선검/.test(object.label)&&!candidatePolicy.usableRaster(cropQuality)){precisionOmitted++;continue;}
      // Tiny automatic crops cannot substantiate a product even when the
      // language model sounds certain. The original scene remains selectable.
      if(!/광선검/.test(object.label)&&(Math.min(cropQuality.width,cropQuality.height)<48||cropQuality.detail<4)){precisionOmitted++;continue;}
      if(operation!==scanGeneration)return [];
      if(/가방|백팩/.test(object.label)){
        const oldPreview=focusMaskPreview;
        try{const isolated=await isolateTappedObject(blob,[(box[0]+box[2])/2,(box[1]+box[3])/2]);
          if(isolated){const [before,after]=await Promise.all([createImageBitmap(crop),createImageBitmap(isolated)]);const whole=after.width>=before.width*.5&&after.height>=before.height*.5&&after.width<=before.width*1.4&&after.height<=before.height*1.4;before.close();after.close();
            if(whole){const label=await classifyProduct(isolated);if(candidatePolicy.targetMatches(object.label,label.label)){crop=isolated;classification=label;}}}
        }catch{/* Retain the AI-located whole product crop. */}finally{focusMaskPreview=oldPreview;}
      }
      if(operation!==scanGeneration)return [];
      // A model can name a nearby prop while placing its box on a face or car.
      // Verify the contents of the returned crop before exposing it as a product.
      if(candidatePolicy.conflictsWithTarget(object.label,classification))continue;
      products.push({...classification,label:object.label,box,imageBlob:crop,wholeProduct:true,verified:true,uncertain:object.confidence!=='high',matches:[]});
    }
    return products;
  }catch{if(operation!==scanGeneration)return [];frame.analysisDeferred=true;precisionBackoff=Date.now()+60000;lastNotice='AI 연결이 지연되어 확인한 상품을 먼저 표시합니다. 잠시 후 이어서 분석해 주세요.';return [];}
}
async function scanFrame(frame, selectedCrop = null) {
  const operation = scanGeneration;
  const bytes=await (selectedCrop||frame.blob).arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(operation!==scanGeneration)return 0;
  const temporalSignature=selectedCrop?'selection':(await temporalSceneEvidence(frame)).map(f=>f.sceneDigest).join(':');
  const cached=analyzedSceneCache.find(item=>item.digest===digest&&item.videoKey===frame.videoKey&&item.temporalSignature===temporalSignature);
  if(cached){const count=await recordProducts(cached.result,frame,selectedCrop,operation);if(operation!==scanGeneration)return 0;if(!selectedCrop)completedFrames.add(frame);renderProducts();return count;}
  const image = await createImageBitmap(selectedCrop || frame.blob);
  let result;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const products = await locateSceneProducts(selectedCrop||frame.blob,frame,operation);
    if(operation!==scanGeneration)return 0;
    let detector;
    try{detector=await getProductObjectDetector();}catch{lastNotice='기기 내 모델을 사용할 수 없어 AI가 확인한 상품만 표시합니다.';}
    const regions = [...(detector?selectedObjectRegions(canvas,null,detector):[]),...glowingObjectRegions(canvas)].sort((a,b)=>(b.glow ? .8 : b.score||0)-(a.glow ? .8 : a.score||0)).slice(0,8);
    let frameChecks=0;
    const wholeObjects=[];
    for (const region of regions) {
      if(operation!==scanGeneration)return 0;
      const regionBox=[region.left/image.width,region.top/image.height,region.right/image.width,region.bottom/image.height];
      if(products.some(p=>{if(region.glow){const colour={red:'빨간색',green:'초록색',blue:'파란색',purple:'보라색'}[region.color];if(!/광선검/.test(p.label)||(colour&&candidatePolicy.colourGroup(p.label)!==candidatePolicy.colourGroup(colour+' 광선검')))return false;}const b=p.box;const overlap=Math.max(0,Math.min(b[2],regionBox[2])-Math.max(b[0],regionBox[0]))*Math.max(0,Math.min(b[3],regionBox[3])-Math.max(b[1],regionBox[1]));const small=Math.min((b[2]-b[0])*(b[3]-b[1]),(regionBox[2]-regionBox[0])*(regionBox[3]-regionBox[1]));return small>0&&overlap/small>.6;}))continue;
      if(!candidatePolicy.quality(region.right-region.left,region.bottom-region.top,region.glow?32:48))continue;
      const box = [region.left / image.width, region.top / image.height, region.right / image.width, region.bottom / image.height];
      let crop = await cropImage(selectedCrop || frame.blob, box);
      let classification;
      try{classification=applyGlowColor(await classifyProduct(crop), region);}catch{precisionOmitted++;continue;}
      let wholeImage=null;
      if(['handbag','backpack','suitcase'].includes(region.category)){
        const existing=wholeObjects.find(item=>objectRegions.sameObject(item.region,region));
        if(existing)continue;
        const previousPreview=focusMaskPreview;
        try{
          const previous=wholeObjectCache.find(item=>item.videoKey===frame.videoKey&&productAI.cosine(item.embedding,classification.embedding)>.995);
          const isolated=previous?.image||await isolateTappedObject(selectedCrop||frame.blob,[(box[0]+box[2])/2,box[1]+(box[3]-box[1])*.8]);
          if(operation!==scanGeneration)return 0;
          if(isolated){
            const wholeClass=previous?.classification||await classifyProduct(isolated);
            if(candidatePolicy.family(wholeClass.category)==='bag'){
              if(!previous){wholeObjectCache.push({videoKey:frame.videoKey,embedding:classification.embedding,image:isolated,classification:wholeClass});if(wholeObjectCache.length>16)wholeObjectCache.shift();}
              crop=isolated;classification=wholeClass;wholeImage=isolated;wholeObjects.push({region});
            }
          }
        }catch(error){console.warn('Whole product refinement unavailable',error);}
        finally{focusMaskPreview=previousPreview;}
      }
      if(classification.category==='unknown'&&(region.glow||region.score<.5))continue;
      const padX=Math.max((box[2]-box[0])*.35,32/image.width),padY=Math.max((box[3]-box[1])*.35,32/image.height);
      const contextBox=[Math.max(0,box[0]-padX),Math.max(0,box[1]-padY),Math.min(1,box[2]+padX),Math.min(1,box[3]+padY)];
      const contextCrop=await cropImage(selectedCrop||frame.blob,contextBox);
      const contextClass=applyGlowColor(await classifyProduct(contextCrop),region);
      const disagreement=!candidatePolicy.agrees(classification,contextClass)||classification.category!==contextClass.category||(!region.glow&&region.score<.5);
      const clearGlow=region.glow&&region.color&&!classification.uncertain&&classification.category.includes('lightsaber')&&await hasTemporalGlowEvidence(frame,region,image.width,image.height);
      if(region.glow&&!clearGlow){precisionOmitted++;continue;}
      if(!region.glow&&!selectedCrop&&!await hasTemporalProductEvidence(frame,box,classification)){precisionOmitted++;continue;}
      if(!clearGlow&&(!classification.verified||classification.uncertain||contextClass.uncertain||disagreement)){
        if(!candidatePolicy.usableRaster(await assessProductImage(crop))){precisionOmitted++;continue;}
        if(frameChecks>=4){precisionOmitted++;continue;}frameChecks++;
        classification=await confirmCandidate(crop,classification,frame,operation);if(!classification){precisionOmitted++;continue;}
      }
      if (!classification.verified && classification.uncertain && ['keyboard','mouse'].includes(classification.category)) continue;
      if (region.glow && !classification.verified && (classification.uncertain || (!classification.category.includes('lightsaber') && classification.category !== 'toy-sword'))) continue;
      // Keep the handle-side context rather than sending only a glowing shaft to Lens.
      products.push({ ...applyGlowColor(classification,region), box:clearGlow?contextBox:box, imageBlob:wholeImage||(clearGlow?contextCrop:null), matches: [] });
    }
    result = { status: 200, body: { local: true, products } };
  } finally { image.close(); }
  if (operation !== scanGeneration) return 0;
  if(!frame.analysisDeferred){analyzedSceneCache.push({digest,temporalSignature,videoKey:frame.videoKey,result});if(analyzedSceneCache.length>16)analyzedSceneCache.shift();}
  const recognized = await recordProducts(result, frame, selectedCrop, operation);
  if (operation !== scanGeneration) return 0;
  // A crop only covers one item, so the complete scene still needs a full scan.
  if (!selectedCrop&&!frame.analysisDeferred) completedFrames.add(frame);
  renderProducts();
  return recognized;
}

async function analyzeCurrentScene() {
  if (liveBusy || phase !== 'capturing') return;
  lastNotice = ''; liveBusy = true; refresh();
  try {
    const frame = await captureFrame(true);
    if (!frame) throw new Error('현재 영상 장면을 가져오지 못했어요.');
    const count = await scanFrame(frame);
    lastNotice = count ? `현재 화면에서 ${count}개 상품 발견 · 결과 보기에서 확인하세요.` : '상품을 찾지 못했어요. 상품 영역 선택으로 다시 시도해 보세요.';
  } catch (error) {
    lastNotice = message(error);
  } finally { liveBusy = false; refresh(); }
}

let focusObjectUrl = '';
let focusFrame = null;
let focusReturnLayout = 'widget';
let focusChatProduct = false;
let focusGeneration = 0;

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
  if (focusPoint && focusMaskPreview) context.drawImage(focusMaskPreview, 0, 0, ui.focusCanvas.width, ui.focusCanvas.height);
  else if (focusRect && !focusPoint) {
    const x = focusRect[0] * ui.focusCanvas.width, y = focusRect[1] * ui.focusCanvas.height;
    const width = (focusRect[2] - focusRect[0]) * ui.focusCanvas.width;
    const height = (focusRect[3] - focusRect[1]) * ui.focusCanvas.height;
    context.fillStyle = 'rgba(89, 231, 187, .18)'; context.fillRect(x, y, width, height);
    context.strokeStyle = '#7be4c5'; context.lineWidth = 2; context.strokeRect(x, y, width, height);
  }
}

async function showFrameInPicker(frame, selectable) {
  focusExclusionPoints=[];focusAdditionPoints=[];focusCorrectionMode=null;
  byId('include-focus').disabled=true;byId('refine-focus').disabled=true;
  byId('include-focus').classList.remove('selected');byId('refine-focus').classList.remove('selected');
  focusFrame = frame; focusRect = null; focusPoint = null; focusMaskPreview = null; focusSelectionImage = null;
  ui.submitFocus.disabled = true;
  ui.submitFocus.textContent = '이 상품 알아보기';
  ui.submitFocus.hidden = !selectable;
  ui.focusHint.textContent = selectable
    ? '상품을 한 번 누르거나 주위를 드래그하세요.'
    : `${clock(frame.seconds)}에 캡처한 장면입니다. 다른 상품은 위젯에서 다시 선택하세요.`;
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
  if (phase === 'analyzing' || starting || batchStarting || liveBusy || !currentFrame) return;
  liveBusy = true; refresh();
  try {
    const frame = stream ? await captureFrame(true) : currentFrame;
    if(stream&&capturePlan?.blocked)throw new Error(capturePlan.reason||'영상이 가려져 있어요. 영상을 화면에 띄운 후 다시 선택해 주세요.');
    if (!frame) throw new Error('현재 영상 장면을 가져오지 못했어요.');
    focusReturnLayout = document.body.classList.contains('widget-mode') ? 'widget' : 'dashboard';
    await showFrameInPicker(frame, true);
  } catch (error) {
    lastNotice=message(error);
    ui.widgetStatus.textContent = message(error);
  } finally { liveBusy = false; refresh(); }
}

async function showCapturedFrame(frame) {
  focusReturnLayout = document.body.classList.contains('widget-mode') ? 'widget' : 'dashboard';
  await showFrameInPicker(frame, true);
}

async function closeFocusPicker() {
  focusGeneration++;
  pointerStart = null;
  if (focusFrame) liveBusy = false;
  ui.focusPicker.hidden = true;
  focusChatProduct = false;
  document.body.classList.remove('focus-mode');
  focusRect = null; focusFrame = null;
  focusPoint = null; focusMaskPreview = null; focusSelectionImage = null;
  focusExclusionPoints=[];focusAdditionPoints=[];focusCorrectionMode=null;
  ui.submitFocus.disabled = true;
  ui.submitFocus.textContent = '이 상품 알아보기';
  if (focusObjectUrl) URL.revokeObjectURL(focusObjectUrl);
  focusObjectUrl = '';
  await bridge.setWindowLayout(focusReturnLayout);
}

function pointerPosition(event) {
  const rect = ui.focusCanvas.getBoundingClientRect();
  return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))];
}

function selectFocusArea(rect, point = null) {
  focusMaskPreview = null;
  focusSelectionImage = null;
  let [left, top, right, bottom] = rect;
  if (right - left < .04 || bottom - top < .04) {
    const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
    left = Math.max(0, centerX - .10); right = Math.min(1, centerX + .10);
    top = Math.max(0, centerY - .13); bottom = Math.min(1, centerY + .13);
  }
  focusRect = [left, top, right, bottom];
  focusPoint = point;
  ui.submitFocus.disabled = Boolean(point);
  ui.submitFocus.textContent = point ? '상품 마킹 중…' : '이 상품 알아보기';
  ui.focusHint.textContent = point
    ? '기기 안의 AI가 누른 상품의 윤곽을 찾고 있어요.'
    : '드래그한 영역을 확인한 뒤 AI 분석 또는 Lens 검색을 선택하세요.';
  drawFocusRect();
}

async function previewTappedObject(point) {
  if (!focusFrame || liveBusy) return;
  const frame = focusFrame;
  const selectedPoint = [...point];
  const operation = ++focusGeneration;
  liveBusy = true;
  ui.submitFocus.disabled = true;
  byId('include-focus').disabled = true;byId('refine-focus').disabled = true;
  refresh();
  try {
    ui.focusHint.textContent = '기기 안의 AI가 상품 경계를 추출하고 있어요…';
    const image = await isolateTappedObject(frame.blob, selectedPoint, focusExclusionPoints, focusAdditionPoints);
    if (operation !== focusGeneration) return;
    if (focusFrame !== frame || !focusPoint
      || focusPoint[0] !== selectedPoint[0] || focusPoint[1] !== selectedPoint[1]) return;
    if (!image) throw new Error('경계를 찾지 못했어요. 상품 가운데를 다시 누르거나, 상품이 더 크게 보이는 장면에서 선택해 주세요.');
    focusSelectionImage = image;
    byId('include-focus').disabled=false;byId('refine-focus').disabled=false;
    drawFocusRect();
    ui.submitFocus.textContent = '이 상품 알아보기';
    ui.submitFocus.disabled = false;
    ui.focusHint.textContent = '윤곽을 확인하세요. 빠진 부분은 더하고 배경은 빼서 보정할 수 있어요.';
    // A supplementary name must not block an already usable object mask.
    void classifyProduct(image).then(classification => {
      if (operation !== focusGeneration || focusFrame !== frame
        || focusPoint?.[0] !== selectedPoint[0] || focusPoint?.[1] !== selectedPoint[1]) return;
      ui.focusHint.textContent = `${classification.label}${classification.uncertain ? ' · AI 추정' : ''} · 빠진 부분은 더하고 배경은 빼서 보정할 수 있어요.`;
    }).catch(() => {});
  } catch (error) {
    if (operation === focusGeneration && focusFrame === frame) {
      focusSelectionImage = null;
      focusMaskPreview = null;
      drawFocusRect();
      ui.submitFocus.textContent = '상품을 다시 눌러 마킹';
      ui.submitFocus.disabled = true;
      ui.focusHint.textContent = `${message(error)} 다시 누르거나 드래그로 영역을 지정할 수 있어요.`;
    }
  } finally { if (operation === focusGeneration) { liveBusy = false; byId('include-focus').disabled=!focusSelectionImage;byId('refine-focus').disabled=!focusSelectionImage;refresh(); } }
}

let productSearchGeneration=0;
async function searchProductWithAi(image, product=null) {
  const generation=++productSearchGeneration;
  ui.detail.textContent='선택한 상품 이미지를 Gemini로 확인하며 Lens 검색을 열고 있어요…';
  // Lens starts immediately; cloud identification runs in parallel and cannot block it.
  const recognition=(async()=>{
    const bitmap=await createImageBitmap(image);
    const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const data=await bridge.identifyProduct(canvas.toDataURL('image/jpeg',0.85).split(',')[1]);
    if(product){product.label=data.label;product.uncertain=data.confidence==='low';product.matches=data.shoppingUrl?[{source:'Google 쇼핑',title:data.label,url:data.shoppingUrl,matchKind:'text'}]:[];renderProducts();}
    if(generation!==productSearchGeneration)return;
    await window.cleanTouchPlaceChat?.showProduct(image,data);
    ui.detail.textContent=`${data.label} · ${data.reason}`;
  })().catch(()=>{if(generation===productSearchGeneration)ui.detail.textContent='상품 AI 연결을 사용할 수 없어 이미지 검색으로 진행했어요.';});
  await bridge.searchVisual(new Uint8Array(await image.arrayBuffer()));
  // Handle failures independently; never wait for the AI before showing Lens.
  void recognition;
}

async function analyzeSelectedFocus(mode = 'ai') {
  if (!focusFrame || !focusRect || liveBusy) return;
  const frame = focusFrame;
  const rect = [...focusRect];
  const point = focusPoint ? [...focusPoint] : null;
  const operation = focusGeneration;
  liveBusy = true; ui.submitFocus.disabled = true; refresh();
  try {
    let image = null;
    if (point) {
      if (!focusSelectionImage) throw new Error('먼저 상품을 눌러 경계를 표시해 주세요.');
      image = focusSelectionImage;
      ui.focusHint.textContent = mode === 'ai' ? '선택한 상품을 AI로 분석하고 있어요…' : '확인한 상품 윤곽만 Google Lens로 보내고 있어요…';
    } else image = await cropImage(frame.blob, rect);
    if (operation !== focusGeneration || focusFrame !== frame) return;
    if (mode === 'ai') {
      const continueConversation = focusChatProduct;
      const evidence = await buildSelectedProductEvidence(frame, image.selectionBox || rect);
      if (operation !== focusGeneration || focusFrame !== frame) return;
      await closeFocusPicker();
      await window.cleanTouchPlaceChat.identify(image, '', continueConversation, evidence);
      return;
    }
    await bridge.searchVisual(new Uint8Array(await image.arrayBuffer()));
    if (operation !== focusGeneration || focusFrame !== frame) return;
    ui.widgetStatus.textContent = `${clock(frame.seconds)} 장면에서 선택한 상품의 ${point ? (image.type === 'image/png' ? '윤곽 이미지' : '주변 사진') : '영역'}를 Google Lens로 검색했어요.`;
    await closeFocusPicker();
  } catch (error) {
    if (operation !== focusGeneration) return;
    ui.focusHint.textContent = message(error);
    ui.submitFocus.disabled = false;
  } finally { if (operation === focusGeneration) { liveBusy = false; refresh(); } }
}

async function buildSelectedProductEvidence(frame,box){
  if(!frame?.blob||!Array.isArray(box)||box.length!==4)return [];
  const evidence=[];
  try{
    const bitmap=await createImageBitmap(frame.blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();ctx.strokeStyle='#30bce8';ctx.lineWidth=Math.max(2,canvas.width*.004);ctx.strokeRect(box[0]*canvas.width,box[1]*canvas.height,(box[2]-box[0])*canvas.width,(box[3]-box[1])*canvas.height);const context=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
    evidence.push(await cleanTouchImage.encode(context,{maxEdge:960,maxChars:350000}));
    if(!frame.videoOnly)return evidence;
    // Neighbours are context, not replacement targets. Require the same video
    // and a nearby capture time; uploaded stills never inherit screen history.
    const neighbours=adjacentSceneFrames(frame).filter(f=>f!==frame&&f.videoKey===frame.videoKey&&Math.abs(f.capturedAt-frame.capturedAt)<=2200).slice(0,2);
    for(const f of neighbours)evidence.push(await cleanTouchImage.encode(f.blob,{maxEdge:960,maxChars:350000}));
  }catch{/* A selected image remains usable when optional context is unavailable. */}
  return evidence;
}

async function analyze() {
  if (phase === 'analyzing' || liveBusy || !frames.length || Date.now() < retryAt) return;
  const operation = scanGeneration;
  lastNotice = '';
  phase = 'analyzing'; refresh();
  // Freeze the batch: a late capture must not extend or replace work in progress.
  const queue=frames.slice();
  const queueLength=queue.length;
  const attempts=new Map();
  while (cursor < queueLength && phase === 'analyzing') {
    if(operation!==scanGeneration)return;
    const frame = queue[cursor];
    if (completedFrames.has(frame)) { cursor++; refresh(); continue; }
    try { await scanFrame(frame); }
    catch (error) {
      if (operation !== scanGeneration) return;
      phase = 'paused';
      lastNotice = `장면 분석을 멈췄어요: ${message(error)}`;
      refresh(); ui.detail.textContent = lastNotice; return;
    }
    if (operation !== scanGeneration) return;
    if(frame.analysisDeferred){
      retryAt=Math.max(precisionBackoff,precisionChecks>=8?precisionWindowAt+60000:0);
      if(retryAt>Date.now()&&(attempts.get(frame)||0)<2){
        attempts.set(frame,(attempts.get(frame)||0)+1);analysisWaitUntil=retryAt;
        while(Date.now()<analysisWaitUntil){
          if(operation!==scanGeneration||phase!=='analyzing'){analysisWaitUntil=0;return;}
          refresh();await new Promise(resolve=>setTimeout(resolve,250));
        }
        analysisWaitUntil=0;frame.analysisDeferred=false;continue;
      }
      phase='paused';refresh();ui.detail.textContent='AI 연결 또는 사용량 제한으로 일부 장면을 확인하지 못했어요. 찾은 상품은 유지됩니다. 잠시 후 분석 이어서 하기를 눌러 주세요.';return;
    }
    cursor++;
    refresh();
    if (cursor < queueLength) await new Promise(resolve => setTimeout(resolve, 0));
  }
  if(operation!==scanGeneration)return;
  phase = stream ? 'review' : 'complete'; refresh();
  if(precisionOmitted)ui.detail.textContent='확인되지 않은 후보는 제외했습니다. 빠진 상품은 장면에서 직접 선택해 AI 분석할 수 있어요.';
}

async function analyzeAllScenes() {
  if (starting || batchStarting || liveBusy || phase === 'analyzing' || !frames.length || Date.now() < retryAt) return;
  const operation=scanGeneration;
  batchStarting = true; refresh();
  lastNotice='';
  autoAnalysis=false;
  try {
    if (stream && !capturePaused) await stopCapture();
    if(operation!==scanGeneration)return;
    const representatives=cleanTouchSceneDedup.compact(frames,frame=>completedFrames.has(frame));
    duplicateFrames+=frames.length-representatives.length;frames=representatives;
    collectedBytes=frames.reduce((bytes,frame)=>bytes+cleanTouchSceneDedup.frameBytes(frame),0);
    if(document.body.classList.contains('widget-mode')){
      byId('widget-results').open=true;await bridge.setWindowLayout('widget-panel');
    }else await bridge.setWindowLayout('dashboard');
    cursor = 0;
    await analyze();
  } catch(error) {
    if(operation===scanGeneration){phase='paused';lastNotice=`분석을 시작하지 못했어요: ${message(error)}`;}
  } finally { if(operation===scanGeneration){batchStarting = false; refresh();} }
}

function cancelAnalysis(){
  analysisWaitUntil=0;
  const old=scanGeneration++;
  bridge.cancelPlaceRequests?.('scan:'+old).catch(()=>{});
  for(const pending of aiPending.values()){clearTimeout(pending.timer);pending.reject(new Error('분석을 중단했습니다.'));}
  aiPending.clear();aiWorker?.terminate();aiWorker=null;
  batchStarting=false;phase='paused';refresh();
  ui.detail.textContent='분석을 중단했습니다. 확인한 상품과 장면은 유지되며 이어서 분석할 수 있어요.';
}

async function reset() {
  bridge.cancelPlaceRequests?.('scan:'+scanGeneration).catch(()=>{});
  scanGeneration++;
  precisionChecks=0;precisionOmitted=0;precisionCache.length=0;wholeObjectCache.length=0;analyzedSceneCache.length=0;
  productSearchGeneration++;
  window.cleanTouchPlaceChat?.reset();
  window.clearRecentScenes?.();
  if (!ui.focusPicker.hidden) await closeFocusPicker();
  if (phase === 'analyzing') phase = 'paused';
  if (stream) await stopCapture(true);
  capturePaused=false;autoAnalysis=false;
  for (const product of found.values()) for (const sighting of product.sightings) URL.revokeObjectURL(sighting.thumbnail);
  frames = []; found = new Map(); cursor = 0; retryAt = 0; phase = 'idle'; currentFrame = null;
  capturePlan=null;videoTime={available:false};lastNotice='';analysisWaitUntil=0;
  completedFrames = new WeakSet();
  collectedBytes = 0; collectionFull = false; collectionError = ''; duplicateFrames = 0;
  sceneCollector.reset();
  renderProducts(); refresh();
}

ui.start.addEventListener('click', startCapture);
byId('widget-start').addEventListener('click',startCapture);
byId('collapse-widget').title='작은 아이콘으로 접기';
byId('collapse-widget').setAttribute('aria-label','작은 아이콘으로 접기');
byId('collapse-widget').addEventListener('click',()=>bridge.setWindowLayout('micro'));
ui.stop.addEventListener('click', ()=>stopCapture());
ui.analyzeAll.addEventListener('click', analyzeAllScenes);
ui.widgetAll.addEventListener('click', analyzeAllScenes);
byId('analysis-cancel').addEventListener('click',cancelAnalysis);
byId('widget-analysis-cancel').addEventListener('click',cancelAnalysis);
byId('widget-results').addEventListener('toggle',()=>{
  if(document.body.classList.contains('widget-mode'))bridge.setWindowLayout(byId('widget-results').open?'widget-panel':'widget');
});
ui.currentScreen.addEventListener('click', beginFocusPick);
function resumeScanning() {
  if (!stream || !capturePaused || captureStopping || phase==='analyzing' || batchStarting || collectionFull) return;
  capturePaused=false;
  stream.getVideoTracks().forEach(track => { track.enabled = true; });
  if(phase!=='analyzing')phase = 'capturing'; lastNotice = ''; refresh();

}
ui.scanResume.addEventListener('click', resumeScanning);
ui.widgetScanResume.addEventListener('click', resumeScanning);
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
for (const button of document.querySelectorAll('.theme-toggle')) button.addEventListener('click', () => setTheme(!document.body.classList.contains('dark-theme')));
ui.widgetAnalyze.addEventListener('click', beginFocusPick);
ui.widgetStop.addEventListener('click', ()=>stopCapture());
ui.widgetPin.addEventListener('click', async () => {
  const result = await bridge.setWindowLayout('pin-toggle');
  widgetPinned = result?.pinned ?? !widgetPinned;
  refresh();
});
byId('cancel-focus').addEventListener('click', closeFocusPicker);
ui.submitFocus.addEventListener('click', () => analyzeSelectedFocus('ai'));
byId('focus-lens').addEventListener('click', () => analyzeSelectedFocus('lens'));
new MutationObserver(() => {byId('focus-lens').disabled=ui.submitFocus.disabled;byId('focus-lens').hidden=ui.submitFocus.hidden;}).observe(ui.submitFocus,{attributes:true,attributeFilter:['disabled','hidden']});
ui.focusImage.addEventListener('load', syncFocusCanvas);
ui.focusCanvas.addEventListener('pointerdown', event => {
  if (ui.submitFocus.hidden || liveBusy) return;
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
  const distance = Math.abs(pointerStart[0] - point[0]) + Math.abs(pointerStart[1] - point[1]);
  const isTap = distance < .04;
  if(isTap&&focusCorrectionMode&&focusPoint){
    if(focusCorrectionMode==='include')focusAdditionPoints.push(point);else focusExclusionPoints.push(point);
    focusCorrectionMode=null;byId('include-focus').classList.remove('selected');byId('refine-focus').classList.remove('selected');
    pointerStart=null;void previewTappedObject(focusPoint);return;
  }
  focusExclusionPoints=[];focusAdditionPoints=[];focusCorrectionMode=null;
  byId('include-focus').disabled=true;byId('refine-focus').disabled=true;
  byId('include-focus').classList.remove('selected');byId('refine-focus').classList.remove('selected');
  selectFocusArea([Math.min(pointerStart[0], point[0]), Math.min(pointerStart[1], point[1]),
    Math.max(pointerStart[0], point[0]), Math.max(pointerStart[1], point[1])], isTap ? point : null);
  pointerStart = null;
  if (isTap) void previewTappedObject(point);
});
ui.focusCanvas.addEventListener('pointercancel', () => { pointerStart = null; });
byId('include-focus').addEventListener('click',()=>{
  if(byId('include-focus').disabled)return;
  focusCorrectionMode=focusCorrectionMode==='include'?null:'include';
  byId('include-focus').classList.toggle('selected',focusCorrectionMode==='include');
  byId('refine-focus').classList.remove('selected');
  ui.focusHint.textContent=focusCorrectionMode==='include'?'윤곽에서 빠진 상품 안쪽을 한 번 누르세요. AI가 선택 범위를 넓혀요.':'윤곽을 확인하고 필요한 부분을 더하거나 뺄 수 있어요.';
});
byId('refine-focus').addEventListener('click',()=>{
  if(byId('refine-focus').disabled)return;
  focusCorrectionMode=focusCorrectionMode==='exclude'?null:'exclude';
  byId('refine-focus').classList.toggle('selected',focusCorrectionMode==='exclude');
  byId('include-focus').classList.remove('selected');
  ui.focusHint.textContent=focusCorrectionMode==='exclude'?'상품에 포함되면 안 되는 배경이나 사람을 한 번 누르세요. AI가 윤곽을 다시 계산합니다.':'윤곽을 확인하고 필요한 부분을 더하거나 뺄 수 있어요.';
});
ui.filter.addEventListener('input', renderProducts);
window.addEventListener('resize', syncFocusCanvas);
window.addEventListener('keydown', event => { if (event.key === 'Escape' && !ui.focusPicker.hidden) closeFocusPicker(); });
setInterval(() => { if (stream || phase === 'paused') refresh(); }, 1000);

setInterval(() => { readVideoTime().then(() => { ui.widgetTime.textContent = `${videoTime.estimated ? '≈ ' : ''}${clock(currentVideoSecond())}${videoTime.paused ? ' · 멈춤' : ''}`; }); if(stream)updateCapturePlan().catch(()=>{}); }, 500);
setInterval(() => { if (stream && !liveBusy && capturePlan && !capturePlan.blocked) observeScreenTimeline(document.getElementById('capture-preview'), watchTracker); }, 1500);
readVideoTime(); refresh(); checkServer();
refresh();
