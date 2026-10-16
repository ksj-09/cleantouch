const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../renderer.js'),'utf8');
function functionSource(name,next){return source.slice(source.indexOf(`async function ${name}(`),source.indexOf(`\n${next}`,source.indexOf(`async function ${name}(`)));}
const linked={linked:true,blocked:false,source:{x:0,y:0,width:400,height:700}};
function harness(plan=linked){
 const ctx={stream:{},captureEpoch:1,capturePlanRequest:0,capturePending:null,captureBusy:false,startedAt:Date.now(),currentFrame:{id:'previous'},duplicateFrames:0,capturePaused:false,captureStopping:false,collectionFull:false,collectedBytes:0,COLLECTION_LIMIT:1024,frames:[],completedFrames:new WeakSet(),HTMLMediaElement:{HAVE_CURRENT_DATA:2},crypto:require('node:crypto').webcrypto,
  ui:{video:{readyState:2,videoWidth:400,videoHeight:700},widgetPreview:{querySelector:()=>({hidden:false})}},
  readVideoTime:async()=>({available:false}),updateCapturePlan:async()=>plan,refresh(){},window:{},sceneCapture:{drawFrame(){}},elapsedSeconds:()=>1,
  document:{createElement:()=>({getContext:()=>({}),toBlob(callback){ctx.completeBlob=()=>callback(new Blob(['image']));}})},Date,Math,Promise,Blob};
 const dedup=require('../scene-dedup');ctx.cleanTouchSceneDedup=dedup;ctx.window.cleanTouchSceneDedup=dedup;ctx.sceneCollector=new dedup.SceneCollector();ctx.phase='capturing';ctx.batchStarting=false;
 vm.createContext(ctx);vm.runInContext(functionSource('captureFrame','async function startCapture'),ctx);return ctx;
}
test('an explicit fresh capture does not reuse an older scene when video is blocked or unavailable',async()=>{
 const ctx=harness({blocked:true,reason:'covered'});
 assert.equal(await ctx.captureFrame(true),null);assert.equal(ctx.currentFrame.id,'previous');assert.equal(ctx.frames.length,0);
 ctx.ui.video.readyState=0;assert.equal(await ctx.captureFrame(true),null);
});
test('canceling capture startup releases a late native stream and never starts collection',async()=>{
 let resolveCapture,stopped=0,grants=0;
 const ctx={starting:false,phase:'idle',captureEpoch:0,capturePlan:null,lastNotice:'',stream:null,captureTimer:null,liveBusy:false,
  window:{cleanTouchPermissions:{request:async()=>true,revoke(){}}},bridge:{updateActivity:async()=>({status:'unsupported'}),authorizeCapture:async()=>{grants++;},revokeCapture:async()=>{}},
  navigator:{mediaDevices:{getDisplayMedia:()=>new Promise(r=>resolveCapture=r)}},ui:{video:{srcObject:null,hidden:true}},refresh(){},clearInterval(){},message:e=>e.message};
 vm.createContext(ctx);vm.runInContext(functionSource('startCapture','async function stopCapture'),ctx);
 const pending=ctx.startCapture();while(!resolveCapture)await Promise.resolve();ctx.captureEpoch++;resolveCapture({getTracks:()=>[{stop:()=>stopped++}]});await pending;
 assert.equal(grants,1);assert.equal(stopped,1);assert.equal(ctx.stream,null);assert.equal(ctx.phase,'idle');assert.equal(ctx.starting,false);
});
test('canceling before authorization never invokes native capture',async()=>{
 let finish,grants=0,captures=0;
 const ctx={starting:false,phase:'idle',captureEpoch:0,capturePlan:null,lastNotice:'',stream:null,captureTimer:null,liveBusy:false,
  window:{cleanTouchPermissions:{request:async()=>true,revoke(){}}},bridge:{updateActivity:()=>new Promise(r=>finish=r),authorizeCapture:async()=>{grants++;},revokeCapture:async()=>{}},navigator:{mediaDevices:{getDisplayMedia:async()=>{captures++;}}},ui:{video:{srcObject:null,hidden:true}},refresh(){},clearInterval(){},message:e=>e.message};
 vm.createContext(ctx);vm.runInContext(functionSource('startCapture','async function stopCapture'),ctx);const pending=ctx.startCapture();while(!finish)await Promise.resolve();ctx.captureEpoch++;finish({status:'unsupported'});await pending;assert.equal(grants,0);assert.equal(captures,0);assert.equal(ctx.starting,false);
});
test('resetting the capture during image encoding prevents an old frame entering a new session',async()=>{
 const ctx=harness(),work=ctx.captureFrame(true);while(!ctx.completeBlob)await Promise.resolve();
 ctx.captureEpoch++;ctx.stream={};ctx.completeBlob();assert.equal(await work,null);assert.equal(ctx.frames.length,0);assert.equal(ctx.currentFrame.id,'previous');assert.equal(ctx.captureBusy,false);
});
test('a queued capture belonging to an ended session cannot capture its replacement stream',async()=>{
 const ctx=harness(),first=ctx.captureFrame(true);while(!ctx.completeBlob)await Promise.resolve();
 const waiting=ctx.captureFrame(true);ctx.captureEpoch++;ctx.stream={};ctx.completeBlob();
 assert.deepEqual(await Promise.all([first,waiting]),[null,null]);assert.equal(ctx.frames.length,0);
});
test('identical consecutive scenes are analyzed once while direct selection stays fresh',async()=>{
 const ctx=harness();
 const capture=async(fresh=false)=>{ctx.completeBlob=null;const work=ctx.captureFrame(fresh);while(!ctx.completeBlob)await Promise.resolve();ctx.completeBlob();return work;};
 const first=await capture(),second=await capture(true);
 assert.equal(ctx.frames.length,1);assert.notEqual(first.id,second.id);assert.equal(ctx.currentFrame.id,second.id);assert.equal(ctx.collectedBytes,first.blob.size);
 ctx.readVideoTime=async()=>({available:true,videoKey:'different-video',seconds:3});ctx.startedAt-=1000;await capture();assert.equal(ctx.frames.length,2);
});
test('an ended session cannot append a frame after its fingerprint finishes',async()=>{
 const ctx=harness();let finish;ctx.crypto={randomUUID:()=> 'id',subtle:{digest:()=>new Promise(r=>finish=r)}};
 const work=ctx.captureFrame();while(!ctx.completeBlob)await Promise.resolve();ctx.completeBlob();while(!finish)await new Promise(r=>setImmediate(r));ctx.captureEpoch++;finish(new Uint8Array([1]));
 assert.equal(await work,null);assert.equal(ctx.frames.length,0);
});
test('capture geometry failures fail closed even when the IPC returns no geometry',async()=>{
 const ctx={stream:{},captureEpoch:0,capturePlanRequest:0,ui:{video:{videoWidth:1920,videoHeight:1080}},bridge:{getCaptureGeometry:async()=>{throw Error('IPC closed');}},sceneCapture:require('../scene-capture')};
 vm.createContext(ctx);vm.runInContext(functionSource('updateCapturePlan','function previewFrame'),ctx);
 const plan=await ctx.updateCapturePlan();assert.equal(plan.blocked,true);assert.match(plan.reason,/영상 위치/);
 ctx.bridge.getCaptureGeometry=async()=>undefined;assert.equal((await ctx.updateCapturePlan()).blocked,true);
});
test('an obsolete geometry reply cannot replace a newer video region',async()=>{
 let first,second;
 const ctx={stream:{},captureEpoch:0,capturePlanRequest:0,ui:{video:{videoWidth:1920,videoHeight:1080}},bridge:{getCaptureGeometry:()=>new Promise(r=>{if(!first)first=r;else second=r;})},sceneCapture:require('../scene-capture')};
 vm.createContext(ctx);vm.runInContext(functionSource('updateCapturePlan','function previewFrame'),ctx);
 const older=ctx.updateCapturePlan(),newer=ctx.updateCapturePlan();second({scene:{available:true,rect:{x:100,y:100,width:300,height:500}}});await newer;
 first({scene:{available:true,rect:{x:900,y:100,width:300,height:500}}});await older;assert.equal(ctx.capturePlan.source.x,100);
});
