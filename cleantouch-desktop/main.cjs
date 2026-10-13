require('./safe-logging.cjs').protectLogs([process.stdout,process.stderr],console);
const { app, BrowserWindow, desktopCapturer, ipcMain, protocol, session, shell, dialog, nativeImage, clipboard, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
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
const captureGate=require('./capture-consent.cjs').createCaptureGate(()=>mainWindow);
app.on('second-instance',()=>{if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
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

function setWindowLayout(layout) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // Bounds changes only update the restore rectangle while maximized on Windows.
  // Leave that state first, so folding and selecting a product actually resize.
  if (layout !== 'pin-toggle' && mainWindow.isMaximized()) mainWindow.unmaximize();
  const { screen } = require('electron');
  const area = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
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
    mainWindow.setBounds({
      x: overlaps ? area.x+22 : rightX, y: area.y + 52,
      width: Math.min(400, area.width), height: Math.min(580, area.height),
    }, true);
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
  ipcMain.handle('capture:authorize',event=>captureGate.authorize(event.sender,event.senderFrame));
  ipcMain.handle('capture:revoke',()=>captureGate.revoke());
  const chatCodec=safeStorage.isEncryptionAvailable()?{
    encode:value=>safeStorage.encryptString(value).toString('base64'),
    decode:value=>safeStorage.decryptString(Buffer.from(value,'base64')),
  }:undefined;
  const chats=require('./chat-store.cjs').createChatStore(path.join(app.getPath('userData'),'conversations.json'),chatCodec);
  const titleService=require('./chat-title-service.cjs').createTitleService({store:chats,WebSocket:globalThis.WebSocket,getToken:()=>requestAi(PLACE_CHAT_URL,{task:'live-token',shoppingTools:false},{timeoutMs:20000}),onChange:()=>{if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('chats:changed');}});
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
    if(!payload||typeof payload.image!=='string'||payload.image.length>2_800_000||!Array.isArray(payload.messages)||payload.messages.length>13)throw new Error('장소 분석 요청 형식이 올바르지 않아요.');
    const {_requestGroup:group,...bodyPayload}=payload,controller=new AbortController();
    placeRequests.set(controller,{sender:_event.sender.id,group});
    try {
      return await requestAi(PLACE_CHAT_URL,bodyPayload,{signal:controller.signal});
    }
    finally{placeRequests.delete(controller);}
  });
  ipcMain.handle('ai:live-token',async(_event,sessionHandle='')=>{
    return requestAi(PLACE_CHAT_URL,{task:'live-token',sessionHandle,shoppingTools:true},{timeoutMs:20000});
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
  ipcMain.handle('window:layout', (_event, layout) => setWindowLayout(layout));
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
