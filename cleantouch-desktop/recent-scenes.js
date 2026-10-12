(()=>{
 class RecentScenes {
  constructor({duration=6000,maxBytes=24*1024*1024,maxFrames=60}={}){Object.assign(this,{duration,maxBytes,maxFrames});this.clear();}
  clear(){this.items=[];this.bytes=0;}
  add(item){if(!item.blob?.size||item.blob.size>this.maxBytes)return;this.items.push(item);this.bytes+=item.blob.size;while(this.items.length&&(this.items.length>this.maxFrames||this.bytes>this.maxBytes||item.at-this.items[0].at>this.duration))this.bytes-=this.items.shift().blob.size;}
  select({now=Date.now(),key,limit=6}={}){const items=this.items.filter(x=>now-x.at<=this.duration&&x.key===key);if(!items.length)return [];const chosen=[],start=items[0].at,span=Math.max(1,now-start);for(let b=0;b<limit-1;b++){const group=items.filter(x=>Math.floor((x.at-start)/span*(limit-1))===b);if(group.length)chosen.push(group.reduce((a,c)=>c.quality+c.change*.3>a.quality+a.change*.3?c:a));}chosen.push(items.at(-1));return [...new Set(chosen)].sort((a,b)=>a.at-b.at).slice(-limit);}
 }
 window.RecentScenes=RecentScenes;window.recentScenes=new RecentScenes();
 let pending=false,last=0,previous=null,lastKey='',epoch=0;
 window.clearRecentScenes=()=>{epoch++;recentScenes.clear();previous=null;lastKey='';};
 async function sample(at){
  if(pending||at-last<100||!stream||capturePaused||captureStopping||ui.video.readyState<2||!capturePlan?.linked||capturePlan.blocked)return;
  last=at;pending=true;const token=epoch,sourceStream=stream,key=videoTime.videoKey||'unlinked';
  try{
   if(key!==lastKey){recentScenes.clear();previous=null;lastKey=key;}
   const c=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(capturePlan.source.width,capturePlan.source.height));c.width=Math.max(1,Math.round(capturePlan.source.width*scale));c.height=Math.max(1,Math.round(capturePlan.source.height*scale));sceneCapture.drawFrame(c.getContext('2d'),ui.video,capturePlan,c.width,c.height);
   const tiny=document.createElement('canvas');tiny.width=48;tiny.height=48;const ctx=tiny.getContext('2d',{willReadFrequently:true});ctx.drawImage(c,0,0,48,48);const pixels=ctx.getImageData(0,0,48,48).data;let quality=0,change=0;for(let i=4;i<pixels.length;i+=4){quality+=Math.abs(pixels[i]-pixels[i-4]);if(previous)change+=Math.abs(pixels[i]-previous[i]);}previous=pixels;
   const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.92));if(token!==epoch||sourceStream!==stream||capturePaused||captureStopping||!capturePlan?.linked||capturePlan.blocked)return;
   recentScenes.add({blob,at:Date.now(),key,quality:quality/2304,change:change/2304,seconds:videoTime.seconds,videoOnly:true});
  }finally{pending=false;}
 }
 function tick(at){sample(at).catch(()=>{});requestAnimationFrame(tick);}requestAnimationFrame(tick);
})();
