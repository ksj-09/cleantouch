const {app,BrowserWindow,ipcMain,protocol}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
app.setPath('userData',require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(),'cleantouch-dedup-')));
protocol.registerSchemesAsPrivileged([{scheme:'cleantouch',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
app.whenReady().then(async()=>{try{
 protocol.handle('cleantouch',async request=>{const file=path.join(root,new URL(request.url).pathname.slice(1));return new Response(await fs.readFile(file),{headers:{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream'}});});
 for(const method of ['get','activity'])ipcMain.handle('updates:'+method,()=>({status:'unsupported'}));
 ipcMain.handle('chats:list',()=>[]);ipcMain.handle('video:time',()=>({available:false}));
 const win=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'preload.cjs'),sandbox:true,contextIsolation:true,backgroundThrottling:false}});
 await win.loadURL('cleantouch://app/index.html');
 const progress=setInterval(()=>win.webContents.executeJavaScript('window.dedupStage').then(stage=>console.log('Capture test:',stage)).catch(()=>{}),10000);
 const result=await win.webContents.executeJavaScript(`(async()=>{
  window.dedupStage='loading fixture';const image=await createImageBitmap(await(await fetch('cleantouch://app/test/fixtures/blue-scene.jpg')).blob());
  for(const [key,value] of [['readyState',2],['videoWidth',1920],['videoHeight',1080]])Object.defineProperty(ui.video,key,{configurable:true,value});
  stream={};capturePaused=false;startedAt=Date.now();phase='capturing';
  readVideoTime=async()=>({available:true,videoKey:'fixture',seconds:10,paused:true});
  const plan={linked:true,blocked:false,source:{width:1920,height:1080}};
  updateCapturePlan=async()=>plan;
  let changed=false;sceneCapture.drawFrame=(ctx,video,plan,w,h)=>{ctx.drawImage(image,0,0,w,h);if(changed){ctx.fillStyle='#ff2211';ctx.fillRect(w*.4,h*.4,w*.05,h*.05);}};
  // Alternate the actual capture path (JPEG .94/1920px) and the recent-frame
  // path (JPEG .92/1280px), reproducing the old byte-hash mismatch.
  const c=document.createElement('canvas');c.width=1280;c.height=720;sceneCapture.drawFrame(c.getContext('2d'),null,null,c.width,c.height);
  const recentBlob=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));
  for(let i=0;i<60;i++){
   window.dedupStage='frame '+i;
   recentScenes.clear();recentScenes.add({blob:recentBlob,key:'fixture',at:Date.now(),quality:1,change:0,seconds:10});
   await captureFrame(i%2===0);if(i===0)completedFrames.add(frames[0]);
  }
  const stationary={frames:frames.length,skipped:duplicateFrames,completed:completedFrames.has(frames[0])};
  changed=true;await captureFrame(true);const afterChange=frames.length;
  readVideoTime=async()=>({available:true,videoKey:'another-video',seconds:10});await captureFrame(true);
  image.close();return {stationary,afterChange,afterVideoChange:frames.length,fresh:currentFrame.videoKey};
 })()`);
 assert.deepEqual(result.stationary,{frames:1,skipped:59,completed:true});assert.equal(result.afterChange,2);assert.equal(result.afterVideoChange,3);assert.equal(result.fresh,'another-video');
 clearInterval(progress);console.log(JSON.stringify(result));app.exit(0);
 }catch(error){console.error(error);app.exit(1);}});
