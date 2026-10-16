import fs from 'node:fs/promises';
import path from 'node:path';
const pages=await(await fetch('http://127.0.0.1:9225/json')).json();
const page=pages.find(p=>p.type==='page'&&p.title==='CleanTouch');
if(!page)throw Error('No live CleanTouch window');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;
function evaluate(expression){const request=++id;return new Promise((resolve,reject)=>{const listener=event=>{const data=JSON.parse(event.data);if(data.id!==request)return;socket.removeEventListener('message',listener);if(data.error||data.result.exceptionDetails)reject(Error(JSON.stringify(data.error||data.result.exceptionDetails)));else resolve(data.result.result.value);};socket.addEventListener('message',listener);socket.send(JSON.stringify({id:request,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true,userGesture:true}}));});}
try{
  await evaluate('checkServer()');
  const geometry=await evaluate('bridge.getCaptureGeometry()');
  console.log(JSON.stringify({stage:'live-video-region',scene:geometry.scene,monitor:geometry.monitor}));
  if(!geometry.scene.available)throw Error('Live video region is unavailable');
  await evaluate('startCapture()');
  await new Promise(resolve=>setTimeout(resolve,1800));
  const captured=await evaluate(`(async()=>{
    await captureFrame();
    if(!currentFrame)throw Error(collectionError||'No captured frame');
    const bitmap=await createImageBitmap(currentFrame.blob);const width=bitmap.width,height=bitmap.height;bitmap.close();
    const bytes=new Uint8Array(await currentFrame.blob.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
    return {image:btoa(binary),width,height,frames:frames.length,plan:capturePlan,time:currentFrame.seconds,title:currentFrame.videoTitle};
  })()`);
  await fs.writeFile(path.resolve('..','artifacts','verification','live-clean-video.jpg'),Buffer.from(captured.image,'base64'));
  delete captured.image;console.log(JSON.stringify({stage:'live-captured',...captured}));
  if(!captured.plan.linked||captured.width>600||captured.height<400)throw Error('Expected the actual portrait video, not the desktop');
  const result=await evaluate(`(async()=>{await analyzeAllScenes();return {phase,frames:frames.length,products:[...found.values()].map(p=>({label:p.label,sightings:p.sightings.length})),error:ui.detail.textContent};})()`);
  console.log(JSON.stringify({stage:'live-results',...result}));
  await fs.writeFile(path.resolve('..','artifacts','verification','live-screen-results.json'),JSON.stringify({capture:captured,result},null,2));
  if(result.phase!=='review'||!result.products.length||result.products.some(p=>p.label==='마우스'||p.label==='노트북'))throw Error('Live analysis still contains interface false positives');
  if(result.products.filter(p=>p.label==='보라색 광선검').length!==1)throw Error('The same visible lightsaber was listed more than once');
}finally{socket.close();}
