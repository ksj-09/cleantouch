import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
const wait=ms=>new Promise(r=>setTimeout(r,ms)),dir=path.resolve('../artifacts/verification');let page;
for(let i=0;i<40;i++){try{page=(await(await fetch('http://127.0.0.1:9239/json')).json()).find(p=>p.type==='page'&&p.url==='cleantouch://app/index.html');if(page)break;}catch{}await wait(200);}assert(page);
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
ws.onmessage=e=>{const data=JSON.parse(e.data),p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);};
const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error(method+' timed out')),65000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
async function until(expression){for(let i=0;i<200;i++){const result=await evaluate(expression);if(result)return result;await wait(250);}throw Error('Timed out: '+expression);}
try{
 await until('typeof cleanTouchChatTitle!=="undefined"');await evaluate('cleanTouchTutorial.close();cleanTouchPlaceChat.open();');
 await evaluate(`document.getElementById('chat-input').value='영상 보면서 마음에 든 가방을 찾아보고 싶어. 어떤 특징을 비교해야 할까?';document.getElementById('chat-form').requestSubmit();`);
 await until(`!document.getElementById('chat-send').disabled&&!document.querySelector('.chat-message.pending')&&document.querySelector('.chat-answer-text')`);
 const result=await evaluate(`(async()=>{await cleanTouchChatMemory.commit();const chat=await bridge.loadChat(cleanTouchChatMemory.currentId);return {title:chat.title,generated:chat.titleGenerated,answer:document.querySelector('.chat-answer-text').textContent,shared:cleanTouchLive.sharing,hasStream:Boolean(stream),titleMetadataVisible:document.getElementById('chat-messages').textContent.includes('cleantouch-title')};})()`);
 assert(result.generated,result.answer);assert(result.title.length<=28);assert(!result.titleMetadataVisible);assert(!result.shared&&!result.hasStream);await fs.writeFile(path.join(dir,'release-0.1.39-real-title.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 const screenshot=await command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(dir,'release-0.1.39-real-title.png'),Buffer.from(screenshot.data,'base64'));
}finally{try{await command('Browser.close');}catch{}ws.close();for(const p of pending.values())clearTimeout(p.timer);}
