import fs from 'node:fs/promises';
const pages=await(await fetch('http://127.0.0.1:9224/json')).json(),page=pages.find(x=>x.type==='page'&&x.url==='cleantouch://app/index.html');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;
function call(method,params){const n=++id;return new Promise((resolve,reject)=>{const listener=e=>{const x=JSON.parse(e.data);if(x.id!==n)return;ws.removeEventListener('message',listener);if(x.error||x.result?.exceptionDetails)reject(Error(JSON.stringify(x.error||x.result.exceptionDetails)));else resolve(x.result);};ws.addEventListener('message',listener);ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){return (await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;}
async function tap(point){const rect=await evaluate('ui.focusCanvas.getBoundingClientRect().toJSON()');const x=rect.x+rect.width*point[0],y=rect.y+rect.height*point[1];for(const type of ['mousePressed','mouseReleased'])await call('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,250));if(await evaluate('!liveBusy'))return;}throw Error('Mask did not finish');}
async function state(){return evaluate(`(()=>{const c=focusMaskPreview;if(!c)return {mask:false,hint:ui.focusHint.textContent};const x=c.getContext('2d'),alpha=(p)=>x.getImageData(Math.floor(c.width*p[0]),Math.floor(c.height*p[1]),1,1).data[3];return {mask:true,faceAlpha:alpha([.5,.36]),torsoAlpha:alpha([.55,.5]),bladeAlpha:alpha([.455,.735]),hint:ui.focusHint.textContent};})()`);}
try{
 await evaluate(`(async()=>{const blob=await(await fetch('cleantouch://app/test/fixtures/blue-scene.jpg')).blob();await showFrameInPicker({blob,seconds:5,videoOnly:true},true);await new Promise(r=>setTimeout(r,300));syncFocusCanvas();})()`);
 await tap([.455,.735]);const before=await state();
 await evaluate(`document.getElementById('refine-focus').click()`);await tap([.55,.5]);const after=await state();
 const shot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile('../artifacts/verification/mask-correction.png',Buffer.from(shot.data,'base64'));
 await fs.writeFile('../artifacts/verification/mask-correction.json',JSON.stringify({before,after},null,2));console.log(JSON.stringify({before,after}));
}finally{ws.close();}
