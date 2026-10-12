import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const pages=await(await fetch('http://127.0.0.1:'+(process.env.CLEANTOUCH_TEST_PORT||9226)+'/json')).json();const page=pages.find(p=>p.type==='page'&&p.title==='CleanTouch');if(!page)throw Error('Packaged test app required');
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;
function call(method,params){const request=++id;return new Promise((resolve,reject)=>{const listener=e=>{const d=JSON.parse(e.data);if(d.id!==request)return;socket.removeEventListener('message',listener);if(d.error||d.result?.exceptionDetails)reject(Error(JSON.stringify(d.error||d.result.exceptionDetails)));else resolve(d.result);};socket.addEventListener('message',listener);socket.send(JSON.stringify({id:request,method,params}));});}
async function evaluate(expression){return (await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true})).result.value;}
try {
 const encoded=(await fs.readFile('../cleantouch-android/app/src/androidTest/assets/bag.png')).toString('base64');
 const data=await evaluate(`(async()=>{const blob=new Blob([Uint8Array.from(atob('${encoded}'),c=>c.charCodeAt(0))],{type:'image/png'});const bitmap=await createImageBitmap(blob);const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);bitmap.close();const result=await bridge.identifyProduct(canvas.toDataURL('image/jpeg',0.85).split(',')[1]);await cleanTouchPlaceChat.showProduct(blob,result);return result;})()`);
 assert(data.query);assert.equal(data.query,data.label);assert.equal(new URL(data.shoppingUrl).searchParams.get('q'),data.label);
 await evaluate(`document.querySelector('#chat-input').value='이 상품과 비슷하지만 더 저렴한 것을 찾으려면 어떻게 검색해?';document.querySelector('#chat-form').requestSubmit();`);
 let state;for(let i=0;i<60;i++){state=await evaluate(`({enabled:!document.querySelector('#chat-input').disabled,retry:!document.querySelector('#chat-retry').hidden,text:document.querySelector('#chat-messages').textContent})`);if(state.enabled)break;await new Promise(r=>setTimeout(r,1000));}
 assert(state.enabled&&!state.retry,'Follow-up should succeed');
 await fs.writeFile('../artifacts/verification/pc-product-ai.json',JSON.stringify({data,...state},null,2));const shot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('../artifacts/verification/pc-product-ai.png',Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({packagedApp:!process.env.CLEANTOUCH_TEST_PORT,publicProductAi:true,queryMatchesName:true,followUp:true,...data}));
}finally{socket.close();}
