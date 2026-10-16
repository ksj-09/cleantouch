const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.env.CLEANTOUCH_TEST_APP_ROOT || path.resolve(__dirname, '..');
protocol.registerSchemesAsPrivileged([{ scheme: 'cleantouch', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.whenReady().then(async () => {
  let window;
  let networkAnalysisCalls = 0; let precisionCalls = 0;
    ipcMain.handle('place:chat', async (_event, payload) => {
      precisionCalls++;
      if (!process.env.CLEANTOUCH_LIVE_PRECISION) throw new Error('Precision service unavailable');
      const response = await fetch('https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)});
      if(!response.ok) throw new Error('Precision service HTTP '+response.status);
      return response.json();
    });
  let timing = { available: false };
  try {
    protocol.handle('cleantouch', async request => {
      const url = new URL(request.url);
      const filename = url.pathname === '/fixture.png'
        ? path.resolve(__dirname, '../../cleantouch-android/app/src/androidTest/assets/bag.png')
        : path.join(root, url.pathname.slice(1));
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png' }[path.extname(filename)] || 'application/octet-stream';
      return new Response(await fs.readFile(filename), { headers: { 'Content-Type': type } });
    });
    for (const method of ['get', 'activity']) ipcMain.handle(`updates:${method}`, () => ({ status: 'unsupported' }));
    ipcMain.handle('window:layout', () => ({ pinned: true }));
    ipcMain.handle('video:time', () => timing);
    ipcMain.handle('capture:geometry', () => ({monitor:{x:0,y:0,width:640,height:360},scene:{available:true,rect:{x:0,y:0,width:640,height:360}},excluded:[]}));
    for (const method of ['health', 'scan']) ipcMain.handle(`api:${method}`, () => {
      networkAnalysisCalls++;
      throw new Error('Analysis servers are unavailable in this test');
    });
    window = new BrowserWindow({ show: false, webPreferences: { preload: path.join(root, 'preload.cjs'), sandbox: true, contextIsolation: true, backgroundThrottling:false } });
    await window.loadURL('cleantouch://app/index.html');
    const result = await window.webContents.executeJavaScript(`(async () => {
      await checkServer();
      const blob = await (await fetch('cleantouch://app/fixture.png')).blob();
      frames = [{blob, seconds: 83, videoKey: 'fixture', videoTitle: 'Video fixture'}, {blob, seconds: 12, videoKey: 'fixture', videoTitle: 'Video fixture'}];
      currentFrame = frames[1];
      let enabled = true;
      const track={get enabled(){return enabled;},set enabled(value){enabled=value;},stop(){enabled=false;}};
      stream = { getVideoTracks: () => [track],getTracks:()=>[track] };
      phase = 'capturing';
      const allAnalysis=analyzeAllScenes();
      while(!frames.every(frame=>completedFrames.has(frame)))await new Promise(resolve=>setTimeout(resolve,20));
      await stopCapture(true);await allAnalysis;
      const unknown = productRanges([{seconds: null}]);
      return { ready: serverReady, phase, cursor, products: [...found.values()].map(p => ({ label: p.label, uncertain: p.uncertain, sightings: p.sightings.length, size: p.imageBlob.size, times: p.sightings.map(s => s.seconds), embeddingSize: p.embedding?.length })), unknown, clockUnknown: clock(null), timeText: [...ui.products.querySelectorAll('small')].map(el => el.textContent).join(' '), scanPaused: !enabled, cards: ui.products.querySelectorAll('.product').length, topControlsRemoved: !document.querySelector('.shell [data-updates], #check-api') };
    })()`);
    assert.equal(result.ready, true);
    assert.equal(result.phase, 'complete');
    assert.equal(result.cursor, 2);
    assert.equal(result.scanPaused, true);
    assert.equal(result.topControlsRemoved, true);
    console.log(JSON.stringify({products:result.products,precisionCalls}));
    if(process.env.CLEANTOUCH_LIVE_PRECISION) assert(result.cards > 0);
    else assert(result.products.every(product => !product.uncertain), 'Unavailable verification must not invent uncertain products');
    if(result.cards) assert(result.products.some(product => product.sightings === 2 && product.size > 0));
    assert(result.products.every(product => product.embeddingSize === 512));
    if(result.cards) assert(result.products.some(product => product.label !== '상품 후보'));
    assert(result.products.every(product => !product.label.includes('광선검')), 'Bag fixture must not gain false lightsabers from bright edges');
    if(result.cards) assert(result.timeText.includes('1:23'));
    if(result.cards) assert(result.timeText.includes('0:12'));
    assert(!result.timeText.includes('0:05'));
    assert(!result.timeText.includes('시작 후 경과'));
    assert.equal(result.clockUnknown, '영상 시간 확인 안 됨');
    assert.deepEqual(result.unknown, ['영상 시간 확인 안 됨']);
    assert.equal(networkAnalysisCalls, 0);
    const mask = await window.webContents.executeJavaScript(`(async () => {
      const blob = await (await fetch('cleantouch://app/fixture.png')).blob();
      const selected = await isolateTappedObject(blob, [.58, .57]);
      if (!selected) throw new Error('Tapped product must produce an AI contour');
      const bitmap = await createImageBitmap(selected);
      const encoded=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(selected);});
      const previewContext=focusMaskPreview.getContext('2d');
      const result = { width: bitmap.width, height: bitmap.height, type: selected.type, classification: (await classifyProduct(selected)).label, encoded, faceIncluded:previewContext.getImageData(180,140,1,1).data[3]>0, bagIncluded:previewContext.getImageData(235,440,1,1).data[3]>0 };
      bitmap.close(); return result;
    })()`);
    assert.equal(mask.type, 'image/png');
    assert(mask.width < 370 && mask.height < 750);
    await fs.mkdir(path.resolve(__dirname,'../../artifacts/verification'),{recursive:true});
    await fs.writeFile(path.resolve(__dirname,'../../artifacts/verification/bag-whole-mask.png'),Buffer.from(mask.encoded,'base64'));delete mask.encoded;
    assert.equal(mask.faceIncluded,false,'Bag selection must exclude the wearer face');
    assert.equal(mask.bagIncluded,true,'Bag selection must retain the body of the bag');
    result.tapMask = mask;
    await window.webContents.executeJavaScript(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      canvas.getContext('2d').fillRect(0, 0, 640, 360);
      stream = canvas.captureStream(10); ui.video.srcObject = stream; await ui.video.play();
      startedAt = Date.now() - 5000; frames = [];
    })()`);
    timing = { available: true, seconds: 83, videoKey: 'fixture', title: 'Fixture', paused: true };
    const first = await window.webContents.executeJavaScript('captureFrame().then(frame => frame.seconds)');
    assert.equal(first, 83);
    const paused = await window.webContents.executeJavaScript('captureFrame().then(frame => frame.seconds)');
    assert.equal(paused, 83);
    timing = { ...timing, seconds: 12 };
    const seeked = await window.webContents.executeJavaScript('captureFrame().then(frame => frame.seconds)');
    assert.equal(seeked, 12);
    timing = { available: false };
    const unknown = await window.webContents.executeJavaScript('captureFrame().then(frame => frame.seconds)');
    assert(Number.isFinite(unknown));
    const ocr = await window.webContents.executeJavaScript(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0,0,640,360);
      ctx.fillStyle = 'black'; ctx.font = '48px Arial'; ctx.fillText('1:23 / 4:00',40,180);
      ui.video.srcObject = canvas.captureStream(10); await ui.video.play();
      const tracker = new watchTime.WatchTimeline(); await observeScreenTimeline(ui.video, tracker);
      return tracker.snapshot();
    })()`);
    assert.equal(ocr.seconds,83); assert.equal(ocr.estimated,false);
    result.screenOCR = ocr;
    await window.webContents.executeJavaScript('stream.getTracks().forEach(track => track.stop())');
    result.capturedVideoTimes = [first, paused, seeked, unknown];
    console.log(JSON.stringify(result));
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
