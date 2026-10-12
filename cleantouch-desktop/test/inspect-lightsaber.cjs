const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.env.CLEANTOUCH_TEST_APP_ROOT || path.resolve(__dirname, '..');
const fixture = path.resolve(__dirname,'../../artifacts/verification/lightsaber-scene.png');
protocol.registerSchemesAsPrivileged([{scheme:'cleantouch',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
app.whenReady().then(async () => {
  try {
    protocol.handle('cleantouch',async request => {
      const url = new URL(request.url);
      const file = url.pathname === '/scene.png' ? fixture : path.join(root,url.pathname.slice(1));
      const type = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png'}[path.extname(file)] || 'application/octet-stream';
      return new Response(await fs.readFile(file),{headers:{'Content-Type':type}});
    });
    for (const name of ['get','activity']) ipcMain.handle(`updates:${name}`,()=>({status:'unsupported'}));
    ipcMain.handle('window:layout',()=>({pinned:true}));
    ipcMain.handle('video:time',()=>({available:false}));
    ipcMain.handle('place:chat',async(_event,payload)=>{
      if(!process.env.CLEANTOUCH_LIVE_PRECISION)throw new Error('Precision service unavailable');
      const response=await fetch('https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)});
      if(!response.ok)throw new Error('Precision HTTP '+response.status);const answer=await response.json();console.log(JSON.stringify({precision:answer}));return answer;
    });
    const window = new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'preload.cjs'),sandbox:true,contextIsolation:true}});
    await window.loadURL('cleantouch://app/index.html');
    const result = await window.webContents.executeJavaScript(`(async()=>{
      const blob=await(await fetch('cleantouch://app/scene.png')).blob();
      const bitmap=await createImageBitmap(blob);const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
      const diagnostics=[];for(const r of glowingObjectRegions(canvas)){const crop=await cropImage(blob,[r.left/canvas.width,r.top/canvas.height,r.right/canvas.width,r.bottom/canvas.height]);diagnostics.push({region:r,classification:await classifyProduct(crop)});}
      console.log(JSON.stringify(diagnostics.map(x=>({region:x.region,label:x.classification.label,category:x.classification.category,uncertain:x.classification.uncertain}))));
      // Independent adjacent frames retain the glowing props; an identical still
      // must not count twice as temporal evidence.
      const adjacentCanvas=document.createElement('canvas');adjacentCanvas.width=canvas.width;adjacentCanvas.height=canvas.height;
      const adjacentContext=adjacentCanvas.getContext('2d');adjacentContext.drawImage(canvas,0,0);adjacentContext.fillStyle='#123456';adjacentContext.fillRect(0,0,2,2);
      const adjacentBlob=await new Promise(r=>adjacentCanvas.toBlob(r,'image/png'));
      const frame={blob,seconds:13,capturedAt:13000,videoKey:'lightsaber-short',videoTitle:'Lightsaber Short',timeEstimated:true};
      frames=[{...frame,blob:adjacentBlob,seconds:12,capturedAt:12000},frame];
      await scanFrame(frame);
      return {diagnostics:diagnostics.map(x=>({region:x.region,label:x.classification.label,category:x.classification.category,uncertain:x.classification.uncertain})),products:[...found.values()].map(p=>({label:p.label,uncertain:p.uncertain})),cards:ui.products.querySelectorAll('.product').length};
    })()`);
    console.log(JSON.stringify(result));
    assert.deepEqual(result.products.map(p=>p.label).sort(),['빨간색 광선검','초록색 광선검','보라색 광선검'].sort());
    assert.equal(result.cards,3);
    await fs.writeFile(path.resolve(__dirname,'../../artifacts/verification/lightsaber-screen-analysis.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
