const {test}=require('node:test');const assert=require('node:assert/strict');const {planCapture}=require('../scene-capture');
const geometry={monitor:{x:0,y:0,width:1920,height:1080},scene:{available:true,rect:{x:900,y:200,width:400,height:720}},excluded:[]};
test('only the video player enters analysis, independent of browser toolbars',()=>{
  const plan=planCapture(1920,1080,geometry);assert.deepEqual(plan.source,{x:900,y:200,width:400,height:720});assert.equal(plan.linked,true);
});
test('a video covered by an unrelated app is never saved as a product scene',()=>{
  assert.equal(planCapture(1920,1080,{...geometry,scene:{...geometry.scene,occluded:true}}).blocked,true);
});
test('even a partially covered video is rejected instead of producing incomplete product crops',()=>{
  const small=planCapture(1920,1080,{...geometry,excluded:[{x:1150,y:700,width:180,height:150}]});assert.equal(small.blocked,true);
  const large=planCapture(1920,1080,{...geometry,excluded:[{x:500,y:0,width:1300,height:1000}]});assert.equal(large.blocked,true);
});
test('unlinked desktop preview still masks CleanTouch itself',()=>{
 const plan=planCapture(1920,1080,{monitor:geometry.monitor,excluded:[{x:0,y:0,width:200,height:200}]});assert.equal(plan.blocked,false);assert.equal(plan.masks.length,1);
});
test('video tracking fails closed instead of scanning an unrelated full desktop when region detection is stale',()=>{
 const plan=planCapture(1920,1080,{monitor:geometry.monitor,scene:{available:false},trackVideo:true});assert.equal(plan.blocked,true);assert.match(plan.reason,/영상 위치/);
});
test('physical screen coordinates map correctly on scaled and secondary displays',()=>{
  const plan=planCapture(1280,720,{monitor:{x:-1920,y:0,width:1920,height:1080},scene:{available:true,rect:{x:-1500,y:150,width:600,height:750}}});
  assert.deepEqual(plan.source,{x:280,y:100,width:400,height:500});
});
test('invalid geometry and a player split across displays are rejected instead of producing broken crops',()=>{
 assert.equal(planCapture(1920,1080,{...geometry,monitor:{x:0,y:0,width:0,height:1080}}).blocked,true);
 assert.equal(planCapture(1920,1080,{...geometry,scene:{available:true,rect:{x:900,y:200,width:NaN,height:720}}}).blocked,true);
 assert.equal(planCapture(1920,1080,{...geometry,scene:{available:true,rect:{x:1800,y:200,width:400,height:720}}}).blocked,true);
});
