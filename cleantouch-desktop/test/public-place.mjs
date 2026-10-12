import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const pages=await(await fetch('http://127.0.0.1:'+(process.env.CLEANTOUCH_TEST_PORT||9226)+'/json')).json();
const page=pages.find(p=>p.type==='page'&&p.title==='CleanTouch');
if(!page)throw Error('Packaged CleanTouch window required');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;
function call(method,params){const request=++id;return new Promise((resolve,reject)=>{const listener=event=>{const data=JSON.parse(event.data);if(data.id!==request)return;socket.removeEventListener('message',listener);if(data.error||data.result?.exceptionDetails)reject(Error(JSON.stringify(data.error||data.result.exceptionDetails)));else resolve(data.result);};socket.addEventListener('message',listener);socket.send(JSON.stringify({id:request,method,params}));});}
async function evaluate(expression){return (await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true})).result.value;}
try{
 const image=(await fs.readFile('../artifacts/verification/live-clean-video.jpg')).toString('base64');
 await evaluate(`(async()=>{phase='review';currentFrame={blob:new Blob([Uint8Array.from(atob('${image}'),c=>c.charCodeAt(0))],{type:'image/jpeg'}),videoOnly:true};await cleanTouchPlaceChat.analyze();})()`);
 const first=await evaluate(`({error:document.querySelector('#chat-error').textContent,text:document.querySelector('#chat-messages').textContent,enabled:!document.querySelector('#chat-input').disabled})`);
 assert(first.enabled,first.error);assert(!first.text.includes('확인하고 있어요'));
 await evaluate(`(async()=>{const input=document.querySelector('#chat-input');input.value='정확한 위치를 확인하려면 어떤 단서가 필요해?';document.querySelector('#chat-form').requestSubmit();})()`);
 for(let i=0;i<60;i++){const state=await evaluate(`({enabled:!document.querySelector('#chat-input').disabled,error:document.querySelector('#chat-error').textContent})`);if(state.enabled)break;await new Promise(r=>setTimeout(r,1000));}
 const final=await evaluate(`({error:document.querySelector('#chat-error').textContent,text:document.querySelector('#chat-messages').textContent,enabled:!document.querySelector('#chat-input').disabled})`);
 assert(final.enabled,final.error);assert(final.text.includes('정확한 위치를 확인하려면'));
 await fs.writeFile('../artifacts/verification/pc-place-public.json',JSON.stringify({first,final},null,2));
 const shot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('../artifacts/verification/pc-place-public.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({packagedApp:!process.env.CLEANTOUCH_TEST_PORT,publicServer:true,initialImage:true,followUp:true,...final}));
}finally{socket.close();}
