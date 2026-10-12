import fs from 'node:fs/promises';
const pages=await(await fetch('http://127.0.0.1:9224/json')).json();
const page=pages.find(x=>x.type==='page'&&x.url==='cleantouch://app/index.html');
if(!page)throw Error('CleanTouch preview is not running');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let id=0;
async function call(method,params){const current=++id;return new Promise((resolve,reject)=>{const listener=e=>{const data=JSON.parse(e.data);if(data.id!==current)return;socket.removeEventListener('message',listener);if(data.error)reject(Error(JSON.stringify(data.error)));else resolve(data.result);};socket.addEventListener('message',listener);socket.send(JSON.stringify({id:current,method,params}));});}
try{
 if(process.argv[3]){
  const [x,y]=process.argv[3].split(',').map(Number);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
  await new Promise(resolve=>setTimeout(resolve,2500));
 }
 const shot=await call('Page.captureScreenshot',{format:'png'});
 await fs.writeFile(process.argv[2],Buffer.from(shot.data,'base64'));console.log(process.argv[2]);
}finally{socket.close();}
