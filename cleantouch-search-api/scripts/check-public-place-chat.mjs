import fs from 'node:fs/promises';
const url='https://cleantouch-place-ai-20261006.netlify.app/v1/place-chat';
const image=(await fs.readFile('../artifacts/verification/live-clean-video.jpg')).toString('base64');
const messages=[{role:'user',text:'이 장소 분석해줘. 사진에 보이는 단서만 사용하고 모르면 모른다고 해줘.'}];
async function reply(){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,messages}),signal:AbortSignal.timeout(60000)});const data=await r.json();if(!r.ok)throw Error(`${r.status}: ${data.message}`);if(!data.answer)throw Error('No answer');return data;}
const first=await reply();console.log(JSON.stringify({stage:'initial',...first}));
messages.push({role:'model',text:first.answer.slice(0,3000)},{role:'user',text:'정확한 위치를 확인하려면 어떤 단서가 필요해?'});
const followUp=await reply();console.log(JSON.stringify({stage:'follow-up',...followUp}));
await fs.writeFile('../artifacts/verification/place-chat-public.json',JSON.stringify({first,followUp},null,2));
