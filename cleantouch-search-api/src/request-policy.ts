import type {ChatMessage} from './place-provider.js';

const unsafeControls=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

export function cleanText(value:unknown,max=3000){
  if(typeof value!=='string')return '';
  return value.normalize('NFKC').replace(unsafeControls,'').replace(/\r\n?/g,'\n').trim().slice(0,max);
}

export function cleanMessages(value:unknown,maxItems=13):ChatMessage[]|null{
  if(!Array.isArray(value)||!value.length||value.length>maxItems)return null;
  const messages=value.map((entry,index)=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))return null;
    const role=(entry as {role?:unknown}).role;
    if(role!==(index%2===0?'user':'model'))return null;
    const text=cleanText((entry as {text?:unknown}).text);
    return text?{role,text} as ChatMessage:null;
  });
  return messages.every(Boolean)&&messages.at(-1)?.role==='user'?messages as ChatMessage[]:null;
}

/** Search terms come from an untrusted model/user and are never treated as commands. */
export function cleanShoppingQuery(value:unknown){
  return cleanText(value,120)
    .replace(/https?:\/\/\S+/gi,' ')
    .replace(/(?:시스템|개발자|이전|위)\s*(?:지시|명령).{0,60}(?:무시|따라|공개)/gi,' ')
    .replace(/[{}<>`$|\\]/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,60);
}

export function safePublicUrl(value:unknown){
  if(typeof value!=='string')return '';
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))return '';
    if(/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i.test(url.hostname))return '';
    return url.href;
  }catch{return '';}
}
