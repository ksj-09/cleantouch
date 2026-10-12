import fs from 'node:fs/promises';
import {GeminiPlaceChat} from '../dist/place-chat.js';
const image=await fs.readFile('../artifacts/verification/live-clean-video.jpg');
const provider=new GeminiPlaceChat();
const messages=[{role:'user',text:'이 장소 분석해줘. 사진에 실제로 보이는 단서만 사용하고 모르면 모른다고 해줘.'}];
const first=await provider.reply(image,messages);console.log(JSON.stringify({stage:'initial',...first}));
messages.push({role:'model',text:first.answer.slice(0,3000)},{role:'user',text:'정확한 위치를 찾으려면 어떤 추가 장면이 필요해?'});
const next=await provider.reply(image,messages);console.log(JSON.stringify({stage:'follow-up',...next}));
await fs.writeFile('../artifacts/verification/place-chat-gemini.json',JSON.stringify({first,next},null,2));
