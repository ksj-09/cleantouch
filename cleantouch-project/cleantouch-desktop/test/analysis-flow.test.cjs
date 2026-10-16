const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../renderer.js'),'utf8');
function extract(name,next){const start=source.indexOf(`async function ${name}(`);return source.slice(start,source.indexOf(`\nasync function ${next}(`,start));}
function batch(){
 const ctx={phase:'review',liveBusy:false,frames:[{id:1},{id:2}],scanGeneration:1,cursor:0,retryAt:0,completedFrames:new WeakSet(),stream:{},precisionOmitted:0,refresh(){},ui:{detail:{}},message:e=>e.message,setTimeout,Date,Map};
 vm.createContext(ctx);vm.runInContext(extract('analyze','analyzeAllScenes'),ctx);return ctx;
}
test('all analysis has a finite snapshot even when the capture collection changes',async()=>{
 const ctx=batch(),seen=[];ctx.scanFrame=async frame=>{seen.push(frame.id);if(frame.id===1)ctx.frames=[{id:99}];};
 await ctx.analyze();assert.deepEqual(seen,[1,2]);assert.equal(ctx.phase,'review');assert.equal(ctx.cursor,2);
});
test('failed analysis keeps its cursor and reports the error for retry',async()=>{
 const ctx=batch();ctx.scanFrame=async frame=>{if(frame.id===2)throw Error('connection lost');ctx.completedFrames.add(frame);};
 await ctx.analyze();assert.equal(ctx.phase,'paused');assert.equal(ctx.cursor,1);assert.match(ctx.lastNotice,/connection lost/);
 const seen=[];ctx.scanFrame=async frame=>seen.push(frame.id);await ctx.analyze();assert.deepEqual(seen,[2]);assert.equal(ctx.phase,'review');assert.equal(ctx.lastNotice,'');
});
test('canceling a batch during an AI response never overwrites the canceled state',async()=>{
 const ctx=batch();let finish;ctx.scanFrame=()=>new Promise(r=>finish=r);const work=ctx.analyze();ctx.scanGeneration++;ctx.phase='paused';finish();await work;assert.equal(ctx.phase,'paused');assert.equal(ctx.cursor,0);
});
test('canceling product selection while cropping prevents a late Lens launch',async()=>{
 let finish,opened=0;const ctx={focusFrame:{blob:{}},focusRect:[0,0,1,1],focusPoint:null,focusGeneration:1,liveBusy:false,ui:{submitFocus:{},focusHint:{}},refresh(){},cropImage:()=>new Promise(r=>finish=r),bridge:{searchVisual:async()=>opened++}};
 vm.createContext(ctx);vm.runInContext(extract('analyzeSelectedFocus','analyze'),ctx);
 const work=ctx.analyzeSelectedFocus('lens');ctx.focusGeneration++;ctx.focusFrame=null;ctx.liveBusy=true;finish(new Blob(['photo']));await work;
 assert.equal(opened,0);assert.equal(ctx.liveBusy,true,'old selection must not unlock a newer operation');
});
