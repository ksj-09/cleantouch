const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createChatStore}=require('../chat-store.cjs');const {fingerprint,parseTitles,promptFor,summarize,createTitleService}=require('../chat-title-service.cjs');
const record=(id,text)=>({id,title:'궁금한 내용 알아보기',titleGenerated:false,updatedAt:123,entries:[{role:'user',text},{role:'model',text:'해당 내용에 대한 자세한 설명입니다.'}],history:[{role:'user',text},{role:'model',text:'답변입니다.'}]});
async function fixture(fn){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cleantouch-titles-'));try{await fn(createChatStore(path.join(dir,'chats.json')));}finally{await fs.rm(dir,{recursive:true,force:true});}}
test('old generic headings get different local topics, while AI titles survive later non-AI saves',()=>fixture(async store=>{
 const a=record('a','제주도 여행 준비물'),b=record('b','가방 수선 방법');await store.save(a);await store.save(b);const titles=await store.list();assert.notEqual(titles[0].title,titles[1].title);
 const saved=await store.load('a');assert(await store.retitle('a','제주 여행 준비 체크리스트',fingerprint(saved)));await store.save({...saved,title:'궁금한 내용 알아보기'});const current=await store.load('a');assert.equal(current.title,'제주 여행 준비 체크리스트');assert(current.titleGenerated);assert.equal(current.updatedAt,123);assert.deepEqual(current.entries,saved.entries);
}));
test('a late title cannot change an edited, deleted or already titled conversation',()=>fixture(async store=>{
 await store.save(record('a','등산 준비'));const before=await store.load('a');await store.save({...before,history:[...before.history,{role:'user',text:'새 질문'}]});assert.equal(await store.retitle('a','등산 준비 방법',fingerprint(before)),false);await store.delete('a');assert.equal(await store.retitle('a','등산 준비 방법',fingerprint(before)),false);
}));
test('a title batch sends only saved text, rejects generic or duplicate titles and needs one connection',async()=>{
 const sent=[];let connections=0;class Socket{constructor(){connections++;setTimeout(()=>this.onopen?.(),0);}send(raw){const value=JSON.parse(raw);sent.push(value);if(value.setup)setTimeout(()=>this.onmessage?.({data:JSON.stringify({setupComplete:{}})}),0);else setTimeout(()=>this.onmessage?.({data:JSON.stringify({serverContent:{outputTranscription:{text:'[{"index":0,"title":"제주 여행 준비"}]'},turnComplete:true}})}),0);}close(){}}
 const result=await summarize([record('a','제주 여행')],{getToken:async()=>({token:'test',setup:{model:'test'}}),WebSocket:Socket});assert.deepEqual(result,[{index:0,title:'제주 여행 준비'}]);assert.equal(connections,1);assert.equal(sent.length,2);assert(!JSON.stringify(sent).includes('inlineData'));
 assert.deepEqual(parseTitles('[{"index":0,"title":"궁금한 내용 알아보기"},{"index":1,"title":"가방 수선"},{"index":1,"title":"중복"}]',2),[{index:1,title:'가방 수선'}]);assert(!promptFor([{...record('x','질문'),image:'secret-image'}]).includes('secret-image'));
});
test('automatic repair keeps successful summaries and backs off failed requests',()=>fixture(async store=>{
 await store.save(record('a','자전거 정비'));let attempts=0;const service=createTitleService({store,WebSocket:class{},getToken:async()=>{attempts++;throw Error('offline');}});service.schedule(await store.all());await new Promise(r=>setTimeout(r,800));service.schedule(await store.all());await new Promise(r=>setTimeout(r,800));service.stop();assert.equal(attempts,1);
}));
