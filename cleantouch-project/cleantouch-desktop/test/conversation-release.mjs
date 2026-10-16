import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
const port=9237,artifact=path.resolve('../artifacts/verification'),wait=ms=>new Promise(r=>setTimeout(r,ms));
const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json(),page=targets.find(t=>t.type==='page'&&t.url==='cleantouch://app/index.html');assert(page,'No isolated CleanTouch page');
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
socket.addEventListener('message',event=>{const data=JSON.parse(event.data),p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);});
const command=(method,params={},timeout=70000)=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error(method+' timed out'));},timeout);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}));});
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let i=0;i<220;i++){const result=await evaluate(expression);if(result)return result;await wait(300);}throw Error('Timed out: '+expression);}
async function screenshot(name){const r=await command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(artifact,'release-0.1.37-'+name+'.png'),Buffer.from(r.data,'base64'));}
try{
 await evaluate('checkServer();');await until('serverReady');
 await evaluate('startCapture()');await until('currentFrame?.videoOnly&&capturePlan?.linked&&!capturePlan.blocked');await evaluate('stopCapture();');
 await evaluate('document.getElementById("widget-place").onclick()');assert(await evaluate('cleanTouchLive.active'));
 await evaluate('document.getElementById("chat-input").value="이 화면에서 보이는 상품과 색·모양이 아주 비슷한 상품을 사고 싶어. 구매처나 검색을 도와줘.";document.getElementById("chat-form").requestSubmit();');
 await until('!document.getElementById("chat-send").disabled&&!document.querySelector(".chat-message.pending")');
 assert.equal(await evaluate('Boolean(document.querySelector(".chat-message.failed"))'),false);
 const card=await evaluate('(()=>{const e=document.querySelector(".chat-shopping-card");return e?JSON.parse(e.dataset.card):null})()');assert(card?.query);assert(card.image);console.log('Actual purchase intent:',JSON.stringify({query:card.query,candidates:card.candidates?.length||0,photo:true}));await screenshot('purchase');
 const before=await evaluate('document.getElementById("chat-messages").textContent');await evaluate('document.getElementById("chat-close").onclick()');assert.equal(await evaluate('cleanTouchLive.sharing'),false);
 // Reopen without starting a second paid connection; the existing text must stay.
 await evaluate('cleanTouchPlaceChat.open()');assert.equal(await evaluate('document.getElementById("chat-messages").textContent'),before);
 await evaluate('cleanTouchChatMemory.commit()');const chats=await evaluate('bridge.listChats()');assert(chats.length);const saved=chats[0];await evaluate('document.getElementById("chat-reset").click()');await evaluate(`cleanTouchChatMemory.select(${JSON.stringify(saved.id)})`);assert.equal(await evaluate('document.getElementById("chat-messages").textContent'),before);
 await evaluate('document.getElementById("chat-history-toggle").click()');await wait(400);await screenshot('history-widget');
 assert(await evaluate('(()=>{const r=document.getElementById("chat-history").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()'));
 await evaluate('document.getElementById("chat-history-close").click();document.getElementById("chat-close").onclick()');await evaluate('document.body.classList.remove("widget-mode","floating-chat");ui.widget.hidden=true;bridge.setWindowLayout("dashboard")');await evaluate('cleanTouchPlaceChat.open()');await evaluate('document.getElementById("chat-history-toggle").click()');await wait(400);await screenshot('history-dashboard');
 await fs.writeFile(path.join(artifact,'release-0.1.37-conversation.json'),JSON.stringify({savedId:saved.id,title:saved.title,query:card.query,purchaseCard:true,closeKeepsChat:true,historyRestore:true,providerHistory:(await evaluate(`bridge.loadChat(${JSON.stringify(saved.id)})`)).history.length},null,2));
 console.log('Actual purchase card, close/reopen, stored history and chat selection: passed');
}catch(error){console.error(error.message);try{await fs.writeFile(path.join(artifact,'release-0.1.37-error.json'),JSON.stringify(await evaluate('({phase,capturePlan,error:document.getElementById("chat-error").textContent,messages:document.getElementById("chat-messages").textContent})'),null,2));await screenshot('error');}catch{}throw error;}
finally{try{await evaluate('cleanTouchLive.stop();stopCapture(true)');await command('Browser.close',{},3000);}catch{}socket.close();for(const p of pending.values())clearTimeout(p.timer);}
