const {app,BrowserWindow,ipcMain,protocol}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
app.setPath('userData',require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(),'cleantouch-selection-')));
protocol.registerSchemesAsPrivileged([{scheme:'cleantouch',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
app.whenReady().then(async()=>{try{
 protocol.handle('cleantouch',async request=>{const file=path.join(root,new URL(request.url).pathname.slice(1));return new Response(await fs.readFile(file),{headers:{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream'}});});
 for(const method of ['get','activity'])ipcMain.handle('updates:'+method,()=>({status:'unsupported'}));ipcMain.handle('chats:list',()=>[]);ipcMain.handle('video:time',()=>({available:false}));
 const win=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'preload.cjs'),sandbox:true,contextIsolation:true,backgroundThrottling:false}});await win.loadURL('cleantouch://app/index.html');
 const result=await win.webContents.executeJavaScript(`(async()=>{
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#e9cf9c';ctx.fillRect(0,0,256,256);ctx.fillStyle='#4e3598';ctx.fillRect(64,64,132,132);const blob=await new Promise(r=>c.toBlob(r,'image/png'));
  getProductObjectDetector=async()=>null;selectedObjectRegions=()=>[];glowingObjectRegions=()=>[];
  getInteractiveSegmenter=async()=>({setImage(){},segment(){const values=new Float32Array(64*64).fill(.01);for(let y=16;y<=48;y++)for(let x=16;x<=48;x++)values[y*64+x]=.6;return {width:64,height:64,getAsFloat32Array:()=>values,close(){}};}});
  const isolated=await isolateTappedObject(blob,[.5,.5]);if(!isolated)throw Error('No mask');const image=await createImageBitmap(isolated),out=document.createElement('canvas');out.width=image.width;out.height=image.height;const context=out.getContext('2d');context.drawImage(image,0,0);image.close();const center=[...context.getImageData(Math.floor(out.width/2),Math.floor(out.height/2),1,1).data];
  const corner=[...context.getImageData(0,0,1,1).data];const background=await isolateTappedObject(blob,[.1,.1]);
  const frame={blob,videoOnly:true,videoKey:'a',capturedAt:1000};frames=[{blob,videoOnly:true,videoKey:'a',capturedAt:500},frame,{blob,videoOnly:true,videoKey:'b',capturedAt:1100},{blob,videoOnly:true,videoKey:'a',capturedAt:9000}];
  const evidence=await buildSelectedProductEvidence(frame,isolated.selectionBox);const uploaded=await buildSelectedProductEvidence({blob},isolated.selectionBox);
  return {center,corner,backgroundRejected:background===null,box:isolated.selectionBox,evidence:evidence.length,uploaded:uploaded.length};
 })()`);
 assert.deepEqual(result.center,[78,53,152,255]);assert.equal(result.corner[3],0);assert.equal(result.backgroundRejected,true);assert.equal(result.evidence,2);assert.equal(result.uploaded,1);assert(result.box[0]<.5&&result.box[2]>.5);
 console.log(JSON.stringify(result));app.exit(0);
 }catch(error){console.error(error);app.exit(1);}});
