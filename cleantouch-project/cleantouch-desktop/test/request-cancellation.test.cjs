const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('cancel only the matching window and group, omit private metadata, release completed requests',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8'),start=source.indexOf('  const placeRequests=new Map();'),end=source.indexOf("  ipcMain.handle('ai:live-token'",start);
 assert(start>=0&&end>start);const handlers=new Map(),calls=[];
 const context={app:{on(){}},Map,AbortController,AbortSignal,TypeError,Error,JSON,PLACE_CHAT_URL:'https://example.test',ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},fetch:(_url,options)=>{
  calls.push(options);return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});calls.at(-1).resolve=()=>resolve({ok:true,json:async()=>({answer:'ok'})});});
 }};
 context.requestAi=(url,payload,options)=>require('../service-client.cjs').requestAi(url,payload,{...options,request:context.fetch});
 context.signedAi=(payload,options)=>context.requestAi(context.PLACE_CHAT_URL,payload,options);
 vm.runInNewContext(source.slice(start,end),context);
 const chat=handlers.get('place:chat'),cancel=handlers.get('place:cancel'),payload={_requestGroup:'scan:1',image:'abc',messages:[{role:'user',text:'x'}]};
 const first=chat({sender:{id:1}},payload),second=chat({sender:{id:2}},payload),third=chat({sender:{id:1}},{...payload,_requestGroup:'chat:1'});
 const rejected=assert.rejects(first);cancel({sender:{id:1}},'scan:1');await rejected;
 assert.equal(calls[0].signal.aborted,true);assert.equal(calls[1].signal.aborted,false);assert.equal(calls[2].signal.aborted,false);
 assert.equal(JSON.parse(calls[0].body)._requestGroup,undefined);
 calls[1].resolve();calls[2].resolve();await Promise.all([second,third]);cancel({sender:{id:2}},'scan:1');assert.equal(calls[1].signal.aborted,false);
});
