import jpeg from 'jpeg-js';
import {GeminiPlaceChat,ChatError} from '../../dist/place-provider.js';
import {createLiveToken} from '../../dist/live-token.js';
import {readSpeechAudio,SpeechError} from '../../dist/speech.js';
import {admitUsage,AccessError} from '../../dist/usage-guard.js';
const guardRequired=()=>process.env.USAGE_GUARD_MODE!=='off';
const provider=new GeminiPlaceChat();
let day='',daily=0,active=0;
const limits=new Map();
const liveLimits=new Map();let liveDay='',liveDaily=0;
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()','strict-transport-security':'max-age=31536000; includeSubDomains'};
const response=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
const positiveLimit=(name,fallback)=>{const value=Number(process.env[name]);return Number.isInteger(value)&&value>0?value:fallback;};
const cleanText=(value,max=3000)=>typeof value==='string'?value.normalize('NFKC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').replace(/\r\n?/g,'\n').trim().slice(0,max):'';
const cleanQuery=value=>cleanText(value,120).replace(/https?:\/\/\S+/gi,' ').replace(/(?:시스템|개발자|이전|위)\s*(?:지시|명령).{0,60}(?:무시|따라|공개)/gi,' ').replace(/[{}<>`$|\\]/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
const cleanMessages=value=>{if(!Array.isArray(value)||!value.length||value.length>13)return null;const result=value.map((m,i)=>{const role=i%2===0?'user':'model',text=cleanText(m?.text);return m?.role===role&&text?{role,text}:null;});return result.every(Boolean)&&result.at(-1)?.role==='user'?result:null;};
export async function handler(event){
 if(event.httpMethod==='GET'&&event.path.endsWith('/health'))return response(200,{ok:true,configured:provider.configured,usageGuard:guardRequired()?'required':'off',signedRequestsRequired:process.env.AI_REQUIRE_SIGNED_REQUESTS==='true'});
 if(event.httpMethod!=='POST')return response(405,{message:'지원하지 않는 요청입니다.'});
 try{
  if(!provider.configured)throw new ChatError(503,'장소 분석 서비스가 준비 중이에요.');
  if(event.body?.length>3_000_000)throw new ChatError(413,'영상 이미지가 너무 커요.');
  let payload;try{payload=JSON.parse(event.body||'{}');}catch{throw new ChatError(400,'요청 형식을 확인해 주세요.');}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new ChatError(400,'요청 형식을 확인해 주세요.');
  const {image,images,messages:rawMessages,task,target:rawTarget,sessionHandle,audio}=payload;
  const messages=cleanMessages(rawMessages),targetAbsent=rawTarget===undefined||(task==='product'&&typeof rawTarget==='string'&&!rawTarget.trim()),target=targetAbsent?undefined:cleanQuery(rawTarget);
  if(task==='live-token'){
    const today=new Date().toISOString().slice(0,10);if(liveDay!==today){liveDay=today;liveDaily=0;liveLimits.clear();}
    const ip=event.headers?.['x-nf-client-connection-ip']||'unknown',now=Date.now();const quota=liveLimits.get(ip)||{at:now,count:0};if(now-quota.at>60000){quota.at=now;quota.count=0;}
    if(liveDaily>=positiveLimit('LIVE_CHAT_DAILY_LIMIT',30))throw new ChatError(429,'오늘 AI 대화 연결 한도에 도달했어요. 사진으로 상품 찾기는 계속 사용할 수 있어요.',Math.ceil((Date.parse(today+'T00:00:00Z')+86400000-now)/1000));
    if(quota.count>=positiveLimit('LIVE_CHAT_CONNECTIONS_PER_MINUTE',8))throw new ChatError(429,'AI 연결 요청이 잠시 몰렸어요.',Math.max(1,Math.ceil((quota.at+60000-now)/1000)));
    if(sessionHandle!==undefined&&(typeof sessionHandle!=='string'||sessionHandle.length>2048))throw new ChatError(400,'AI 대화 연결 정보를 확인해 주세요.');
    quota.count++;liveLimits.set(ip,quota);if(liveLimits.size>5000)liveLimits.delete(liveLimits.keys().next().value);
    await admitUsage(event,'live-token',undefined,guardRequired());
    const token=await createLiveToken(fetch,process.env.GEMINI_API_KEY,sessionHandle||'',payload.shoppingTools===true);liveDaily++;
    return response(200,token);
  }
  if(task==='speech'){
    const bytes=readSpeechAudio(audio),today=new Date().toISOString().slice(0,10);if(day!==today){day=today;daily=0;limits.clear();}
    const ip=event.headers?.['x-nf-client-connection-ip']||'unknown',now=Date.now(),quota=limits.get(ip)||{at:now,count:0};if(now-quota.at>60000){quota.at=now;quota.count=0;}
    if(quota.count>=10||active>=2||daily>=positiveLimit('PLACE_CHAT_DAILY_LIMIT',500))throw new ChatError(429,'지금 음성 요청이 많아요. 잠시 후 다시 시도해 주세요.',30);
    quota.count++;limits.set(ip,quota);if(limits.size>5000)limits.delete(limits.keys().next().value);active++;daily++;
    try{await admitUsage(event,'speech',undefined,guardRequired());return response(200,{...await provider.transcribeAudio(bytes),retention:{audioStored:false}});}finally{active--;}
  }
  if(images!==undefined&&(!Array.isArray(images)||!images.length||images.length>6||images.some(x=>typeof x!=='string'||x.length>600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(x))||images.reduce((n,x)=>n+x.length,0)>2200000))throw new ChatError(400,'최근 장면이 너무 크거나 형식이 올바르지 않아요.');
      if(!targetAbsent&&(!target||typeof rawTarget!=='string'))throw new ChatError(400,'상품명 형식을 확인해 주세요.');
  if(task!==undefined&&task!=='product'&&task!=='objects'&&task!=='similar')throw new ChatError(400,'지원하지 않는 분석 요청입니다.');
  if(task==='similar'&&(typeof target!=='string'||!target.trim()))throw new ChatError(400,'찾을 상품을 확인해 주세요.');
  if(typeof image!=='string'||!image.length||image.length>2_800_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(image))throw new ChatError(400,'영상 이미지가 필요해요.');
  if(!messages)throw new ChatError(400,'질문 형식을 확인해 주세요.');
  const bytes=Buffer.from(image,'base64');
  if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new ChatError(400,'영상 JPEG 이미지가 필요해요.');
  try{jpeg.decode(bytes,{maxResolutionInMP:8,maxMemoryUsageInMB:64,tolerantDecoding:false});}catch{throw new ChatError(400,'사진을 읽지 못했어요. 다른 사진을 선택해 주세요.');}
  const today=new Date().toISOString().slice(0,10);if(day!==today){day=today;daily=0;limits.clear();}
  const ip=event.headers?.['x-nf-client-connection-ip']||'unknown',now=Date.now();
  const quota=limits.get(ip)||{at:now,count:0};if(now-quota.at>60000){quota.at=now;quota.count=0;}
  if(quota.count>=10||active>=2||daily>=positiveLimit('PLACE_CHAT_DAILY_LIMIT',500))throw new ChatError(429,'지금 AI 분석 요청이 많아요. 잠시 후 다시 시도해 주세요.',30);
  quota.count++;limits.set(ip,quota);if(limits.size>5000)limits.delete(limits.keys().next().value);const scenes=images?images.map(x=>{try{const bytes=Buffer.from(x,'base64');jpeg.decode(bytes,{maxResolutionInMP:8,maxMemoryUsageInMB:64,tolerantDecoding:false});return bytes;}catch{throw new ChatError(400,'최근 장면 이미지를 읽지 못했어요.');}}):[];
      if(active>=2)throw new ChatError(429,'잠시 후 다시 시도해 주세요.');
      active++;daily++;
  try{await admitUsage(event,task||'chat',undefined,guardRequired());return response(200,{...await (task==='similar'?provider.findSimilarProducts(bytes,target):task==='objects'?provider.locateProducts(bytes,undefined,scenes):task==='product'?provider.identifyProduct(bytes,undefined,target||'',scenes):provider.reply(bytes,messages,undefined,scenes)),retention:{imageStored:false},disclaimer:task==='product'?'상품명은 사진 기반 AI 추정입니다. 구매 전 판매 페이지를 확인해 주세요.':'사진 기반 AI 추정입니다. 동일 상품 여부는 판매 사진으로 확인해 주세요.'});}finally{active--;}
 }catch(error){const known=error instanceof ChatError||error instanceof SpeechError||error instanceof AccessError;return response(known?error.status:503,{message:known?error.message:'AI 연결이 지연됐어요. 잠시 후 다시 시도해 주세요.',...(error?.retryAfterSeconds?{retryAfterSeconds:error.retryAfterSeconds}:{})});}
}
