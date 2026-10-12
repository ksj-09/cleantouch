import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const port=Number(process.env.CLEANTOUCH_DEBUG_PORT||9236),artifact=path.resolve('../artifacts/verification');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let socket,id=0;const pending=new Map(),errors=[];
async function command(method,params={},timeout=65000){const n=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(n);reject(Error(method+' timed out'));},timeout);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
async function until(expression,timeout=60000){const deadline=Date.now()+timeout;while(Date.now()<deadline){const value=await evaluate(expression);if(value)return value;await sleep(300);}throw Error('Timed out waiting for '+expression);}
async function screenshot(name){const data=await command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(artifact,'release-0.1.36-'+name+'.png'),Buffer.from(data.data,'base64'));}
try{
 let page;for(let attempt=0;attempt<60;attempt++){try{const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();page=targets.find(x=>x.type==='page'&&x.url==='cleantouch://app/index.html');if(page)break;}catch{}await sleep(500);}
 assert(page,'Packaged CleanTouch is not running');socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text);const request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);if(data.error)request.reject(Error(data.error.message));else request.resolve(data.result);});
 await command('Runtime.enable');await fs.mkdir(artifact,{recursive:true});await until('typeof checkServer==="function"&&typeof cleanTouchPlaceChat!=="undefined"',30000);
 await evaluate('checkServer()');assert.equal(await evaluate('serverReady'),true);
 assert.equal(await evaluate('!bridge.setKey&&!bridge.setApiUrl&&!bridge.scan&&!document.querySelector("#gemini-key,#api-url,#sources")'),true);
 await screenshot('home');await evaluate('document.getElementById("theme-toggle").click()');assert.equal(await evaluate('document.body.classList.contains("dark-theme")'),true);await screenshot('dark');await evaluate('document.getElementById("theme-toggle").click()');
 await evaluate('document.getElementById("enter-widget").click()');await sleep(400);await evaluate('document.getElementById("collapse-widget").click()');await sleep(400);assert.equal(await evaluate('document.body.classList.contains("compact-widget")'),true);await screenshot('compact');await evaluate('document.getElementById("collapse-widget").click()');await sleep(400);
 console.log('Packaged home, themes, compact widget and API-key-free controls: passed');
 await evaluate('startCapture()');await until('currentFrame?.videoOnly&&capturePlan?.linked&&!capturePlan.blocked',30000);
 const frame=await evaluate('(async()=>{const bytes=new Uint8Array(await currentFrame.blob.arrayBuffer());let raw="";for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return {image:btoa(raw),scene:capturePlan.scene?.title,frames:frames.length};})()');
 await fs.writeFile(path.join(artifact,'release-0.1.36-video.jpg'),Buffer.from(frame.image,'base64'));await screenshot('widget');
 await evaluate('stopCapture()');assert.equal(await evaluate('capturePaused'),true);
 console.log('Actual YouTube player capture and collection pause: passed');
 await evaluate('cleanTouchPlaceChat.open()');
 assert.equal(await evaluate('(()=>{const p=document.getElementById("place-chat").getBoundingClientRect(),f=document.getElementById("chat-form").getBoundingClientRect(),v=ui.widgetPreview.getBoundingClientRect();return p.top>=v.bottom&&f.bottom<=p.bottom&&f.width>200})()'),true);
 await screenshot('chat');
 // Use real Gemini connections but accelerate only the planned eight-minute
 // renewal. No auth token, session handle, or frame bytes enter the test log.
 await evaluate(`(()=>{window.releaseTimeout=setTimeout;window.setTimeout=(fn,ms,...args)=>releaseTimeout(fn,ms===480000?15000:ms,...args);window.releaseSockets=[];window.releaseFrames=0;window.releaseQuestionImages=[];const Native=WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);releaseSockets.push(this);}send(raw){const data=JSON.parse(raw);if(data.setup)this.resumed=Boolean(data.setup.sessionResumption?.handle);const picture=data.clientContent?.turns?.flatMap(t=>t.parts||[]).find(p=>p.inlineData)?.inlineData;if(picture){releaseFrames++;window.releaseLastImage=picture.data;}if(data.clientContent?.turnComplete)releaseQuestionImages.push(releaseLastImage);super.send(raw);}};})()`);
 await evaluate('document.getElementById("chat-place").onclick()');assert.equal(await evaluate('cleanTouchLive.active'),true);
 const question=JSON.stringify('현재 영상에 보이는 상품을 한 문장으로 설명해줘. 보이지 않는 브랜드나 가격은 추측하지 마.');
 await evaluate(`document.getElementById('chat-input').value=${question};document.getElementById('chat-form').requestSubmit();`);
 await until('!document.getElementById("chat-send").disabled&&!document.querySelector(".chat-message.pending")&&document.querySelectorAll(".chat-message.model").length>1');
 const first=await evaluate('document.querySelector(".chat-message.model:last-child").textContent');assert(first.length>10&&!await evaluate('Boolean(document.querySelector(".chat-message.failed"))'));
 await fs.writeFile(path.join(artifact,'release-0.1.36-first-question.jpg'),Buffer.from(await evaluate('releaseQuestionImages[0]'),'base64'));
 console.log('Real Gemini Live answer:',first.slice(0,240));
 await until('releaseSockets.length>=2&&cleanTouchLive.active',50000);assert.equal(await evaluate('releaseSockets.at(-1).resumed'),true);assert.equal(await evaluate('document.getElementById("chat-send").disabled'),false);
 await evaluate(`document.getElementById('chat-input').value='지금 화면에서 눈에 띄는 색상을 간단히 알려줘.';document.getElementById('chat-form').requestSubmit();`);
 await until('!document.getElementById("chat-send").disabled&&!document.querySelector(".chat-message.pending")&&document.querySelectorAll(".chat-message.model").length>2');
 const second=await evaluate('document.querySelector(".chat-message.model:last-child").textContent');assert(second.length>5&&!await evaluate('Boolean(document.querySelector(".chat-message.failed"))'));
 await fs.writeFile(path.join(artifact,'release-0.1.36-second-question.jpg'),Buffer.from(await evaluate('releaseQuestionImages[1]'),'base64'));
 const live=await evaluate('({connections:releaseSockets.length,resumed:releaseSockets.at(-1).resumed,frames:releaseFrames})');assert(live.frames>=2);await screenshot('live-answer');
 await evaluate('document.getElementById("chat-live-stop").click();window.setTimeout=releaseTimeout;');assert.equal(await evaluate('cleanTouchLive.sharing'),false);
 assert.equal(errors.length,0,errors.join('\n'));
 await fs.writeFile(path.join(artifact,'release-0.1.36-smoke.json'),JSON.stringify({packaged:true,keySetupRemoved:true,videoOnly:true,chatLayout:true,live,first,second,errors},null,2));
 console.log('Actual session resume, subsequent question, and share shutdown: passed',JSON.stringify(live));
}catch(error){
 if(socket?.readyState===1){try{const diagnostics=await evaluate('(async()=>({phase,capturePaused,collectionError,notice:lastNotice,plan:capturePlan,geometry:await bridge.getCaptureGeometry(),video:{ready:ui.video.readyState,width:ui.video.videoWidth,height:ui.video.videoHeight}}))()');await fs.writeFile(path.join(artifact,'release-0.1.36-failure.json'),JSON.stringify(diagnostics,null,2));console.error('Release diagnostic:',JSON.stringify(diagnostics));await screenshot('failure');}catch{}}
 throw error;
}finally{
 if(socket?.readyState===1){try{await evaluate('cleanTouchLive.stop();stopCapture(true)');}catch{}try{await command('Browser.close',{},3000);}catch{}socket.close();}
 for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Test closed'));}pending.clear();
}
