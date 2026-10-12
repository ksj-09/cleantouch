// Inspect the isolated local preview, never other browser tabs.
const pages=await(await fetch(`http://127.0.0.1:${process.env.CLEANTOUCH_DEBUG_PORT||9224}/json`)).json();
const page=pages.find(x=>x.type==='page'&&x.url==='cleantouch://app/index.html');
if(!page)throw Error('CleanTouch preview is not running');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
try{
 const result=await new Promise((resolve,reject)=>{
  socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id!==1)return;if(data.error||data.result?.exceptionDetails)reject(Error(JSON.stringify(data.error||data.result.exceptionDetails)));else resolve(data.result.result.value);});
  socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:process.argv[2],returnByValue:true,awaitPromise:true,userGesture:true}}));
 });
 console.log(JSON.stringify(result));
}finally{socket.close();}
