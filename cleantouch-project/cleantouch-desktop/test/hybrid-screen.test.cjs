const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
async function flush(){for(let i=0;i<25;i++)await Promise.resolve();}
function context(){
 const sockets=[],timers=new Set(),tokenHandles=[],statuses=[],received=[],states=[];let now=100_000;
 class FakeSocket{
  constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);}
  open(){this.readyState=1;this.onopen?.({});}
  send(text){if(this.readyState!==1)throw Error('socket closed');this.sent.push(JSON.parse(text));}
  receive(data){this.onmessage?.({data:JSON.stringify(data)});}
  close(code=1000,reason='closed'){this.readyState=3;this.onclose?.({code,reason});}
 }
 const addTimer=(fn,ms,interval=false)=>{const timer={fn,ms,interval,at:now+ms};timers.add(timer);return timer;};
 const c={window:{addEventListener(){}},Date:{now:()=>now},Blob,Uint8Array,Math,Set,WebSocket:FakeSocket,stream:{},
  ui:{video:{readyState:2}},videoTime:{videoKey:'video-a',paused:true},capturePlan:{linked:true,blocked:false,source:{x:0,y:0,width:20,height:20}},
  sceneCapture:{drawFrame(){}},document:{createElement:()=>({getContext:()=>({}),toDataURL:()=> 'data:image/jpeg;base64,/9j/AA=='})},
  bridge:{getLiveToken:async handle=>{tokenHandles.push(handle);return {token:'test-token',setup:{model:'models/test',sessionResumption:handle?{handle}:{}}};}},
  updateCapturePlan:async()=>{},setInterval:(fn,ms)=>addTimer(fn,ms,true),clearInterval:t=>timers.delete(t),setTimeout:(fn,ms)=>addTimer(fn,ms),clearTimeout:t=>timers.delete(t)};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'live-screen.js'),'utf8'),c);
 Object.assign(c,{sockets,timers,tokenHandles,statuses,received,states,callbacks:{onStatus:text=>statuses.push(text),onText:(text,done)=>received.push({text,done}),onState:state=>states.push(state)}});
 c.advance=async ms=>{now+=ms;for(const t of [...timers])if(t.at<=now&&timers.has(t)){if(t.interval)t.at=now+t.ms;else timers.delete(t);t.fn();}await flush();};
 c.start=async()=>{const promise=c.window.cleanTouchLive.start(c.callbacks);await flush();const socket=sockets.at(-1);socket.open();socket.receive({setupComplete:{},sessionResumptionUpdate:{newHandle:'resume-one'}});await promise;return socket;};
 return c;
}
test('ordered images stream without mixing input channels; paused frames are skipped and questions share their context',async()=>{
 const c=context(),live=c.window.cleanTouchLive,first=await c.start();
 assert.equal(live.active,true);assert.equal(first.sent.filter(x=>x.clientContent?.turns?.some(t=>t.parts?.some(p=>p.inlineData))).length,1);
 await c.advance(1000);assert.equal(first.sent.filter(x=>x.clientContent?.turns?.some(t=>t.parts?.some(p=>p.inlineData))).length,1);
 c.videoTime.paused=false;await c.advance(1000);assert.equal(first.sent.filter(x=>x.clientContent?.turns?.some(t=>t.parts?.some(p=>p.inlineData))).length,2);
 const answer=live.ask('어떤 상품이 보여?');await flush();assert.equal(first.sent.at(-1).clientContent.turns[0].parts[0].text,'어떤 상품이 보여?');
 assert(!first.sent.some(x=>x.realtimeInput));const whileAnswer=first.sent.length;await c.advance(1000);assert.equal(first.sent.length,whileAnswer,'New image context must not interrupt a pending reply');
 first.receive({serverContent:{outputTranscription:{text:'파란색 광선검이 보여요.'}}});first.receive({serverContent:{turnComplete:true}});await answer;
 assert(c.received.some(x=>x.text.includes('파란색 광선검')));assert(c.received.some(x=>x.done));live.stop();
});
test('text-only chat answers without capture, sends no pictures, and remains private during renewal',async()=>{
 const c=context();c.callbacks.mode='text';c.callbacks.getReferenceImage=()=>'/9j/AA==';c.stream=null;c.updateCapturePlan=async()=>{throw Error('Text chat must never inspect the screen');};c.document.createElement=()=>{throw Error('Text chat must never capture pixels');};const first=await c.start(),live=c.window.cleanTouchLive;assert.equal(live.sharing,false);assert.equal(live.active,true);assert.equal(live.mode,'text');assert(!first.sent.some(m=>JSON.stringify(m).includes('inlineData')));const answer=live.ask('안녕하세요');await flush();first.receive({serverContent:{outputTranscription:{text:'안녕하세요!'},turnComplete:true}});await answer;await c.advance(1000);assert(!first.sent.some(m=>JSON.stringify(m).includes('inlineData')));await c.advance(8*60_000);const resumed=c.sockets.at(-1);resumed.open();resumed.receive({setupComplete:{}});await flush();assert.equal(live.active,true);assert.equal(live.sharing,false);assert(!resumed.sent.some(m=>JSON.stringify(m).includes('inlineData')));live.stop();
});
test('conversation memory is placed before each new question even after the Live session renews',async()=>{
 const c=context();c.callbacks.mode='text';c.callbacks.getContext=()=> '지난 대화: 사용자의 이름은 민지, 예산은 5만원';let ws=await c.start();let asked=c.window.cleanTouchLive.ask('내 조건 기억해?');await flush();assert.equal(ws.sent.at(-2).clientContent.turnComplete,false);assert(ws.sent.at(-2).clientContent.turns[0].parts[0].text.includes('민지'));assert.equal(ws.sent.at(-1).clientContent.turns[0].parts[0].text,'내 조건 기억해?');ws.receive({serverContent:{outputTranscription:{text:'민지님, 5만원입니다.'},turnComplete:true}});await asked;
 await c.advance(8*60_000);ws=c.sockets.at(-1);ws.open();ws.receive({setupComplete:{}});await flush();asked=c.window.cleanTouchLive.ask('다시 기억해?');await flush();assert(ws.sent.at(-2).clientContent.turns[0].parts[0].text.includes('5만원'));ws.receive({serverContent:{outputTranscription:{text:'네.'},turnComplete:true}});await asked;assert(!ws.sent.some(v=>JSON.stringify(v).includes('inlineData')));c.window.cleanTouchLive.stop();
});
test('explicit screen sharing and stopping reuse the chat connection without sending frames after stop',async()=>{
 const c=context();c.callbacks.mode='text';const ws=await c.start(),live=c.window.cleanTouchLive;await live.enableSharing();assert.equal(live.sharing,true);assert(ws.sent.some(m=>JSON.stringify(m).includes('inlineData')));const connections=c.sockets.length;assert.equal(live.disableSharing(),true);assert.equal(live.sharing,false);const pictures=ws.sent.filter(m=>JSON.stringify(m).includes('inlineData')).length;c.videoTime.paused=false;await c.advance(3000);const answer=live.ask('이제는 채팅만 할게');await flush();ws.receive({serverContent:{outputTranscription:{text:'편하게 물어보세요.'},turnComplete:true}});await answer;assert.equal(c.sockets.length,connections);assert.equal(ws.sent.filter(m=>JSON.stringify(m).includes('inlineData')).length,pictures);live.stop();
});
test('reopened conversations seed their prior text before the current video and do not trigger a reply',async()=>{
 const c=context();c.callbacks.getHistory=()=>[{role:'user',text:'초록색 상품을 찾고 있어'},{role:'model',text:'초록색 가방이었어요.'}];const ws=await c.start();const prior=ws.sent.find(s=>s.clientContent?.turns?.[0]?.parts?.[0]?.text==='초록색 상품을 찾고 있어');assert(prior);assert.equal(prior.clientContent.turnComplete,false);assert.equal(prior.clientContent.turns[1].role,'model');assert.equal(c.received.length,0);c.window.cleanTouchLive.stop();
});
test('purchase tools receive the question frame and return grounded results in the same turn',async()=>{
 const c=context();let received;c.callbacks.onShopping=async(args,image)=>{received={args,image};return {query:args.query,candidates:[{name:'유사 상품',url:'https://shop.example.com'}]};};const ws=await c.start(),live=c.window.cleanTouchLive;const answer=live.ask('비슷한 상품 구매처 알려줘');await flush();ws.receive({toolCall:{functionCalls:[{id:'find-1',name:'find_similar_products',args:{query:'검은 가방'}}]}});await flush();assert.equal(received.image,'/9j/AA==');const response=ws.sent.find(m=>m.toolResponse);assert.equal(response.toolResponse.functionResponses[0].id,'find-1');assert.equal(response.toolResponse.functionResponses[0].response.candidates.length,1);ws.receive({serverContent:{outputTranscription:{text:'비슷한 상품 후보를 찾았어요.'},turnComplete:true}});await answer;live.stop();
});
test('tool results from a closed chat cannot reach a later conversation',async()=>{
 const c=context();let complete;c.callbacks.onShopping=()=>new Promise(r=>complete=r);const first=await c.start(),live=c.window.cleanTouchLive;const answer=live.ask('구매처는?');const rejected=assert.rejects(answer,/종료/);await flush();first.receive({toolCall:{functionCalls:[{id:'stale',name:'find_similar_products',args:{query:'가방'}}]}});await flush();live.stop();await rejected;await c.start();complete({candidates:[{name:'OLD'}]});await flush();assert(!first.sent.some(m=>m.toolResponse));assert(!c.sockets.at(-1).sent.some(m=>m.toolResponse));live.stop();
});
test('renewal preserves session handle and restores ready controls',async()=>{
 const c=context(),live=c.window.cleanTouchLive;await c.start();await c.advance(8*60_000);
 assert.equal(c.sockets.length,2);const second=c.sockets[1];assert.equal(c.tokenHandles.at(-1),'resume-one');
 second.open();second.receive({setupComplete:{}});await flush();assert.equal(live.active,true);assert.equal(c.states.at(-1).phase,'connected');
 assert.equal(second.sent[0].setup.sessionResumption.handle,'resume-one');assert.equal(second.sent.filter(x=>x.clientContent?.turns?.some(t=>t.parts?.some(p=>p.inlineData))).length,1);live.stop();
});
test('planned renewal waits for in-flight answers instead of losing them',async()=>{
 const c=context(),live=c.window.cleanTouchLive,first=await c.start();await c.advance(8*60_000-1000);
 const answer=live.ask('이거 뭐야?');await flush();await c.advance(1000);assert.equal(c.sockets.length,1);
 first.receive({serverContent:{outputTranscription:{text:'상품이에요.'},turnComplete:true}});await answer;await c.advance(2000);assert.equal(c.sockets.length,2);live.stop();await flush();
});
test('stopping a connecting session settles it and old timers cannot close a new socket',async()=>{
 const c=context(),live=c.window.cleanTouchLive;const old=live.start(c.callbacks);await flush();live.stop();await old;
 const current=await c.start();await c.advance(20000);assert.equal(current.readyState,1);assert.equal(live.active,true);live.stop();
});
test('an empty model turn is an actionable error and the next question still works',async()=>{
 const c=context(),live=c.window.cleanTouchLive,socket=await c.start();
 const answer=live.ask('뭐가 보여?'),failure=assert.rejects(answer,/답변을 보내지/);await flush();socket.receive({serverContent:{turnComplete:true}});await failure;
 const second=live.ask('다시 봐줘');await flush();socket.receive({serverContent:{modelTurn:{parts:[{text:'화면에서 상품이 보여요.'}]},turnComplete:true}});await second;assert(c.received.some(x=>x.text.includes('상품이')));live.stop();
});
test('old asynchronously decoded events cannot contaminate a replacement session',async()=>{
 const c=context(),live=c.window.cleanTouchLive,first=await c.start();let decode;
 first.onmessage({data:{text:()=>new Promise(resolve=>decode=resolve)}});live.stop();const second=await c.start();
 const answer=live.ask('새 영상은?');await flush();decode(JSON.stringify({serverContent:{outputTranscription:{text:'OLD'},turnComplete:true}}));await flush();assert(!c.received.some(x=>x.text==='OLD'));
 second.receive({serverContent:{outputTranscription:{text:'새 장면'},turnComplete:true}});await answer;live.stop();
});
test('answer timeout rejects promptly and late replies cannot answer a later question',async()=>{
 const c=context(),live=c.window.cleanTouchLive,first=await c.start();const answer=live.ask('상품은?'),failure=assert.rejects(answer,/지연/);await flush();await c.advance(55000);await failure;
 assert.equal(first.readyState,3);assert.equal(live.active,false);await c.advance(1500);assert.equal(c.sockets.length,2);live.stop();await flush();
});
test('reconnect failures back off and eventually stop instead of consuming quota forever',async()=>{
 const c=context(),live=c.window.cleanTouchLive,first=await c.start();c.bridge.getLiveToken=async()=>{throw Error('공유 요청이 많아요.');};first.close();await c.advance(1500);
 assert(c.statuses.at(-1).includes('30초'));assert.equal(live.sharing,true);await c.advance(30000);assert(c.statuses.at(-1).includes('60초'));await c.advance(60000);
 assert.equal(live.sharing,false);assert.equal(c.states.at(-1).phase,'off');assert(![...c.timers].some(t=>!t.interval));live.stop();
});
test('failed resume handle is dropped so the next connection can start fresh',async()=>{
 const c=context(),live=c.window.cleanTouchLive;await c.start();await c.advance(8*60_000);const rejected=c.sockets[1];rejected.open();rejected.receive({error:{message:'Invalid resume handle'}});await flush();await c.advance(30000);
 assert.equal(c.tokenHandles.at(-1),'');const next=c.sockets[2];next.open();next.receive({setupComplete:{}});await flush();assert.equal(live.active,true);live.stop();
});
test('long usage cooldown stops automatic reconnection and remains visible',async()=>{
 const c=context(),live=c.window.cleanTouchLive,first=await c.start();c.bridge.getLiveToken=async()=>{throw Error('오늘 사용량이 찼어요. (3600초 뒤 다시 시도)');};first.close();await c.advance(1500);
 assert.equal(live.sharing,false);assert(c.statuses.at(-1).includes('오늘 사용량'));assert.equal(c.states.at(-1).phase,'off');live.stop();
});
test('obscured video never sends an unrelated desktop image and recovers without reconnecting',async()=>{
 const c=context(),live=c.window.cleanTouchLive,socket=await c.start();c.videoTime.paused=false;c.capturePlan.blocked=true;c.capturePlan.reason='영상이 가려졌어요';
 const before=socket.sent.length;await c.advance(1000);assert.equal(socket.sent.length,before);await assert.rejects(live.ask('화면 보여?'),/가려/);
 c.capturePlan.blocked=false;await c.advance(1000);assert.equal(socket.sent.length,before+1);assert.equal(c.sockets.length,1);live.stop();
});
