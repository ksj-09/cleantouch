const fs = require('node:fs/promises');
const path = require('node:path');
const titlePolicy=require('./chat-title.js');
const conversationContext=require('./conversation-context.js');
const {fingerprint}=require('./chat-title-service.cjs');
const MAX_CHATS = 40, MAX_BYTES = 24 * 1024 * 1024;
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const image = value => typeof value === 'string' && value.length <= 1400000 && /^[A-Za-z0-9+/=]*$/.test(value) ? value : '';
function cleanCard(card) {
  if (!card || typeof card !== 'object') return null;
  if (card.kind === 'map' && typeof card.url === 'string') {
    try { const url = new URL(card.url); if (url.origin !== 'https://www.google.com' || url.pathname !== '/maps/search/') return null;
      return {kind:'map', label:text(card.label,180), url:url.href, reason:text(card.reason,500)};
    } catch { return null; }
  }
  const query = text(card.query, 80).trim();
  if (!query) return null;
  const candidates=(Array.isArray(card.candidates)?card.candidates:[]).slice(0,3).filter(c=>{try{const u=new URL(c.url);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&!/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname);}catch{return false;}}).map(c=>({name:text(c.name,160),url:text(c.url,3000),sourceTitle:text(c.sourceTitle,180),features:text(c.features,350)}));
  return {kind:'product', query, label:text(card.label,80) || query, reason:text(card.reason,350), image:image(card.image),candidates};
}
function cleanRecord(value) {
  if (!value || !validId(value.id)) throw Error('대화 기록을 확인하지 못했어요.');
  const entries = (Array.isArray(value.entries) ? value.entries : []).slice(-120).filter(e => e && ['user','model'].includes(e.role)).map(e => ({role:e.role, text:text(e.text,6000), failed:Boolean(e.failed), image:image(e.image), cards:(Array.isArray(e.cards)?e.cards:[]).slice(0,3).map(cleanCard).filter(Boolean)}));
  const history = (Array.isArray(value.history)?value.history:[]).slice(-40).filter(m => m && ['user','model'].includes(m.role)).map(m=>({role:m.role,text:text(m.text,3000)}));
  const oldTitle=text(value.title,60).trim(),generic=titlePolicy.isGeneric(oldTitle);
  const contextMessages=conversationContext.merge([],value.contextMessages||value.entries||history);
  return {id:value.id, title:generic?titlePolicy.fallback(entries):oldTitle, titleGenerated:Boolean(value.titleGenerated)&&!generic, updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:Date.now(), source:value.source==='import'?'import':'screen', image:image(value.image), entries, history,contextMessages};
}
function createChatStore(file) {
  let queue = Promise.resolve();
  const serial = fn => {const task=queue.then(fn);queue=task.catch(()=>{});return task;};
  async function read() {
    try { const stat=await fs.stat(file); if(stat.size>MAX_BYTES)throw Error('대화 기록 파일이 너무 커요.');
      const parsed=JSON.parse(await fs.readFile(file,'utf8')); if(parsed.version!==1||!Array.isArray(parsed.chats))throw Error('대화 기록 형식이 올바르지 않아요.');
      return parsed.chats.slice(0,MAX_CHATS).map(cleanRecord);
    } catch(error) {if(error.code==='ENOENT')return [];throw Error('저장된 대화를 읽지 못했어요. 기존 기록은 덮어쓰지 않습니다.');}
  }
  async function write(chats) {
    chats.sort((a,b)=>b.updatedAt-a.updatedAt);chats=chats.slice(0,MAX_CHATS);
    let body=JSON.stringify({version:1,chats});
    while(Buffer.byteLength(body)>MAX_BYTES&&chats.length>1){chats.pop();body=JSON.stringify({version:1,chats});}
    if(Buffer.byteLength(body)>MAX_BYTES)throw Error('이 대화에 사진이 너무 많아요. 새 대화를 시작해 주세요.');
    await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',body,'utf8');await fs.rename(file+'.tmp',file);
  }
  return {
    list:()=>serial(async()=> (await read()).map(({id,title,updatedAt,titleGenerated})=>({id,title,updatedAt,titleGenerated})).sort((a,b)=>b.updatedAt-a.updatedAt)),
    all:()=>serial(read),
    load:id=>serial(async()=>{if(!validId(id))throw Error('대화를 선택해 주세요.');return (await read()).find(c=>c.id===id)||null;}),
    save:value=>serial(async()=>{const record=cleanRecord(value);const chats=await read();const previous=chats.find(c=>c.id===record.id);if(previous)record.contextMessages=conversationContext.merge(previous.contextMessages,record.contextMessages);if(!record.titleGenerated&&previous?.titleGenerated){record.title=previous.title;record.titleGenerated=true;}await write([record,...chats.filter(c=>c.id!==record.id)]);return {id:record.id};}),
    retitle:(id,title,expected)=>serial(async()=>{const chats=await read(),record=chats.find(c=>c.id===id);if(!record||record.titleGenerated||fingerprint(record)!==expected||typeof title!=='string'||title.length<2||title.length>28||titlePolicy.isGeneric(title))return false;record.title=title;record.titleGenerated=true;await write(chats);return true;}),
    delete:id=>serial(async()=>{if(!validId(id))throw Error('대화를 선택해 주세요.');await write((await read()).filter(c=>c.id!==id));}),
  };
}
module.exports={createChatStore,cleanRecord,MAX_CHATS,MAX_BYTES};
