const {test}=require('node:test'),assert=require('node:assert/strict');
const {SceneCollector}=require('../scene-dedup');
const {compact,evidenceFor,frameBytes}=require('../scene-dedup');
function image(value=100,detail=0){const pixels=new Uint8ClampedArray(96*96*4);for(let p=0;p<96*96;p++){const i=p*4;pixels[i]=pixels[i+1]=pixels[i+2]=value+(p%2?detail:0);pixels[i+3]=255;}return {pixels,aspect:16/9};}
function frame(at,signature=image(),key='a'){return {capturedAt:at,visualSignature:signature,videoKey:key};}
function apply(collector,frames,f,options){const d=collector.decide(f,frames,options);if(d.action==='append')frames.push(f);if(d.action==='replace')frames[d.index]=f;return d;}
test('paused or repeated images, including a loop back, are not separate analysis jobs',()=>{
 const c=new SceneCollector(),frames=[];apply(c,frames,frame(0));apply(c,frames,frame(1000,image(240)));assert.equal(frames.length,2);
 for(let at=2000;at<=60000;at+=1000)apply(c,frames,frame(at));assert.equal(frames.length,2);
});
test('a minute of continuous motion produces representative images rather than sixty jobs',()=>{
 const c=new SceneCollector(),frames=[];for(let at=0;at<60000;at+=1000)apply(c,frames,frame(at,image(60+at/1000*2,8)));
 assert(frames.length>=10);assert(frames.length<=16,frames.length);
});
test('rapid cuts have a bounded burst budget even with many calls in one second',()=>{
 const c=new SceneCollector(),frames=[];for(let at=0;at<60000;at+=100)apply(c,frames,frame(at,image(at%251),String(at)));
 assert(frames.length<=23,frames.length);assert(frames.length>15);
});
test('a sharper representative replaces a blurred image without adding another job',()=>{
 const c=new SceneCollector(),frames=[];apply(c,frames,frame(0,image(100,3)));const d=apply(c,frames,frame(1000,image(100,8)));assert.equal(d.action,'replace');assert.equal(frames.length,1);assert.equal(frames[0].capturedAt,1000);
});
test('completed or in-flight frames never change underneath analysis',()=>{
 for(const options of [{isCompleted:()=>true},{canReplace:false}]){const c=new SceneCollector(),frames=[];apply(c,frames,frame(0,image(100,3)));apply(c,frames,frame(1000,image(100,8)),options);assert.equal(frames[0].capturedAt,0);}
});
test('a localized new object gets a representative without waiting for the periodic interval',()=>{
 const c=new SceneCollector(),frames=[];apply(c,frames,frame(0));const s=image();for(let y=40;y<48;y++)for(let x=40;x<48;x++)s.pixels[(y*96+x)*4]=240;assert.equal(apply(c,frames,frame(1000,s)).action,'append');
});
test('different videos cannot deduplicate one another; resetting starts a fresh budget',()=>{
 const c=new SceneCollector(),frames=[];apply(c,frames,frame(0));assert.equal(apply(c,frames,frame(1000,image(),'b')).action,'append');c.reset();assert.equal(c.decide(frame(0),[]).action,'append');
});
test('old archives compact without changing completed frames or losing adjacent evidence',()=>{
 const raw=Array.from({length:60},(_,i)=>({...frame(i*1000,image(60+i*2)),blob:new Blob(['frame-'+i])}));
 const completed=raw[0],result=compact(raw,f=>f===completed);
 assert.equal(result[0],completed);assert(result.length<=17,result.length);assert.equal(raw.length,60);
 assert(result.slice(1).some(f=>f.evidenceFrames.length===2));assert(!raw[1].evidenceFrames);
 for(const f of result)for(const e of f.evidenceFrames||[]){assert.equal(e.videoKey,f.videoKey);assert(Math.abs(e.capturedAt-f.capturedAt)<=2200);assert(!e.evidenceFrames);}
});
test('supporting evidence is bounded, counted in memory, and cannot cross video identities',()=>{
 const base={...frame(5000),blob:new Blob(['base'])},candidates=Array.from({length:10},(_,i)=>({...frame(i*1000),blob:new Blob(['support'])}));
 candidates.push({...frame(5500,image(),'other'),blob:new Blob(['private'])});
 const evidence=evidenceFor(base,candidates);assert.equal(evidence.length,2);assert(evidence.every(f=>f.videoKey==='a'));assert.equal(frameBytes({...base,evidenceFrames:evidence}),18);
});
