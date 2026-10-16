try{
 const pages=await(await fetch('http://127.0.0.1:9237/json')).json(),page=pages.find(p=>p.url==='cleantouch://app/index.html');
 if(!page){console.log('No old preview');process.exit(0);}
 const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let next=0;const pending=new Map();socket.addEventListener('message',event=>{const result=JSON.parse(event.data),request=pending.get(result.id);if(!request)return;pending.delete(result.id);clearTimeout(request.timer);result.error?request.reject(Error(result.error.message)):request.resolve(result.result);});
 socket.addEventListener('close',()=>{for(const request of pending.values()){clearTimeout(request.timer);request.close?request.resolve({}):request.reject(Error('Preview closed'));}pending.clear();});
 function command(method,params={}){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>reject(Error('Preview inspection timed out')),5000);pending.set(id,{resolve,reject,timer,close:method==='Page.close'});socket.send(JSON.stringify({id,method,params}));});}
 const response=await command('Runtime.evaluate',{expression:"({idle:phase==='idle',draft:document.getElementById('chat-input').value.length,sharing:cleanTouchLive.sharing,pending:Boolean(document.querySelector('.chat-message.pending')),voice:Boolean(window.cleanTouchVoice?.busy)})",returnByValue:true});
 const state=response.result?.value;console.log(JSON.stringify(state));
 if(state?.idle&&!state.draft&&!state.sharing&&!state.pending&&!state.voice&&pages.filter(p=>p.type==='page').length===1){await command('Page.close');console.log('Idle preview closed for restart');}
 else{console.log('Active preview preserved');process.exitCode=2;}
 socket.close();
}catch(error){console.log('Old preview unavailable: '+error.message);}
