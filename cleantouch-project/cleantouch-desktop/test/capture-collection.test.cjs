const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const dedup=require('../scene-dedup');
function setup(){
 let now=100000,value=60,signatures=0;
 const stream={},frames=[],pixels=()=>{const p=new Uint8ClampedArray(96*96*4);for(let i=0;i<p.length;i+=4){p[i]=p[i+1]=p[i+2]=value;p[i+3]=255;}return {pixels:p,aspect:16/9};};
 const c={stream,frames,captureEpoch:1,capturePending:null,captureBusy:false,startedAt:now,currentFrame:null,capturePaused:false,collectionError:'',duplicateFrames:0,collectedBytes:0,COLLECTION_LIMIT:250*1024*1024,phase:'capturing',batchStarting:false,completedFrames:new WeakSet(),sceneCollector:new dedup.SceneCollector(),crypto:{randomUUID:()=>String(now)},Date:{now:()=>now},Math,Blob,HTMLMediaElement:{HAVE_CURRENT_DATA:2},ui:{video:{readyState:2,videoWidth:1920,videoHeight:1080},widgetPreview:{querySelector:()=>({})}},document:{createElement:()=>({getContext:()=>({}),toBlob:cb=>cb(new Blob(['real frame bytes']))})},sceneCapture:{drawFrame(){}},refresh(){},readVideoTime:async()=>({available:true,videoKey:'a',seconds:(now-100000)/1000}),updateCapturePlan:async()=>({linked:true,source:{width:1920,height:1080},trackVideo:true,scene:{key:'a'}}),window:{cleanTouchSceneDedup:{...dedup,signature:async()=>{signatures++;return pixels();}}}};
 c.cleanTouchSceneDedup=c.window.cleanTouchSceneDedup;vm.createContext(c);const source=fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8');vm.runInContext(source.slice(source.indexOf('async function captureFrame('),source.indexOf('async function startCapture()')),c);
 return {c,set:(ms,v)=>{now=100000+ms;value=v;},signatures:()=>signatures};
}
test('reading current screen for chat or direct selection never adds archive jobs',async()=>{
 const h=setup();await h.c.captureFrame();assert.equal(h.c.frames.length,1);
 for(let i=1;i<=80;i++){h.set(i*10,60+i);const current=await h.c.captureFrame(true);assert(current.blob);assert.equal(current.capturedAt,i*10);}
 assert.equal(h.c.frames.length,1);assert.equal(h.signatures(),1);
});
test('automatic collection uses the engine and paused reads do not append',async()=>{
 const h=setup();for(let i=0;i<60;i++){h.set(i*1000,60+i*2);await h.c.captureFrame();}assert(h.c.frames.length<=16,h.c.frames.length);
 const count=h.c.frames.length;h.c.capturePaused=true;h.set(70000,240);await h.c.captureFrame();assert.equal(h.c.frames.length,count);
});
