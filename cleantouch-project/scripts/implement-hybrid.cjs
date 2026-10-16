const fs=require('node:fs');
const edit=(file,fn)=>fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')));
fs.writeFileSync('cleantouch-desktop/live-screen.js',`(()=>{
 let ready=false,generation=0,busy=false,callbacks=null,history=[];
 function stop(){generation++;ready=false;busy=false;history=[];callbacks=null;}
 async function start(next){stop();callbacks=next;ready=true;next.onReady();next.onStatus('화면을 기기에서 계속 수집합니다 · 질문할 때 최근 장면만 AI로 전송 · 마이크·소리 전송 없음');}
 async function ask(text){
  if(!ready||busy)throw Error(busy?'이전 질문을 분석하고 있어요.':'화면 공유를 먼저 시작해 주세요.');
  const token=generation,notify=callbacks;busy=true;
  try{
   if(!stream)throw Error('화면 공유가 종료됐어요. 다시 시작해 주세요.');
   await updateCapturePlan();if(!capturePlan?.linked||capturePlan.blocked)throw Error('영상이 가려져 있어요. 영상을 화면에 띄워 주세요.');
   await captureFrame();if(token!==generation)return;if(!capturePlan?.linked||capturePlan.blocked||!currentFrame?.videoOnly)throw Error('현재 영상 장면을 확인하지 못했어요.');
   const selected=recentScenes.select({key:videoTime.videoKey||'unlinked'});
   const blobs=[...selected.map(x=>x.blob),currentFrame.blob].slice(-6),images=[];
   for(const blob of blobs){const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));images.push(btoa(binary));}
   if(token!==generation)return;
   const messages=[...history,{role:'user',text}];notify.onStatus('최근 '+images.length+'개 장면을 함께 분석하고 있어요…');
   const data=await bridge.placeChat({image:images.at(-1),images,messages});if(token!==generation)return;
   history=[...messages,{role:'model',text:data.answer.slice(0,3000)}].slice(-10);notify.onText(data.answer);notify.onText('',true);notify.onStatus('화면 수집 중 · 다음 질문에는 새 장면이 자동으로 반영됩니다.');
  }finally{if(token===generation)busy=false;}
 }
 window.cleanTouchLive={start,stop,ask,get active(){return ready;}};window.addEventListener('beforeunload',stop);
})();
`);
edit('cleantouch-desktop/index.html',s=>s.replace('<script defer src="live-screen.js">','<script defer src="recent-scenes.js"></script>\n  <script defer src="live-screen.js">').replace('5초 간격으로 장면을 모읍니다.','최근 화면을 촘촘히 보관하고 1초 간격으로 분석 장면을 모읍니다.'));
edit('cleantouch-desktop/package.json',s=>{const p=JSON.parse(s);p.build.files.push('recent-scenes.js');return JSON.stringify(p,null,2)+'\n';});
edit('cleantouch-desktop/renderer.js',s=>s.replace('}, 5000);','}, 1000);').replace('watchTracker.reset();','watchTracker.reset();\n    window.clearRecentScenes?.();').replace('window.cleanTouchPlaceChat?.reset();','window.cleanTouchPlaceChat?.reset();\n  window.clearRecentScenes?.();').replace('if(release){\n  stream?', 'if(release){\n  window.clearRecentScenes?.();\n  stream?'));
edit('cleantouch-desktop/place-chat.js',s=>s.replace('window.cleanTouchLive?.stop();generation++;','window.cleanTouchLive?.stop();el(\'chat-live-stop\').hidden=true;generation++;').replace("el('chat-send').disabled=busy||!image", "el('chat-send').disabled=busy||(!image&&!window.cleanTouchLive?.active)").replace("input.disabled=busy||!image||history.at(-1)?.role!=='model'", "input.disabled=busy||(!window.cleanTouchLive?.active&&(!image||history.at(-1)?.role!=='model'))").replace('try{cleanTouchLive.ask(value);}catch(error){el(\'chat-error\').textContent=error.message;}',"busy=true;controls();cleanTouchLive.ask(value).catch(error=>{el('chat-error').textContent=error.message;}).finally(()=>{busy=false;controls();});"));
// Same bounded multi-frame input on local Express and deployed Netlify.
edit('cleantouch-search-api/src/place-provider.ts',s=>s.replace('signal?: AbortSignal): Promise<PlaceAnswer>', 'signal?: AbortSignal, scenes?: Buffer[]): Promise<PlaceAnswer>').replace('signal=AbortSignal.timeout(45_000)): Promise<PlaceAnswer>', 'signal=AbortSignal.timeout(45_000), scenes:Buffer[]=[]): Promise<PlaceAnswer>').replace("parts:[{text:instructions}]", "parts:[{text:instructions+'\\n여러 사진이 있으면 과거부터 현재 순서입니다. 마지막 사진이 현재 화면입니다. 상품 질문에는 직전 장면도 참고하되 현재와 과거를 구분하세요.'}]").replace("...(index===0?[{inlineData:{mimeType:'image/jpeg',data:image.toString('base64')}}]:[])","...(scenes.length?index===messages.length-1?scenes.map(bytes=>({inlineData:{mimeType:'image/jpeg',data:bytes.toString('base64')}})):[]:index===0?[{inlineData:{mimeType:'image/jpeg',data:image.toString('base64')}}]:[])"));
for(const file of ['cleantouch-search-api/src/place-chat.ts','cleantouch-search-api/netlify/functions/place-chat.mjs'])edit(file,s=>s.replace('{image,messages,task,target}', '{image,images,messages,task,target}').replace("if(target!==undefined", "if(images!==undefined&&(!Array.isArray(images)||!images.length||images.length>6||images.some(x=>typeof x!=='string'||x.length>600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(x))||images.reduce((n,x)=>n+x.length,0)>2200000))throw new ChatError(400,'최근 장면이 너무 크거나 형식이 올바르지 않아요.');\n      if(target!==undefined").replace('provider.reply(normalized,messages)', 'provider.reply(normalized,messages,undefined,scenes)').replace('provider.reply(bytes,messages)', 'provider.reply(bytes,messages,undefined,scenes)').replace('active++;daily++;', "const scenes=images?await Promise.all(images.map(async x=>{try{return await sharp(Buffer.from(x,'base64'),{limitInputPixels:8000000,failOn:'error'}).rotate().resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();}catch{throw new ChatError(400,'최근 장면 이미지를 읽지 못했어요.');}})):[];\n      if(active>=2)throw new ChatError(429,'잠시 후 다시 시도해 주세요.');\n      active++;daily++;"));
edit('cleantouch-search-api/netlify/functions/place-chat.mjs',s=>"import sharp from 'sharp';\n"+s);
