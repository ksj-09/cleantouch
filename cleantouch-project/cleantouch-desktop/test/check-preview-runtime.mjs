const targets=await(await fetch('http://127.0.0.1:'+(process.env.CLEANTOUCH_INSPECT_PORT||9237)+'/json')).json();
const page=targets.find(p=>p.url==='cleantouch://app/index.html');if(!page)throw Error('Preview unavailable');
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
function command(method,params={}){return new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>reject(Error('Preview inspection timed out')),10000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}));});}
async function read(expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(String(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'Preview code not ready').slice(0,600));return result.result.value;}
try{
 if(process.argv.includes('--simple')){
  const checks=await read(`(()=>{const e=id=>document.getElementById(id),visible=x=>!!x.getClientRects().length;return {idle:phase==='idle',start:visible(e('start')),currentHidden:!visible(e('current-screen')),pastHidden:!visible(e('analyze-all')),focusPrimary:!e('submit-focus').closest('details'),correctionOptional:!!e('include-focus').closest('details'),attachmentOptional:!!e('chat-upload').closest('details'),stopAlwaysReachable:!e('chat-live-stop').closest('details'),attachmentsClosed:!document.querySelector('.chat-attachments').open};})()`);
  if(!Object.values(checks).every(Boolean))throw Error('Simple flow verification failed: '+JSON.stringify(checks));
  console.log(JSON.stringify(checks));socket.close();process.exit(0);
 }
 const before=await read("({phase,draft:document.getElementById('chat-input').value.length,voice:Boolean(window.cleanTouchVoice?.busy),sharing:Boolean(window.cleanTouchLive?.sharing),pending:Boolean(document.querySelector('.chat-message.pending'))})");let refreshed=false;
 if(before.phase==='idle'&&!before.draft&&!before.voice&&!before.sharing&&!before.pending){await command('Page.reload',{ignoreCache:true});refreshed=true;}
 let result;
 for(let n=0;n<30;n++){try{result=await read(`({phase,selectionEvidence:typeof buildSelectedProductEvidence==='function',opaqueMask:isolateTappedObject.toString().includes('confidence < alphaThreshold ? 0 : 255'),automaticPhotoComparison:cleanTouchPlaceChat.showProduct.toString().includes('compareProduct'),duplicateFilter:typeof cleanTouchSceneDedup==='object'})`);break;}catch{await new Promise(r=>setTimeout(r,200));}}
 if(!result||!result.selectionEvidence||!result.opaqueMask||!result.automaticPhotoComparison||!result.duplicateFilter)throw Error('Preview is missing the new product flow');
 if(process.argv.includes('--voice')){
  for(let attempt=0;attempt<30;attempt++){if(await read('typeof cleanTouchVoice!=="undefined"'))break;await new Promise(r=>setTimeout(r,100));}
  const voice=await read(`(async()=>{await cleanTouchPlaceChat.open();const panel=document.getElementById('place-chat').getBoundingClientRect(),form=document.getElementById('chat-form').getBoundingClientRect(),mic=document.getElementById('chat-microphone').getBoundingClientRect();return {voiceAvailable:typeof cleanTouchVoice==='object',microphoneOff:document.getElementById('place-chat').dataset.voiceState==='idle',welcome:!document.getElementById('chat-welcome').hidden,composerFits:form.bottom<=panel.bottom&&mic.right<=form.right,users:document.querySelectorAll('.chat-message.user').length};})()`);
  if(!voice.voiceAvailable||!voice.microphoneOff||!voice.composerFits)throw Error('Voice preview did not load correctly');
  if(!voice.users){const image=await command('Page.captureScreenshot',{format:'png'});const fs=await import('node:fs/promises'),path=await import('node:path');const folder=path.resolve('../artifacts/verification');await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'voice-0.1.54-preview.png'),Buffer.from(image.data,'base64'));}
  Object.assign(result,voice);
 }
 console.log(JSON.stringify({refreshed,...result}));
}finally{socket.close();}
