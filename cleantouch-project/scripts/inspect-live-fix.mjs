import fs from 'node:fs/promises';
const pages=await(await fetch('http://127.0.0.1:'+(process.env.CLEANTOUCH_DEBUG_PORT||9225)+'/json')).json(),page=pages.find(p=>p.title==='CleanTouch'&&p.type==='page');if(!page)throw Error('Preview missing');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;
async function evaluate(expression){const current=++id;return new Promise((r,j)=>{const listener=e=>{const data=JSON.parse(e.data);if(data.id!==current)return;ws.removeEventListener('message',listener);if(data.error||data.result.exceptionDetails)j(Error(JSON.stringify(data.error||data.result.exceptionDetails)));else r(data.result.result.value);};ws.addEventListener('message',listener);ws.send(JSON.stringify({id:current,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true,userGesture:true}}));});}
try{
 const action=process.argv[2]||'state';
 if(action==='start')text(await evaluate(`(async()=>{await startCapture();return {phase,plan:capturePlan,time:videoTime,error:ui.detail.textContent}})()`));
 if(action==='sample'){
  const data=await evaluate(`(async()=>{await captureFrame(true);const bytes=new Uint8Array(await currentFrame.blob.arrayBuffer());let b='';for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.subarray(i,i+8192));return {image:btoa(b),seconds:currentFrame.seconds,estimated:currentFrame.timeEstimated,videoKey:currentFrame.videoKey,plan:capturePlan,media:await bridge.getVideoTime(),frames:frames.map(f=>({seconds:f.seconds,at:f.capturedAt,estimated:f.timeEstimated})).slice(-12),buffer:recentScenes.items.length};})()`);
  if(!data.plan?.linked||data.plan.blocked)throw Error('Verified visible video required; desktop image will not be saved.');
  await fs.writeFile('artifacts/verification/live-fix-scene.jpg',Buffer.from(data.image,'base64'));delete data.image;text(data);
 }
 if(action==='scan')text(await evaluate(`(async()=>{const f=await captureFrame(true);await scanFrame(f);return {seconds:f.seconds,products:[...found.values()].map(p=>({label:p.label,box:p.box,sightings:p.sightings.map(s=>s.seconds)}))};})()`));
 if(action==='stop')text(await evaluate(`(async()=>{await stopCapture(true);return {phase,frames:frames.length}})()`));
 if(action==='reload')text(await evaluate(`(async()=>{await stopCapture(true);location.reload();return 'reloading';})()`));
 if(action==='quit')text(await evaluate(`bridge.setWindowLayout('dashboard').then(()=>{window.close();return 'closed diagnostic preview';})`));
 if(action==='state')text(await evaluate(`(async()=>({phase,model:ui.serverStatus.textContent,media:await bridge.getVideoTime(),geometry:await bridge.getCaptureGeometry(),frames:frames.map(f=>({seconds:f.seconds,at:f.capturedAt})).slice(-5)}))()`));
 if(action==='status')text(await evaluate(`({phase,detail:ui.detail.textContent,pendingLabels:aiPending.size,precisionChecks,precisionBackoff,notice:lastNotice,products:[...found.values()].map(p=>p.label)})`));
 if(action==='export'){
  const data=await evaluate(`(async()=>{const items=[];for(const p of found.values()){const bytes=new Uint8Array(await p.imageBlob.arrayBuffer());let b='';for(let i=0;i<bytes.length;i+=8192)b+=String.fromCharCode(...bytes.subarray(i,i+8192));items.push({label:p.label,data:btoa(b),type:p.imageBlob.type,sightings:p.sightings.map(s=>s.seconds)});}return items;})()`);
  for(let i=0;i<data.length;i++){const p=data[i];await fs.writeFile('artifacts/verification/live-fix-product-'+i+(p.type==='image/png'?'.png':'.jpg'),Buffer.from(p.data,'base64'));delete p.data;}text(data);
 }
}finally{ws.close();}
function text(v){console.log(JSON.stringify(v));}
