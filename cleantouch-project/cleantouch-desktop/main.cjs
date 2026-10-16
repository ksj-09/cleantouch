require('./safe-logging.cjs').protectLogs([process.stdout,process.stderr],console);
const { app, BrowserWindow, desktopCapturer, ipcMain, protocol, session, shell, dialog, nativeImage, clipboard, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const microWidgetLayout = require('./micro-widget-layout.cjs');
const microWidgetLayoutSource = require('node:fs').readFileSync(path.join(__dirname, 'micro-widget-layout.cjs'), 'utf8');
const { requestAi } = require('./service-client.cjs');
// Development preview keeps its settings separate from the installed release.
if (!app.isPackaged || process.env.CLEANTOUCH_PREVIEW_PROFILE) {
  const previewProfile=process.env.CLEANTOUCH_PREVIEW_PROFILE||path.join(__dirname,'..','.local','cleantouch-preview-profile');
  require('node:fs').mkdirSync(previewProfile,{recursive:true});
  app.setPath('userData',previewProfile);
}
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

protocol.registerSchemesAsPrivileged([{
  scheme: 'cleantouch',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

let mainWindow = null;
let microWindow = null;
let lastMicroPosition = null;
const captureGate=require('./capture-consent.cjs').createCaptureGate(()=>mainWindow);
const microphoneGate=require('./microphone-consent.cjs').createMicrophoneGate(()=>mainWindow);
let microphoneApproved=false;
let lastInteractiveAiAt=0;
app.on('second-instance',()=>{let anchorBounds=null;if(microWindow&&!microWindow.isDestroyed()){const icon=microWindow;anchorBounds=icon.getBounds();lastMicroPosition={x:anchorBounds.x,y:anchorBounds.y};microWindow=null;icon.close();}if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();setWindowLayout('widget',null,anchorBounds);mainWindow.focus();}});
let widgetPinned = true;
let lensSearchWindows = 0;
let updates;
const { startWindowsMediaTime } = require('./windows-media-time.cjs');
let mediaTime;
const {startVideoRegion}=require('./windows-video-region.cjs');
let videoRegion;
let captureDisplayId;
const PLACE_CHAT_URL = process.env.CLEANTOUCH_CHAT_URL || require('./chat-endpoint.json').url;

function safeShoppingUrl(input) {
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function syncMainWindowPin() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const pinned = widgetPinned && lensSearchWindows === 0;
  mainWindow.setAlwaysOnTop(pinned, pinned ? 'floating' : 'normal');
}

function createWindow() {
  const area=require('electron').screen.getPrimaryDisplay().workArea;
  const width=Math.min(1100,area.width-24),height=Math.min(820,area.height-24);
  const window = new BrowserWindow({
    x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2),
    width,height,minWidth:Math.min(760,width),minHeight:Math.min(620,height),
    title: 'CleanTouch', icon: path.join(__dirname, 'icon.ico'), backgroundColor: '#f7f4ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false,
    },
  });
  mainWindow = window;
  window.on('closed',()=>{mainWindow=null;app.quit();});
  window.setMenu(null);
  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-start-navigation',()=>microphoneGate.revoke());
  if(!app.isPackaged)window.webContents.on('page-title-updated',event=>{event.preventDefault();window.setTitle(`CleanTouch 개발 미리보기 · ${app.getVersion()}`);});
  // Allow screenshots and screen sharing of the application.
  window.setContentProtection(false);
  window.loadURL('cleantouch://app/index.html');
  window.webContents.setWindowOpenHandler(({ url }) => {
    const safe = safeShoppingUrl(url);
    if (safe) shell.openExternal(safe);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, destination) => {
    if (destination !== 'cleantouch://app/index.html') event.preventDefault();
  });
}

function setWindowLayout(layout, sender = null, anchorBounds = null) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (layout === 'micro') {
    if (microWindow && !microWindow.isDestroyed()) return;
    const { screen } = require('electron');
    const bounds = mainWindow.getBounds();
    const size = microWidgetLayout.MICRO_SIZE;
    const requested = lastMicroPosition || { x: bounds.x, y: bounds.y };
    const display = screen.getDisplayNearestPoint({ x: requested.x + size / 2, y: requested.y + size / 2 });
    const position = microWidgetLayout.clampToWorkArea(requested, { width: size, height: size }, display.workArea);
    const { x, y } = position;
    lastMicroPosition = position;
    const icon = new BrowserWindow({
      x, y, width: size, height: size, frame: false, transparent: true, thickFrame: false,
      backgroundColor: '#00000000', resizable: false, minimizable: false,
      maximizable: false, fullscreenable: false, hasShadow: false, show: false,
      skipTaskbar: true,
      title: 'CleanTouch 위젯',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: true,
      },
    });
    microWindow = icon;
    const enforceIconBounds = microWidgetLayout.protectMicroWindowSize(icon, position);
    // Transparent pixels alone do not reliably pass clicks through on Windows.
    // Restrict the native hit region to the visible rounded icon as well.
    if (process.platform === 'win32' || process.platform === 'linux') icon.setShape(microWidgetLayout.createIconShape());
    icon.setAlwaysOnTop(true, 'floating');
    icon.setMenu(null);
    icon.on('closed', () => {
      if (microWindow !== icon) return;
      microWindow = null;
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.show();
        const anchor = lastMicroPosition ? { ...lastMicroPosition, width: size, height: size } : null;
        setWindowLayout('widget', null, anchor);
      }
    });
    icon.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const iconPage = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden}
      .drag-area{width:${size}px;height:${size}px;display:grid;place-items:center;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
      .drag-area.dragging{cursor:grabbing}
      button{width:42px;height:42px;padding:0;display:grid;place-items:center;border:0;border-radius:15px;background:linear-gradient(145deg,#9275f4,#6945dc);color:#fff;box-shadow:0 6px 16px #21134a88,inset 0 1px 0 #ffffff55;cursor:inherit;pointer-events:none;transition:transform .14s,filter .14s}
      button:hover{transform:scale(1.05);filter:brightness(1.08)}button:active{transform:scale(.96)}button:focus-visible{outline:3px solid #d9ceff;outline-offset:2px}
      svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.spark{fill:currentColor;stroke:none}
    </style></head><body><div class="drag-area" id="drag-area" role="button" tabindex="0" aria-label="CleanTouch 위젯 펼치기" title="CleanTouch 위젯 펼치기"><button id="restore" type="button" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6.5 12h18l-1.5 15h-15L6.5 12Z"/><path d="M11 12V9a4 4 0 0 1 8 0v3"/><path class="spark" d="m24 4 1.2 3.1L28 8.2l-2.8 1.1L24 12l-1.1-2.7L20 8.2l2.9-1.1L24 4Z"/></svg></button></div><script>
      ${microWidgetLayoutSource}
      const area=document.getElementById('drag-area');const drag=window.cleanTouchMicroLayout.createDragController({x:${x},y:${y}});let pointer=null,moved=false,frame=0,last=null,lastCursor=null,moveSequence=0;
      const moveTo=(position,cursor)=>{const sequence=++moveSequence;window.cleanTouch.moveMicroWidget(position.x,position.y,cursor?.x,cursor?.y).then(actual=>{if(sequence===moveSequence&&actual)drag.setPosition(actual);}).catch(()=>{});};
      area.addEventListener('pointerdown',event=>{if(event.button!==0)return;pointer={id:event.pointerId,x:event.screenX,y:event.screenY};drag.begin(event.pointerId,event.screenX,event.screenY);moved=false;last=null;lastCursor={x:event.screenX,y:event.screenY};area.setPointerCapture(event.pointerId);});
      area.addEventListener('pointermove',event=>{if(!pointer||event.pointerId!==pointer.id)return;const dx=event.screenX-pointer.x,dy=event.screenY-pointer.y;if(Math.abs(dx)+Math.abs(dy)>4){moved=true;area.classList.add('dragging');last=drag.move(event.pointerId,event.screenX,event.screenY);lastCursor={x:event.screenX,y:event.screenY};if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(last)moveTo(last,lastCursor);});}});
      const finish=event=>{if(!pointer||event.pointerId!==pointer.id)return;if(frame){cancelAnimationFrame(frame);frame=0;}const committed=drag.finish(event.pointerId,moved);if(moved&&committed)moveTo(committed,{x:event.screenX,y:event.screenY});pointer=null;area.classList.remove('dragging');};
      area.addEventListener('pointerup',finish);area.addEventListener('pointercancel',finish);
      area.addEventListener('click',()=>{if(drag.consumeGeneratedClick())return;window.cleanTouch.setWindowLayout('restore-micro');});
      area.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();window.cleanTouch.setWindowLayout('restore-micro');}});
    </script></body></html>`;
    icon.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(iconPage)}`);
    icon.once('ready-to-show', () => { if (!icon.isDestroyed()) { icon.showInactive(); enforceIconBounds(position); } });
    icon.webContents.once('did-fail-load', () => {
      if (microWindow !== icon) return;
      microWindow = null;
      if (!icon.isDestroyed()) icon.close();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        setWindowLayout('widget');
      }
    });
    mainWindow.hide();
    return;
  }
  if (layout === 'restore-micro') {
    if (!microWindow || sender !== microWindow.webContents) throw new Error('CleanTouch 아이콘에서만 위젯을 펼칠 수 있어요.');
    const icon = microWindow;
    const iconBounds = icon.getBounds();
    lastMicroPosition = { x: iconBounds.x, y: iconBounds.y };
    microWindow = null;
    mainWindow.show();
    setWindowLayout('widget', null, iconBounds);
    mainWindow.focus();
    if (!icon.isDestroyed()) icon.close();
    return;
  }
  if (microWindow && !microWindow.isDestroyed()) {
    const icon = microWindow;
    microWindow = null;
    icon.close();
  }
  if (!mainWindow.isVisible()) mainWindow.show();
  // Bounds changes only update the restore rectangle while maximized on Windows.
  // Leave that state first, so folding and selecting a product actually resize.
  if (layout !== 'pin-toggle' && mainWindow.isMaximized()) mainWindow.unmaximize();
  const { screen } = require('electron');
  const displayAnchor = layout === 'widget' && anchorBounds ? anchorBounds : mainWindow.getBounds();
  const display = layout === 'widget' && anchorBounds
    ? screen.getDisplayNearestPoint({ x: displayAnchor.x + displayAnchor.width / 2, y: displayAnchor.y + displayAnchor.height / 2 })
    : screen.getDisplayMatching(displayAnchor);
  const area = display.workArea;
  if (layout === 'compact') {
    mainWindow.setMinimumSize(220, 96);
    mainWindow.setMaximumSize(520, 900);
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({x: Math.max(area.x, Math.min(bounds.x, area.x+area.width-260)), y: Math.max(area.y, Math.min(bounds.y, area.y+area.height-96)), width:260, height:96});
    return;
  }
  if (layout === 'dashboard') {
    widgetPinned = false;
    syncMainWindowPin();
    mainWindow.setMinimumSize(Math.min(760,area.width), Math.min(620,area.height));
    mainWindow.setMaximumSize(7680, 4320);
    mainWindow.setBounds({
      x: area.x + Math.max(0, Math.round((area.width - 1100) / 2)),
      y: area.y + Math.max(0, Math.round((area.height - 820) / 2)), width:Math.min(1100,area.width), height:Math.min(820,area.height),
    }, true);
    return;
  }
  if (layout === 'focus') {
    widgetPinned = true;
    mainWindow.setMinimumSize(Math.min(760,area.width), Math.min(620,area.height));
    mainWindow.setMaximumSize(7680, 4320);
    syncMainWindowPin();
    mainWindow.setBounds({
      x: area.x + Math.max(0, Math.round((area.width - 980) / 2)),
      y: area.y + Math.max(0, Math.round((area.height - 760) / 2)), width: Math.min(980, area.width), height: Math.min(760, area.height),
    }, true);
    return;
  }
  if(layout==='widget-panel'){
    const bounds=mainWindow.getBounds();widgetPinned=true;syncMainWindowPin();
    mainWindow.setMinimumSize(360,360);mainWindow.setMaximumSize(520,900);
    const width=Math.min(400,area.width),height=Math.min(740,area.height-32);
    mainWindow.setBounds({x:Math.max(area.x,Math.min(bounds.x,area.x+area.width-width)),y:Math.max(area.y,Math.min(bounds.y,area.y+area.height-height)),width,height},true);return;
  }
  if(layout==='live-chat'){
    const scene=videoRegion?.get();
    const video=scene?.available?screen.screenToDipRect(null,scene.rect):null;
    const width=Math.min(400,area.width),height=Math.min(820,area.height-24);
    const rightX=area.x+Math.max(0,area.width-width-22),leftX=area.x+22;
    const overlaps=x=>video&&x<video.x+video.width&&x+width>video.x;
    const x=!overlaps(rightX)?rightX:!overlaps(leftX)?leftX:rightX;
    const y=area.y+Math.max(12,Math.round((area.height-height)/2));
    widgetPinned=true;syncMainWindowPin();
    mainWindow.setMinimumSize(360,360);mainWindow.setMaximumSize(520,900);
    mainWindow.setBounds({x,y,width,height},true);return;
  }
  if (layout === 'widget') {
    const scene = videoRegion?.get();
    const video = scene?.available ? screen.screenToDipRect(null,scene.rect) : null;
    const rightX = area.x + Math.max(0, area.width - 420 - 22);
    const overlaps = video && rightX < video.x+video.width && rightX+420 > video.x;
    widgetPinned = true;
    mainWindow.setMinimumSize(360, 360);
    mainWindow.setMaximumSize(520, 600);
    syncMainWindowPin();
    const width = Math.min(400, area.width), height = Math.min(580, area.height);
    const bounds = anchorBounds
      ? microWidgetLayout.expandAtAnchor(anchorBounds, area, width, height)
      : { x: overlaps ? area.x+22 : rightX, y: area.y + 52, width, height };
    mainWindow.setBounds(bounds, true);
    return;
  }
  if (layout === 'pin-toggle') {
    widgetPinned = !widgetPinned;
    syncMainWindowPin();
    return { pinned: widgetPinned };
  }
  throw new Error('알 수 없는 화면 배치입니다.');
}

app.whenReady().then(async () => {
  ipcMain.handle('voice:authorize',event=>microphoneGate.authorize(event.sender,event.senderFrame,async()=>{
    if(microphoneApproved)return true;
    const result=await dialog.showMessageBox(mainWindow,{type:'question',title:'음성으로 질문하기',message:'마이크를 켜고 AI와 음성으로 대화할까요?',detail:'음성 대화를 시작하면 마이크 소리를 Gemini에 실시간으로 전송하고 AI가 소리로 답합니다. 대화 종료·창 숨김·연결 끊김 시 마이크가 꺼집니다. 2분 동안 대화가 없어도 자동으로 꺼집니다. CleanTouch 서버에 음성을 저장하지 않습니다. 화면 공유는 별도로 허용해야 합니다.',checkboxLabel:'앱을 닫을 때까지 이 허용 기억하기',checkboxChecked:true,buttons:['취소','마이크 허용'],defaultId:1,cancelId:0,noLink:true});if(result.response===1&&result.checkboxChecked)microphoneApproved=true;return result.response===1;
  }));
  ipcMain.handle('voice:revoke',()=>microphoneGate.revoke());
  session.defaultSession.setPermissionCheckHandler((contents,permission,_origin,details)=>permission==='media'?microphoneGate.allows(contents,details.mediaType,details):permission==='display-capture'&&contents===mainWindow?.webContents);
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>{
    if(permission==='media'){const types=details.mediaTypes||[];callback(types.length===0?captureGate.allowsDisplayPermission(contents,details):types.length===1&&types[0]==='audio'&&microphoneGate.allows(contents,'audio',details));return;}
    callback(permission==='display-capture'&&contents===mainWindow?.webContents);
  });
  ipcMain.handle('capture:authorize',event=>captureGate.authorize(event.sender,event.senderFrame));
  ipcMain.handle('capture:revoke',()=>captureGate.revoke());
  const chatCodec=safeStorage.isEncryptionAvailable()?{
    encode:value=>safeStorage.encryptString(value).toString('base64'),
    decode:value=>safeStorage.decryptString(Buffer.from(value,'base64')),
  }:undefined;
  const chats=require('./chat-store.cjs').createChatStore(path.join(app.getPath('userData'),'conversations.json'),chatCodec);
  const requestSigner=require('./request-signer.cjs').createRequestSigner(path.join(app.getPath('userData'),'device-identity.json'),chatCodec);
  const signedAi=(payload,options={})=>requestAi(PLACE_CHAT_URL,payload,{...options,signHeaders:body=>requestSigner.sign(body)});
  const titleService=require('./chat-title-service.cjs').createTitleService({store:chats,canRun:()=>Date.now()-lastInteractiveAiAt>60000,WebSocket:globalThis.WebSocket,getToken:()=>signedAi({task:'live-token',shoppingTools:false},{timeoutMs:20000}),onChange:()=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('chats:changed');}});
  app.on('before-quit',()=>titleService.stop());
  ipcMain.handle('chats:list',async()=>{const list=await chats.list();void chats.all().then(records=>titleService.schedule(records)).catch(()=>{});return list;});
  ipcMain.handle('chats:load',(_event,id)=>chats.load(id));
  ipcMain.handle('chats:save',(_event,record)=>chats.save(record));
  ipcMain.handle('chats:delete',(_event,id)=>chats.delete(id));
  const imageImporter=require('./image-import.cjs').createImageImporter({dialog,nativeImage,getWindow:()=>mainWindow});
  ipcMain.handle('images:choose',(_event,kind)=>imageImporter.choose(kind));
  ipcMain.handle('images:load',(_event,id)=>imageImporter.load(id));
  const placeRequests=new Map();
  app.on('before-quit',()=>{for(const controller of placeRequests.keys())controller.abort();placeRequests.clear();});
  ipcMain.handle('place:cancel',(event,group)=>{
    for(const [controller,request] of placeRequests)if(request.sender===event.sender.id&&request.group===group)controller.abort();
  });
  ipcMain.handle('place:chat',async(_event,payload)=>{
    const speech=payload?.task==='speech'&&_event.sender===mainWindow?.webContents&&_event.senderFrame===_event.sender.mainFrame&&typeof payload.audio==='string'&&payload.audio.length<=1300000;
    if(!speech&&(!payload||typeof payload.image!=='string'||payload.image.length>2_800_000||!Array.isArray(payload.messages)||payload.messages.length>13))throw new Error('AI 요청 형식이 올바르지 않아요.');
    const {_requestGroup:group,...bodyPayload}=payload,controller=new AbortController();
    placeRequests.set(controller,{sender:_event.sender.id,group});
    try {
      return await signedAi(bodyPayload,{signal:controller.signal});
    }
    finally{placeRequests.delete(controller);}
  });
  ipcMain.handle('ai:live-token',async(_event,sessionHandle='')=>{
    lastInteractiveAiAt=Date.now();
    return signedAi({task:'live-token',sessionHandle,shoppingTools:true},{timeoutMs:20000});
  });
  mediaTime = startWindowsMediaTime(app);
  videoRegion = startVideoRegion(app);
  ipcMain.handle('video:time', () => {
    const media=mediaTime.get(),region=videoRegion.get();
    return require('./media-evidence.cjs').reconcileMedia(media,region);
  });
  ipcMain.handle('capture:geometry',()=>{
    const {screen,BrowserWindow}=require('electron');
    const display=screen.getAllDisplays().find(d=>d.id===captureDisplayId)||screen.getPrimaryDisplay();
    const monitor=screen.dipToScreenRect(null,display.bounds);
    const excluded=BrowserWindow.getAllWindows().filter(w=>w.isVisible()&&!w.isMinimized()).map(w=>screen.dipToScreenRect(w,w.getBounds()));
    return {monitor,excluded,scene:videoRegion.get(),trackVideo:true};
  });
  protocol.handle('cleantouch', async request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('Not found', { status: 404 });
    const appRoot = path.resolve(app.getAppPath());
    const resourcePath = path.resolve(appRoot, decodeURIComponent(url.pathname.slice(1)));
    const relativePath = path.relative(appRoot, resourcePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return new Response('Not found', { status: 404 });
    try {
      const contents = await fs.readFile(resourcePath);
      const extension = path.extname(resourcePath).toLowerCase();
      const contentType = ({
        '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm',
        '.task': 'application/octet-stream', '.ico': 'image/x-icon',
      })[extension] || 'application/octet-stream';
      return new Response(contents, { headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' } });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  app.setAppUserModelId('kr.cleantouch.desktop');
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    if(!captureGate.consume(_request)){callback(null);return;}
    try {
      const { screen } = require('electron');
      const scene=videoRegion.get();
      const target = scene.available&&scene.rect
        ? screen.getDisplayMatching(screen.screenToDipRect(null,scene.rect))
        : mainWindow && !mainWindow.isDestroyed() ? screen.getDisplayMatching(mainWindow.getBounds()) : screen.getPrimaryDisplay();
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      captureDisplayId=target.id;
      const chosen = sources.find(source => source.display_id === String(target.id)) || sources[0];
      callback(chosen ? { video: chosen } : {});
    } catch { callback({}); }
  });
  ipcMain.handle('window:layout', (event, layout) => setWindowLayout(layout, event.sender));
  ipcMain.handle('window:move-micro', (event, position) => {
    if (!microWindow || microWindow.isDestroyed() || event.sender !== microWindow.webContents) return false;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
    const { screen } = require('electron');
    const measured = microWindow.getBounds();
    const size = microWidgetLayout.MICRO_SIZE;
    const bounds = {
      width: Math.max(size, Math.min(measured.width, size + 2)),
      height: Math.max(size, Math.min(measured.height, size + 2)),
    };
    const cursor = Number.isFinite(position.pointerX) && Number.isFinite(position.pointerY)
      ? { x: position.pointerX, y: position.pointerY }
      : { x: position.x + bounds.width / 2, y: position.y + bounds.height / 2 };
    const display = screen.getDisplayNearestPoint(cursor);
    const clamped = microWidgetLayout.clampToWorkArea(position, bounds, display.workArea);
    const { x, y } = clamped;
    microWindow.setBounds({ x, y, width: size, height: size }, false);
    const actual = microWindow.getBounds();
    lastMicroPosition = { x: actual.x, y: actual.y };
    return lastMicroPosition;
  });
  ipcMain.handle('links:open', (_event, value) => {
    const safe = safeShoppingUrl(value);
    if (!safe) throw new Error('열 수 없는 상품 링크예요.');
    return shell.openExternal(safe);
  });
  ipcMain.handle('clipboard:write',(_event,value)=>{if(typeof value!=='string'||value.length>120000)throw new Error('복사할 대화가 너무 길어요.');clipboard.writeText(value);return true;});
  ipcMain.handle('visual:search', async (_event, image) => {
    if (!(image instanceof Uint8Array) || image.length === 0 || image.length > 8 * 1024 * 1024) {
      throw new Error('선택한 상품 사진을 읽지 못했어요. 다시 선택해 주세요.');
    }
    const { nativeImage } = require('electron');
    const bytes = Buffer.from(image);
    const picture = nativeImage.createFromBuffer(bytes);
    if (picture.isEmpty()) throw new Error('선택한 상품 사진 형식이 올바르지 않아요.');
    const directory = await fs.mkdtemp(path.join(app.getPath('temp'), 'cleantouch-lens-'));
    const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const imagePath = path.join(directory, isPng ? 'selected-product.png' : 'selected-product.jpg');
    // Keep the renderer-produced alpha mask byte-for-byte; converting it through
    // nativeImage risks making Lens receive an opaque screenshot-like image.
    await fs.writeFile(imagePath, isPng ? bytes : picture.toJPEG(90));
    const lensWindow = new BrowserWindow({
      width: 1040, height: 860, minWidth: 760, minHeight: 600,
      title: 'CleanTouch · Google Lens', backgroundColor: '#101922',
      webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true },
    });
    lensWindow.setMenu(null);
    lensSearchWindows += 1;
    syncMainWindowPin();
    lensWindow.focus();
    lensWindow.webContents.setWindowOpenHandler(({ url }) => {
      const safe = safeShoppingUrl(url);
      if (safe) shell.openExternal(safe);
      return { action: 'deny' };
    });
    lensWindow.on('closed', () => {
      lensSearchWindows = Math.max(0, lensSearchWindows - 1);
      syncMainWindowPin();
      void fs.rm(directory, { recursive: true, force: true });
    });
    lensWindow.webContents.on('did-navigate', (_event, destination) => {
      lensWindow.setTitle(destination.includes('/sorry/') ? 'Google Lens · 확인 필요' : 'CleanTouch · Google Lens');
    });
    try {
      await lensWindow.loadURL('https://www.google.com/imghp?hl=ko');
      const contents = lensWindow.webContents;
      const deadline = Date.now() + 15_000;
      let inputReady = false;
      while (!inputReady && Date.now() < deadline && !lensWindow.isDestroyed()) {
        inputReady = await contents.executeJavaScript(`(() => {
          if (document.querySelector('input[type="file"]')) return true;
          if (!window.__cleanTouchOpenedImageSearch) {
            const controls = [...document.querySelectorAll('button,[role="button"],[aria-label]')];
            const button = controls.find(el => /이미지로 검색|search by image/i.test(
              [el.getAttribute('aria-label'), el.innerText, el.getAttribute('title')].filter(Boolean).join(' ')));
            if (button) { window.__cleanTouchOpenedImageSearch = true; button.click(); }
          }
          return Boolean(document.querySelector('input[type="file"]'));
        })()`, true);
        if (!inputReady) await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!inputReady || lensWindow.isDestroyed()) throw new Error('Google Lens 검색창을 열지 못했어요. 인터넷 연결을 확인해 주세요.');
      const debuggerApi = contents.debugger;
      debuggerApi.attach('1.3');
      try {
        const { root } = await debuggerApi.sendCommand('DOM.getDocument', { depth: -1, pierce: true });
        const { nodeId } = await debuggerApi.sendCommand('DOM.querySelector', {
          nodeId: root.nodeId, selector: 'input[type="file"]',
        });
        if (!nodeId) throw new Error('Google Lens 이미지 입력을 찾지 못했어요.');
        await debuggerApi.sendCommand('DOM.setFileInputFiles', { files: [imagePath], nodeId });
      } finally {
        if (debuggerApi.isAttached()) debuggerApi.detach();
      }
      return { opened: true };
    } catch (error) {
      if (!lensWindow.isDestroyed()) lensWindow.close();
      throw error;
    }
  });

  createWindow();
  const { autoUpdater } = require('electron-updater');
  updates = require('./updater.cjs').createUpdateController(autoUpdater, {
    supported: app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE,
    notify: state => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates:state', state); },
  });
  ipcMain.handle('updates:get', () => updates.get());
  ipcMain.handle('updates:check', () => updates.check());
  ipcMain.handle('updates:download', () => updates.download());
  ipcMain.handle('updates:install', () => updates.install());
  ipcMain.handle('updates:defer', () => updates.defer());
  ipcMain.handle('updates:activity', (_event, busy) => updates.activity(busy));
  setTimeout(() => updates.check(), 10000).unref();
  setInterval(() => updates.check(), 6 * 60 * 60 * 1000).unref();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { mediaTime?.close(); videoRegion?.close(); });
