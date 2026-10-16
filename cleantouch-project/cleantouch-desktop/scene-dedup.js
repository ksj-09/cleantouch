(function(root){
 const SIZE=96;
 function same(a,b){
  if(!a||!b||a.pixels?.length!==SIZE*SIZE*4||b.pixels?.length!==SIZE*SIZE*4||Math.abs(a.aspect-b.aspect)>.01)return false;
  let total=0,changed=0;const tiles=new Float64Array(144);
  for(let p=0;p<SIZE*SIZE;p++){
   const i=p*4,d=Math.max(Math.abs(a.pixels[i]-b.pixels[i]),Math.abs(a.pixels[i+1]-b.pixels[i+1]),Math.abs(a.pixels[i+2]-b.pixels[i+2]));
   total+=d;if(d>18)changed++;tiles[Math.floor(p/SIZE/8)*12+Math.floor(p%SIZE/8)]+=d;
  }
  // Conservative colour-aware comparison: local changes matter even if the
  // rest of the screen is static. Compare against the retained scene, not the
  // previous sample, so slow changes cannot disappear through drift.
  return total/(SIZE*SIZE)<=1.5&&changed/(SIZE*SIZE)<=.008&&tiles.every(sum=>sum/64<=10);
 }
 async function signature(blob){
  const bitmap=await createImageBitmap(blob);
  try{const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,SIZE,SIZE);return {pixels:ctx.getImageData(0,0,SIZE,SIZE).data,aspect:bitmap.width/bitmap.height};}
  finally{bitmap.close();}
 }
 function describe(s){
  if(!s?.pixels||s.pixels.length!==SIZE*SIZE*4)return null;
  if(s.description)return s.description;
  const histogram=new Float64Array(64);let detail=0;
  for(let p=0;p<SIZE*SIZE;p++){
   const i=p*4,r=s.pixels[i],g=s.pixels[i+1],b=s.pixels[i+2];
   histogram[(r>>6)*16+(g>>6)*4+(b>>6)]++;
   if(p%SIZE)for(let c=0;c<3;c++)detail+=Math.abs(s.pixels[i+c]-s.pixels[i-4+c]);
  }
  return s.description={histogram,quality:detail/(SIZE*(SIZE-1)*3)};
 }
 function difference(a,b){
  const da=describe(a),db=describe(b);
  if(!da||!db||Math.abs(a.aspect-b.aspect)>.01)return null;
  let mean=0,changed=0,histogram=0;const tiles=new Float64Array(144);
  for(let p=0;p<SIZE*SIZE;p++){
   const i=p*4,d=Math.max(Math.abs(a.pixels[i]-b.pixels[i]),Math.abs(a.pixels[i+1]-b.pixels[i+1]),Math.abs(a.pixels[i+2]-b.pixels[i+2]));
   mean+=d;if(d>24)changed++;tiles[Math.floor(p/SIZE/8)*12+Math.floor(p%SIZE/8)]+=d;
  }
  for(let i=0;i<64;i++)histogram+=Math.abs(da.histogram[i]-db.histogram[i]);
  return {mean:mean/(SIZE*SIZE),changed:changed/(SIZE*SIZE),histogram:histogram/(SIZE*SIZE*2),local:Math.max(...tiles)/64,quality:db.quality};
 }
 // Screen observation is independent of expensive archive analysis. Keep a
 // bounded set of representative images, never one image per chat request.
 class SceneCollector{
  constructor(){this.reset();}
  reset(){this.credit=3;this.refillAt=null;this.lastSavedAt=null;}
  decide(frame,frames,{canReplace=true,isCompleted=()=>false}={}){
   const now=Number.isFinite(frame.capturedAt)?frame.capturedAt:0;
   if(this.refillAt===null)this.refillAt=now;
   this.credit=Math.min(3,this.credit+Math.max(0,now-this.refillAt)/3000);this.refillAt=Math.max(now,this.refillAt);
   const previous=frames.at(-1),matching=frames.map((f,index)=>({f,index})).slice(-48).reverse().find(({f})=>f.videoKey===frame.videoKey&&((frame.fingerprint&&f.fingerprint===frame.fingerprint)||same(f.visualSignature,frame.visualSignature)));
   if(matching)return {action:'duplicate',index:matching.index,reason:'unchanged'};
   const delta=previous&&previous.videoKey===frame.videoKey?difference(previous.visualSignature,frame.visualSignature):null;
   const elapsed=this.lastSavedAt===null?Infinity:now-this.lastSavedAt;
   const cut=!previous||previous.videoKey!==frame.videoKey||!delta||(delta.histogram>.28&&delta.mean>20)||(delta.mean>65&&delta.changed>.7);
   const local=delta&&delta.local>35&&delta.changed<.12&&delta.mean>.35;
   // A hard cut or a localized new object can use the small burst budget.
   // Ordinary motion gets at most one representative every four seconds.
   const due=!previous||((cut||local)?elapsed>=750:elapsed>=4000);
   if(due&&this.credit>=1){this.credit--;this.lastSavedAt=now;return {action:'append',reason:cut?'cut':local?'local-change':'interval'};}
   const quality=describe(frame.visualSignature)?.quality||0,oldQuality=describe(previous?.visualSignature)?.quality||0;
   if(delta&&!cut&&canReplace&&!isCompleted(previous)&&quality>oldQuality*1.12&&quality>oldQuality+1){
    return {action:'replace',index:frames.length-1,reason:'sharper'};
   }
   return {action:'skip',reason:due?'budget':'same-segment'};
  }
 }
 function evidenceFor(frame,candidates){
  const seen=new Set();return candidates.filter(f=>{
   if(!f?.blob||f===frame||f.videoKey!==frame.videoKey||!Number.isFinite(f.capturedAt)||Math.abs(f.capturedAt-frame.capturedAt)>2200||f.capturedAt===frame.capturedAt||seen.has(f.capturedAt))return false;
   seen.add(f.capturedAt);return true;
  }).sort((a,b)=>Math.abs(a.capturedAt-frame.capturedAt)-Math.abs(b.capturedAt-frame.capturedAt)).slice(0,2).map(f=>({blob:f.blob,videoKey:f.videoKey,capturedAt:f.capturedAt,seconds:f.seconds,videoOnly:f.videoOnly,videoTitle:f.videoTitle,timeEstimated:f.timeEstimated}));
 }
 function frameBytes(frame){return (frame?.blob?.size||0)+(frame?.evidenceFrames||[]).reduce((sum,f)=>sum+(f.blob?.size||0),0);}
 function compact(frames,isCompleted=()=>false){
  const collector=new SceneCollector(),selected=[];
  for(const frame of frames){
   // Preserve completed objects by identity; their existing results remain valid.
   if(isCompleted(frame)){selected.push(frame);continue;}
   const decision=collector.decide(frame,selected,{isCompleted});
   if(decision.action==='append')selected.push({...frame,evidenceFrames:evidenceFor(frame,[...(frame.evidenceFrames||[]),...frames.filter(f=>Math.abs(f.capturedAt-frame.capturedAt)<=2200)])});
   else if(decision.action==='replace'){const previous=selected[decision.index];selected[decision.index]={...frame,evidenceFrames:evidenceFor(frame,[previous,...(previous.evidenceFrames||[]),...(frame.evidenceFrames||[])])};}
  }
  return selected;
 }
 const api={same,signature,difference,SceneCollector,evidenceFor,frameBytes,compact};if(typeof module!=='undefined')module.exports=api;else root.cleanTouchSceneDedup=api;
})(globalThis);
